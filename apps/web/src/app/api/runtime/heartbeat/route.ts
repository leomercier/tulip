import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { HeartbeatPayload } from "@tulip/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<HeartbeatPayload>;
  const { instanceId, orgId, authToken, checks, version } = body;

  if (!instanceId || !orgId || !authToken) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const rtDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();

  if (!rtDoc.exists || rtDoc.data()?.instanceId !== instanceId) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // Validate runtime auth token
  if (rtDoc.data()?.runtimeAuthToken !== authToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentStatus: string = rtDoc.data()?.status ?? "booting";
  const openclawOk = checks?.openclaw?.ok ?? null;
  const cloudflaredOk = checks?.cloudflared?.ok ?? null;

  const update: Record<string, unknown> = {
    lastHeartbeatAt: FieldValue.serverTimestamp(),
    openclawHealthy: openclawOk,
    cloudflaredHealthy: cloudflaredOk,
  };

  // Transition booting → ready on first heartbeat from the agent.
  // openclaw/cloudflared health is tracked separately via openclawHealthy/cloudflaredHealthy —
  // don't block on them since Docker image pull and tunnel establishment can take minutes.
  if (currentStatus === "booting") {
    update.status = "ready";
  }

  await rtDoc.ref.update(update);

  // Update instance-level metadata
  if (version) {
    await adminDb.doc(`runtimes/${instanceId}`).set(
      {
        agentVersion: version.agent ?? null,
        openclawImage: version.openclawImage ?? null,
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true });
}
