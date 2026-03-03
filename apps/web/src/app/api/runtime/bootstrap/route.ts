import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { createDecipheriv } from "crypto";

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!;

function decryptToken(encrypted: string): string {
  const [ivB64, authTagB64, dataB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) throw new Error("Invalid ciphertext");

  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { instanceId, bootstrapToken } = body as {
    instanceId?: string;
    bootstrapToken?: string;
  };

  if (!instanceId || !bootstrapToken) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Find runtime by instanceId
  const orgsSnap = await adminDb.collection("orgs").get();
  let orgId: string | null = null;
  let runtimeData: FirebaseFirestore.DocumentData | null = null;

  for (const orgDoc of orgsSnap.docs) {
    const rtDoc = await adminDb.doc(`orgs/${orgDoc.id}/runtime/default`).get();
    if (rtDoc.exists && rtDoc.data()?.instanceId === instanceId) {
      orgId = orgDoc.id;
      runtimeData = rtDoc.data()!;
      break;
    }
  }

  if (!orgId || !runtimeData) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // Validate bootstrap token
  if (runtimeData.bootstrapToken !== bootstrapToken) {
    return NextResponse.json({ error: "Invalid bootstrap token" }, { status: 401 });
  }

  // Check token expiry (10-minute window)
  const expiresAt = new Date(runtimeData.bootstrapTokenExpiresAt).getTime();
  if (Date.now() > expiresAt) {
    return NextResponse.json({ error: "Bootstrap token expired" }, { status: 401 });
  }

  // Fetch Slack bot token
  const slackDoc = await adminDb.doc(`orgs/${orgId}/integrations/slack`).get();
  if (!slackDoc.exists) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 400 });
  }

  const slackData = slackDoc.data()!;
  const slackBotToken = decryptToken(slackData.botTokenEncrypted);

  // Fetch inference config (or return defaults)
  const inferenceDoc = await adminDb
    .doc(`orgs/${orgId}/inference/default`)
    .get();

  const inference = inferenceDoc.exists
    ? inferenceDoc.data()
    : {
        modelProvider: "anthropic",
        modelId: "claude-sonnet-4-6",
        systemPrompt:
          "You are a helpful AI assistant. Be concise, accurate, and friendly.",
        timeoutMs: 30000,
        allowedTools: ["web_search", "code_execution"],
      };

  // Fetch Cloudflare tunnel token (stored separately)
  const cfDoc = await adminDb.doc(`orgs/${orgId}/cloudflare/tunnel`).get();
  const cloudflareTunnelToken = cfDoc.exists
    ? cfDoc.data()?.tunnelToken ?? ""
    : "";

  // Clear bootstrap token after use (one-time)
  await adminDb.doc(`orgs/${orgId}/runtime/default`).update({
    bootstrapToken: null,
    bootstrapTokenExpiresAt: null,
    status: "booting",
  });

  return NextResponse.json({
    instanceId,
    slackBotToken,
    inference,
    cloudflareTunnelToken,
  });
}
