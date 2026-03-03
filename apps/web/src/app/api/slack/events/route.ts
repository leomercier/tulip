import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET!;

function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;

  const sigBase = `v0:${timestamp}:${body}`;
  const expected = `v0=${createHmac("sha256", SIGNING_SECRET).update(sigBase).digest("hex")}`;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // URL verification challenge
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const event = payload.event;

  // Handle app_uninstalled — trigger runtime deletion
  if (event?.type === "app_uninstalled") {
    const teamId: string = payload.team_id;
    // Find org by teamId
    const orgsSnap = await adminDb
      .collection("orgs")
      .get();

    for (const orgDoc of orgsSnap.docs) {
      const slackDoc = await adminDb
        .doc(`orgs/${orgDoc.id}/integrations/slack`)
        .get();

      if (slackDoc.exists && slackDoc.data()?.teamId === teamId) {
        // Queue deletion via Firestore — Cloud Function handles actual droplet teardown
        await adminDb.doc(`orgs/${orgDoc.id}/runtime/current`).set(
          { status: "deleting" },
          { merge: true }
        );
        await slackDoc.ref.delete();
        break;
      }
    }
  }

  return NextResponse.json({ ok: true });
}
