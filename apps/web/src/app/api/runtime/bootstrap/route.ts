import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createDecipheriv, randomBytes } from "crypto";
import type { BootstrapRequest, BootstrapResponse, InferenceConfig } from "@tulip/types";
import { createTunnel } from "@/lib/cloudflare";

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY ?? "";
const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE ?? "ghcr.io/tulipai/openclaw:latest";
const RUNTIME_BASE_DOMAIN = process.env.NEXT_PUBLIC_RUNTIME_BASE_DOMAIN ?? "agents.tulip.ai";

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte (64 hex char) value");
  }
  return Buffer.from(ENCRYPTION_KEY, "hex");
}

function decryptToken(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error("Invalid ciphertext");
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<BootstrapRequest>;
  const { bootstrapToken, orgId, instanceId, dropletMeta } = body;

  if (!bootstrapToken || !orgId || !instanceId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const rtDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();

  if (!rtDoc.exists || rtDoc.data()?.instanceId !== instanceId) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const rtData = rtDoc.data()!;

  if (rtData.bootstrapToken !== bootstrapToken) {
    return NextResponse.json({ error: "Invalid bootstrap token" }, { status: 401 });
  }

  if (rtData.bootstrapTokenExpiresAt) {
    const expiresAt = new Date(rtData.bootstrapTokenExpiresAt).getTime();
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: "Bootstrap token expired" }, { status: 401 });
    }
  }

  // Fetch Slack bot token
  const slackDoc = await adminDb.doc(`orgs/${orgId}/integrations/slack`).get();
  if (!slackDoc.exists) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 400 });
  }

  const slackBotToken = decryptToken(slackDoc.data()!.botTokenEncrypted);

  // Fetch inference config
  const inferenceDoc = await adminDb.doc(`orgs/${orgId}/inference/default`).get();
  const inference: InferenceConfig = inferenceDoc.exists
    ? (inferenceDoc.data() as InferenceConfig)
    : {
        modelProvider: "anthropic",
        modelId: "claude-sonnet-4-6",
        systemPrompt: "You are a helpful AI assistant. Be concise, accurate, and friendly.",
        timeoutMs: 30000,
        allowedTools: ["web_search", "code_execution"],
      };

  // Create or reuse Cloudflare tunnel
  const runtimeAuthToken = randomBytes(32).toString("hex");
  const hostname = `${instanceId}.${RUNTIME_BASE_DOMAIN}`;

  const cfDoc = await adminDb.doc(`orgs/${orgId}/cloudflare/tunnel`).get();
  let cloudflareTunnelToken: string;

  if (cfDoc.exists && cfDoc.data()?.instanceId === instanceId) {
    // Reuse existing tunnel (e.g. rebootstrap command)
    cloudflareTunnelToken = cfDoc.data()!.tunnelToken;
  } else {
    // First bootstrap: create tunnel, configure ingress + DNS
    const tunnel = await createTunnel(instanceId);
    cloudflareTunnelToken = tunnel.token;
    await adminDb.doc(`orgs/${orgId}/cloudflare/tunnel`).set({
      tunnelId: tunnel.id,
      tunnelToken: tunnel.token,
      instanceId,
    });
  }

  // Clear bootstrap token (one-time use) and store runtime auth token
  await rtDoc.ref.update({
    bootstrapToken: FieldValue.delete(),
    bootstrapTokenExpiresAt: FieldValue.delete(),
    status: "booting",
    hostname,
    runtimeAuthToken,
    ...(dropletMeta?.region ? { region: dropletMeta.region } : {}),
    ...(dropletMeta?.ipv4 ? { ipv4: dropletMeta.ipv4 } : {}),
  });

  const response: BootstrapResponse = {
    instanceId,
    hostname,
    runtimeAuthToken,
    cloudflare: { tunnelToken: cloudflareTunnelToken },
    openclaw: {
      image: OPENCLAW_IMAGE,
      env: {
        SLACK_BOT_TOKEN: slackBotToken,
        INSTANCE_ID: instanceId,
        ORG_ID: orgId,
        MODEL_ID: inference.modelId,
        SYSTEM_PROMPT: inference.systemPrompt,
      },
    },
    inference,
  };

  return NextResponse.json(response);
}
