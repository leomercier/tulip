import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET /api/runtime/commands?instanceId=tulip-xxx
 *
 * Polled by the runtime agent every COMMAND_POLL_INTERVAL_SEC seconds.
 * Authenticates via the runtimeAuthToken issued at bootstrap.
 * Returns queued commands and atomically marks them as "running".
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");

  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }

  // Validate agent auth token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authToken = authHeader.slice(7);

  // Look up which org owns this instance
  const instanceDoc = await adminDb.doc(`runtimes/${instanceId}`).get();
  if (!instanceDoc.exists) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const orgId: string = instanceDoc.data()!.orgId;
  const rtDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();

  if (!rtDoc.exists || rtDoc.data()?.runtimeAuthToken !== authToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch queued commands
  const snap = await adminDb
    .collection(`runtimes/${instanceId}/commands`)
    .where("status", "==", "queued")
    .orderBy("createdAt", "asc")
    .limit(10)
    .get();

  if (snap.empty) {
    return NextResponse.json({ commands: [] });
  }

  // Mark as running atomically so they aren't picked up on the next poll
  const batch = adminDb.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      status: "running",
      startedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  const commands = snap.docs.map((d) => ({
    id: d.id,
    type: d.data().type,
  }));

  return NextResponse.json({ commands });
}
