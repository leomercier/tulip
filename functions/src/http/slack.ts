import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHmac, timingSafeEqual } from "crypto";
import { encryptToken } from "../services/crypto";
import { getRuntimeDoc, updateRuntimeDoc } from "../db/runtime";

const APP_URL = process.env.CONTROL_PLANE_BASE_URL ?? "https://agents.tulip.ai";

const SCOPES = [
  "app_mentions:read",
  "channels:history",
  "channels:read",
  "chat:write",
  "commands",
  "groups:history",
  "groups:read",
  "im:history",
  "im:read",
  "im:write",
  "team:read",
  "users:read",
].join(",");

// ─── GET /slack/install ───────────────────────────────────────────────────────

export const install = onRequest((req, res) => {
  const { orgId } = req.query as { orgId?: string };
  if (!orgId) {
    res.status(400).json({ error: "orgId required" });
    return;
  }

  const state = Buffer.from(JSON.stringify({ orgId })).toString("base64url");
  const clientId = process.env.SLACK_CLIENT_ID!;

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", `${APP_URL}/slack/callback`);
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

// ─── GET /slack/callback ──────────────────────────────────────────────────────

export const callback = onRequest(async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`${APP_URL}/app/integrations?error=slack_denied`);
  }
  if (!code || !state) {
    return res.redirect(`${APP_URL}/app/integrations?error=invalid_callback`);
  }

  let orgId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    orgId = decoded.orgId;
  } catch {
    return res.redirect(`${APP_URL}/app/integrations?error=invalid_state`);
  }

  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${APP_URL}/slack/callback`,
    }),
  });

  const tokenData = (await tokenRes.json()) as {
    ok: boolean;
    access_token: string;
    team: { id: string; name: string };
    error?: string;
  };

  if (!tokenData.ok) {
    console.error("Slack OAuth error:", tokenData.error);
    return res.redirect(`${APP_URL}/app/integrations?error=slack_oauth_failed`);
  }

  const botTokenEncrypted = encryptToken(tokenData.access_token);

  await getFirestore()
    .doc(`orgs/${orgId}/integrations/slack`)
    .set({
      teamId: tokenData.team.id,
      teamName: tokenData.team.name,
      botTokenEncrypted,
      installedAt: FieldValue.serverTimestamp(),
    });

  return res.redirect(`${APP_URL}/app/integrations?success=slack_connected`);
});

// ─── POST /slack/events ───────────────────────────────────────────────────────

export const events = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawBody = JSON.stringify(req.body);
  const timestamp = req.headers["x-slack-request-timestamp"] as string ?? "";
  const signature = req.headers["x-slack-signature"] as string ?? "";
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;

  // Verify signature
  const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp) < fiveMinAgo) {
    res.status(401).json({ error: "Request too old" });
    return;
  }

  const sigBase = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", signingSecret).update(sigBase).digest("hex")}`;

  let valid = false;
  try {
    valid = timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    valid = false;
  }

  if (!valid) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const payload = req.body as {
    type: string;
    challenge?: string;
    team_id?: string;
    event?: { type: string };
  };

  if (payload.type === "url_verification") {
    res.json({ challenge: payload.challenge });
    return;
  }

  // Handle app_uninstalled
  if (payload.event?.type === "app_uninstalled" && payload.team_id) {
    const teamId = payload.team_id;
    const db = getFirestore();
    const orgsSnap = await db.collection("orgs").get();

    for (const orgDoc of orgsSnap.docs) {
      const slackDoc = await db.doc(`orgs/${orgDoc.id}/integrations/slack`).get();
      if (slackDoc.exists && slackDoc.data()?.teamId === teamId) {
        // Trigger runtime deletion
        const runtime = await getRuntimeDoc(orgDoc.id);
        if (runtime && runtime.status !== "deleting") {
          await updateRuntimeDoc(orgDoc.id, { status: "deleting" });
          // Full deletion handled by a separate trigger or scheduled function
        }
        await slackDoc.ref.delete();
        break;
      }
    }
  }

  res.json({ ok: true });
});
