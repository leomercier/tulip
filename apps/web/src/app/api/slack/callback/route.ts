import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { createCipheriv, randomBytes, createHash } from "crypto";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!;

function encryptToken(plaintext: string): string {
  // AES-256-GCM encryption for Slack bot tokens
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // iv:authTag:ciphertext — all base64
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${APP_URL}/app/integrations?error=slack_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/app/integrations?error=invalid_callback`);
  }

  let orgId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    orgId = decoded.orgId;
  } catch {
    return NextResponse.redirect(`${APP_URL}/app/integrations?error=invalid_state`);
  }

  // Exchange code for token
  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: `${APP_URL}/api/slack/callback`,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.ok) {
    console.error("Slack OAuth error:", tokenData.error);
    return NextResponse.redirect(`${APP_URL}/app/integrations?error=slack_oauth_failed`);
  }

  const botToken: string = tokenData.access_token;
  const teamId: string = tokenData.team.id;
  const teamName: string = tokenData.team.name;

  // Encrypt token before storing
  const botTokenEncrypted = encryptToken(botToken);

  // Persist to Firestore
  await adminDb
    .doc(`orgs/${orgId}/integrations/slack`)
    .set({
      teamId,
      teamName,
      botTokenEncrypted,
      installedAt: FieldValue.serverTimestamp(),
    });

  return NextResponse.redirect(`${APP_URL}/app/integrations?success=slack_connected`);
}
