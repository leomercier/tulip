/**
 * Cloud-init YAML template.
 *
 * Uses {{PLACEHOLDER}} substitution - no external template engine required.
 * All values are injected by renderCloudInit() before passing to the DO API.
 */
export const CLOUD_INIT_TEMPLATE = `#cloud-config
package_update: true
package_upgrade: false

write_files:
  - path: /opt/tulip/bootstrap.env
    permissions: "0600"
    owner: root:root
    content: |
      CONTROL_PLANE_BASE_URL={{CONTROL_PLANE_BASE_URL}}
      BOOTSTRAP_TOKEN={{BOOTSTRAP_TOKEN}}
      ORG_ID={{ORG_ID}}
      INSTANCE_ID={{INSTANCE_ID}}
      OPENCLAW_IMAGE={{OPENCLAW_IMAGE}}
      OPENCLAW_PORT=18789
      OPENCLAW_GATEWAY_TOKEN={{OPENCLAW_GATEWAY_TOKEN}}

  - path: /opt/tulip/bootstrap.sh
    permissions: "0755"
    owner: root:root
    content: |
      #!/usr/bin/env bash
      set -euo pipefail
      source /opt/tulip/bootstrap.env

      apt-get update -y
      apt-get install -y curl jq ca-certificates

      # Install Node.js 22 LTS via NodeSource
      if ! command -v node >/dev/null 2>&1; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y nodejs
      fi

      # Install Docker
      if ! command -v docker >/dev/null 2>&1; then
        curl -fsSL https://get.docker.com | sh
      fi
      systemctl enable --now docker

      # Enable persistent journald logs
      mkdir -p /var/log/journal
      systemctl restart systemd-journald || true

      # Install cloudflared
      if ! command -v cloudflared >/dev/null 2>&1; then
        curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cf.deb
        apt-get install -y /tmp/cf.deb
        rm /tmp/cf.deb
      fi

      # Collect droplet metadata from DigitalOcean IMDS
      IPV4=$(curl -sf http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || echo "")
      REGION=$(curl -sf http://169.254.169.254/metadata/v1/region || echo "")

      PAYLOAD=$(jq -n \\
        --arg token "$BOOTSTRAP_TOKEN" \\
        --arg org "$ORG_ID" \\
        --arg instance "$INSTANCE_ID" \\
        --arg region "$REGION" \\
        --arg ipv4 "$IPV4" \\
        '{bootstrapToken:$token,orgId:$org,instanceId:$instance,dropletMeta:{region:$region,ipv4:$ipv4}}')

      # Retry bootstrap up to 10 times (droplet may need a moment to have network)
      RESP=""
      for i in $(seq 1 10); do
        RESP=$(curl -sf -X POST "$CONTROL_PLANE_BASE_URL/api/runtime/bootstrap" \\
          -H "Content-Type: application/json" \\
          -d "$PAYLOAD") && break || {
          echo "Bootstrap attempt $i failed, retrying in 15s..."
          sleep 15
        }
      done

      if [ -z "$RESP" ]; then
        echo "ERROR: Bootstrap failed after 10 attempts"
        exit 1
      fi

      HOSTNAME=$(echo "$RESP" | jq -r .hostname)
      TUNNEL_TOKEN=$(echo "$RESP" | jq -r .cloudflare.tunnelToken)
      RUNTIME_AUTH_TOKEN=$(echo "$RESP" | jq -r .runtimeAuthToken)
      OPENCLAW_IMG=$(echo "$RESP" | jq -r .openclaw.image)

      # ---- OpenClaw ----
      mkdir -p /opt/tulip/openclaw

      printf 'PORT=18791\\nBIND_HOST=0.0.0.0\\nINSTANCE_ID=%s\\n' "$INSTANCE_ID" > /opt/tulip/openclaw/.env
      echo "$RESP" | jq -r '.openclaw.env | to_entries[] | .key + "=" + .value' >> /opt/tulip/openclaw/.env

      # Write openclaw.json config if provided by bootstrap
      OPENCLAW_CONFIG=$(echo "$RESP" | jq -r '.openclaw.config // empty')
      if [ -n "$OPENCLAW_CONFIG" ]; then
        mkdir -p /opt/tulip/openclaw
        printf '%s' "$OPENCLAW_CONFIG" > /opt/tulip/openclaw/openclaw.json
        chmod 600 /opt/tulip/openclaw/openclaw.json
        OPENCLAW_CONFIG_MOUNT="-v /opt/tulip/openclaw/openclaw.json:/root/.openclaw/openclaw.json"
        OPENCLAW_EXTRA_ARGS=""
      else
        OPENCLAW_CONFIG_MOUNT=""
        OPENCLAW_EXTRA_ARGS="--allow-unconfigured"
      fi

      cat > /etc/systemd/system/openclaw.service <<SYSTEMD_EOF
      [Unit]
      Description=OpenClaw AI Runtime
      After=docker.service network-online.target
      Wants=network-online.target
      Requires=docker.service

      [Service]
      Type=exec
      Restart=always
      RestartSec=5
      ExecStartPre=-/usr/bin/docker stop openclaw
      ExecStartPre=-/usr/bin/docker rm openclaw
      ExecStart=/usr/bin/docker run --name openclaw --restart unless-stopped --env-file /opt/tulip/openclaw/.env -e OPENCLAW_GATEWAY_PORT=\${OPENCLAW_PORT} -e OPENCLAW_GATEWAY_TOKEN=\${OPENCLAW_GATEWAY_TOKEN} -p 0.0.0.0:\${OPENCLAW_PORT}:\${OPENCLAW_PORT} $OPENCLAW_CONFIG_MOUNT \${OPENCLAW_IMG} $OPENCLAW_EXTRA_ARGS
      ExecStop=/usr/bin/docker stop openclaw
      TimeoutStopSec=30

      [Install]
      WantedBy=multi-user.target
      SYSTEMD_EOF

      # ---- Cloudflare Tunnel ----
      cat > /etc/systemd/system/cloudflared.service <<SYSTEMD_EOF
      [Unit]
      Description=Cloudflare Tunnel
      After=network.target

      [Service]
      Restart=always
      RestartSec=5
      ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token $TUNNEL_TOKEN

      [Install]
      WantedBy=multi-user.target
      SYSTEMD_EOF

      # ---- Runtime Agent ----
      mkdir -p /opt/tulip/agent

      cat > /opt/tulip/agent/.env <<AGENT_EOF
      CONTROL_PLANE_BASE_URL=$CONTROL_PLANE_BASE_URL
      INSTANCE_ID=$INSTANCE_ID
      ORG_ID=$ORG_ID
      RUNTIME_AUTH_TOKEN=$RUNTIME_AUTH_TOKEN
      OPENCLAW_HEALTH_URL=http://127.0.0.1:18789
      HEARTBEAT_INTERVAL_SEC=30
      COMMAND_POLL_INTERVAL_SEC=15
      AGENT_EOF

      # Pre-warm npx cache so the service starts offline-capable after first boot
      HOME=/opt/tulip/agent NPM_CONFIG_CACHE=/opt/tulip/agent/.npm \
        npx --yes @crowdform/tulip-runtime-agent --version 2>/dev/null || \
        echo "WARN: npx pre-warm failed; service will attempt download on first start"

      cat > /etc/systemd/system/tulip-agent.service <<SYSTEMD_EOF
      [Unit]
      Description=Tulip Runtime Agent
      After=network-online.target openclaw.service
      Wants=network-online.target
      Requires=openclaw.service

      [Service]
      Restart=always
      RestartSec=10
      EnvironmentFile=/opt/tulip/agent/.env
      Environment=HOME=/opt/tulip/agent
      Environment=NPM_CONFIG_CACHE=/opt/tulip/agent/.npm
      ExecStart=/usr/bin/npx --yes @crowdform/tulip-runtime-agent

      [Install]
      WantedBy=multi-user.target
      SYSTEMD_EOF

      # ---- Start everything ----
      systemctl daemon-reload
      systemctl enable openclaw cloudflared tulip-agent
      systemctl start openclaw cloudflared tulip-agent

      echo "Tulip runtime $INSTANCE_ID bootstrapped successfully."

runcmd:
  - mkdir -p /opt/tulip
  - bash /opt/tulip/bootstrap.sh >> /var/log/tulip-bootstrap.log 2>&1
`;
