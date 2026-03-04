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
      OPENCLAW_PORT=3000

  - path: /opt/tulip/bootstrap.sh
    permissions: "0755"
    owner: root:root
    content: |
      #!/usr/bin/env bash
      set -euo pipefail
      source /opt/tulip/bootstrap.env

      apt-get update -y
      apt-get install -y curl jq ca-certificates nodejs npm

      # Install Docker
      if ! command -v docker >/dev/null 2>&1; then
        curl -fsSL https://get.docker.com | sh
      fi

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

      printf 'PORT=3000\\nBIND_HOST=127.0.0.1\\nINSTANCE_ID=%s\\n' "$INSTANCE_ID" > /opt/tulip/openclaw/.env
      echo "$RESP" | jq -r '.openclaw.env | to_entries[] | .key + "=" + .value' >> /opt/tulip/openclaw/.env

      cat > /etc/systemd/system/openclaw.service <<SYSTEMD_EOF
      [Unit]
      Description=OpenClaw AI Runtime
      After=docker.service
      Requires=docker.service

      [Service]
      Restart=always
      RestartSec=5
      ExecStartPre=-/usr/bin/docker stop openclaw
      ExecStartPre=-/usr/bin/docker rm openclaw
      ExecStart=/usr/bin/docker run --name openclaw --rm --env-file /opt/tulip/openclaw/.env -p 127.0.0.1:3000:3000 $OPENCLAW_IMG

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
      OPENCLAW_HEALTH_URL=http://127.0.0.1:3000/health
      HEARTBEAT_INTERVAL_SEC=30
      COMMAND_POLL_INTERVAL_SEC=15
      AGENT_EOF

      # Download + install runtime agent
      npm install -g @tulip/runtime-agent@latest 2>/dev/null || \\
        curl -fsSL "$CONTROL_PLANE_BASE_URL/agent/latest.js" -o /opt/tulip/agent/agent.js

      cat > /etc/systemd/system/tulip-agent.service <<SYSTEMD_EOF
      [Unit]
      Description=Tulip Runtime Agent
      After=network.target openclaw.service

      [Service]
      Restart=always
      RestartSec=10
      EnvironmentFile=/opt/tulip/agent/.env
      ExecStart=/usr/bin/node /opt/tulip/agent/agent.js

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
