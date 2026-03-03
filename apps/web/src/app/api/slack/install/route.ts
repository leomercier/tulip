import { NextRequest, NextResponse } from "next/server";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const state = Buffer.from(JSON.stringify({ orgId })).toString("base64url");

  const slackUrl = new URL("https://slack.com/oauth/v2/authorize");
  slackUrl.searchParams.set("client_id", SLACK_CLIENT_ID);
  slackUrl.searchParams.set("scope", SCOPES);
  slackUrl.searchParams.set("redirect_uri", `${APP_URL}/api/slack/callback`);
  slackUrl.searchParams.set("state", state);

  return NextResponse.redirect(slackUrl.toString());
}
