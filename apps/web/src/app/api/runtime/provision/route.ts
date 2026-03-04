import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { renderCloudInit } from "@tulip/cloud-init";

const DO_API_TOKEN = process.env.DO_API_TOKEN!;
const DO_REGION = process.env.DO_REGION ?? "lon1";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const RUNTIME_BASE_DOMAIN = process.env.NEXT_PUBLIC_RUNTIME_BASE_DOMAIN!;
const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE ?? "ghcr.io/tulipai/openclaw:latest";

function generateInstanceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const short = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `tulip-${short}`;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const orgsSnap = await adminDb
    .collection("orgs")
    .where("ownerUid", "==", uid)
    .limit(1)
    .get();

  if (orgsSnap.empty) {
    return NextResponse.json({ error: "No org found" }, { status: 404 });
  }

  const orgId = orgsSnap.docs[0]!.id;

  const slackDoc = await adminDb.doc(`orgs/${orgId}/integrations/slack`).get();
  if (!slackDoc.exists) {
    return NextResponse.json({ error: "Connect Slack before provisioning" }, { status: 400 });
  }

  // orgs/{orgId}/runtime/current (updated path)
  const runtimeDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();
  if (runtimeDoc.exists) {
    const s = runtimeDoc.data()?.status;
    if (s && s !== "error") {
      return NextResponse.json({ error: "Runtime already exists" }, { status: 409 });
    }
  }

  const instanceId = generateInstanceId();
  const bootstrapToken = randomBytes(32).toString("hex");
  const subdomain = `${instanceId}.${RUNTIME_BASE_DOMAIN}`;

  // Render cloud-init using the package template
  const userData = renderCloudInit({
    CONTROL_PLANE_BASE_URL: APP_URL,
    BOOTSTRAP_TOKEN: bootstrapToken,
    ORG_ID: orgId,
    INSTANCE_ID: instanceId,
    OPENCLAW_IMAGE,
  });

  // Write provisioning record
  await adminDb.doc(`orgs/${orgId}/runtime/current`).set({
    instanceId,
    dropletId: 0,
    hostname: subdomain,
    region: DO_REGION,
    status: "provisioning",
    subdomain,
    createdAt: FieldValue.serverTimestamp(),
    lastHeartbeatAt: null,
    openclawHealthy: null,
    cloudflaredHealthy: null,
    lastError: null,
    bootstrapToken,
    bootstrapTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  // Create DigitalOcean droplet
  const doRes = await fetch("https://api.digitalocean.com/v2/droplets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DO_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `tulip-${orgId.slice(0, 8)}-${instanceId}`,
      region: DO_REGION,
      size: "s-1vcpu-1gb",
      image: "ubuntu-22-04-x64",
      monitoring: true,
      ipv6: false,
      backups: false,
      ssh_keys: [43938919],
      tags: ["tulip", `org:${orgId}`, `instance:${instanceId}`],
      user_data: userData,
    }),
  });

  if (!doRes.ok) {
    const doError = await doRes.json();
    console.error("DigitalOcean error:", doError);
    await adminDb.doc(`orgs/${orgId}/runtime/current`).update({
      status: "error",
      lastError: "Droplet creation failed",
    });
    return NextResponse.json({ error: "Failed to create droplet" }, { status: 502 });
  }

  const { droplet } = await doRes.json();

  await adminDb.doc(`orgs/${orgId}/runtime/current`).update({
    dropletId: droplet.id,
    status: "booting",
  });

  // Create instance-level metadata record
  await adminDb.doc(`runtimes/${instanceId}`).set({
    instanceId,
    orgId,
    dropletId: droplet.id,
    region: DO_REGION,
    createdAt: FieldValue.serverTimestamp(),
    agentVersion: null,
    openclawImage: OPENCLAW_IMAGE,
  });

  return NextResponse.json({ instanceId, subdomain, status: "booting" });
}
