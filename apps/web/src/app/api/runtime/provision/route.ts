import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";

const DO_API_TOKEN = process.env.DO_API_TOKEN!;
const DO_REGION = "nyc3";
const DO_SIZE = "s-1vcpu-1gb"; // smallest viable for v1
const DO_IMAGE = "ubuntu-22-04-x64";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const RUNTIME_BASE_DOMAIN = process.env.NEXT_PUBLIC_RUNTIME_BASE_DOMAIN!;

function generateInstanceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const short = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `tulip-${short}`;
}

function buildUserData(instanceId: string, bootstrapToken: string): string {
  return `#!/bin/bash
set -euo pipefail

# Install Docker
apt-get update -y
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared.deb

# Bootstrap — fetch config from control plane
INSTANCE_ID="${instanceId}"
BOOTSTRAP_TOKEN="${bootstrapToken}"
CONTROL_PLANE_URL="${APP_URL}"

# Retry bootstrap up to 10 times (droplet may not be ready immediately)
for i in $(seq 1 10); do
  RESPONSE=$(curl -sf -X POST "$CONTROL_PLANE_URL/api/runtime/bootstrap" \\
    -H "Content-Type: application/json" \\
    -d '{"instanceId":"'"$INSTANCE_ID"'","bootstrapToken":"'"$BOOTSTRAP_TOKEN"'"}') && break
  echo "Bootstrap attempt $i failed, retrying in 15s..."
  sleep 15
done

# Parse response
CF_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['cloudflareTunnelToken'])")
SLACK_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['slackBotToken'])")
MODEL_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['inference']['modelId'])")
SYSTEM_PROMPT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['inference']['systemPrompt'])")

# Write OpenClaw .env
mkdir -p /opt/openclaw
cat > /opt/openclaw/.env <<EOF
SLACK_BOT_TOKEN=$SLACK_TOKEN
INSTANCE_ID=$INSTANCE_ID
MODEL_ID=$MODEL_ID
SYSTEM_PROMPT=$SYSTEM_PROMPT
EOF

# Start OpenClaw
docker run -d \\
  --name openclaw \\
  --restart unless-stopped \\
  -p 127.0.0.1:3000:3000 \\
  --env-file /opt/openclaw/.env \\
  ghcr.io/openclaw/openclaw:latest

# Configure and start cloudflared tunnel
cloudflared service install "$CF_TOKEN"
systemctl start cloudflared

# Signal ready
curl -sf -X POST "$CONTROL_PLANE_URL/api/runtime/heartbeat" \\
  -H "Content-Type: application/json" \\
  -d '{"instanceId":"'"$INSTANCE_ID"'","status":"ready"}'

echo "Tulip runtime $INSTANCE_ID is ready."
`;
}

export async function POST(request: NextRequest) {
  // Verify Firebase ID token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Find org owned by this user
  const orgsSnap = await adminDb
    .collection("orgs")
    .where("ownerUid", "==", uid)
    .limit(1)
    .get();

  if (orgsSnap.empty) {
    return NextResponse.json({ error: "No org found" }, { status: 404 });
  }

  const orgDoc = orgsSnap.docs[0]!;
  const orgId = orgDoc.id;

  // Check Slack is connected
  const slackDoc = await adminDb.doc(`orgs/${orgId}/integrations/slack`).get();
  if (!slackDoc.exists) {
    return NextResponse.json(
      { error: "Slack must be connected before provisioning" },
      { status: 400 }
    );
  }

  // Check no existing runtime
  const runtimeDoc = await adminDb.doc(`orgs/${orgId}/runtime/default`).get();
  if (runtimeDoc.exists) {
    const existing = runtimeDoc.data();
    if (existing?.status && existing.status !== "error") {
      return NextResponse.json(
        { error: "Runtime already exists" },
        { status: 409 }
      );
    }
  }

  const instanceId = generateInstanceId();
  const bootstrapToken = randomBytes(32).toString("hex");
  const subdomain = `${instanceId}.${RUNTIME_BASE_DOMAIN}`;

  // Store provisioning state + bootstrap token (expires in 10 minutes)
  await adminDb.doc(`orgs/${orgId}/runtime/default`).set({
    instanceId,
    status: "provisioning",
    subdomain,
    region: DO_REGION,
    createdAt: FieldValue.serverTimestamp(),
    lastHeartbeat: null,
    bootstrapToken,
    bootstrapTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  // Create DigitalOcean droplet
  const doRes = await fetch("https://api.digitalocean.com/v2/droplets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DO_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: instanceId,
      region: DO_REGION,
      size: DO_SIZE,
      image: DO_IMAGE,
      tags: ["tulip", `org:${orgId}`],
      user_data: buildUserData(instanceId, bootstrapToken),
      ipv6: false,
      monitoring: true,
    }),
  });

  if (!doRes.ok) {
    const doError = await doRes.json();
    console.error("DigitalOcean error:", doError);
    await adminDb.doc(`orgs/${orgId}/runtime/default`).update({ status: "error" });
    return NextResponse.json(
      { error: "Failed to create droplet" },
      { status: 502 }
    );
  }

  const doData = await doRes.json();
  const dropletId: number = doData.droplet.id;

  await adminDb.doc(`orgs/${orgId}/runtime/default`).update({
    dropletId,
    status: "booting",
  });

  return NextResponse.json({
    instanceId,
    subdomain,
    status: "booting",
  });
}
