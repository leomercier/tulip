import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CommandResultPayload } from "@tulip/types";

/**
 * POST /api/runtime/commandResult
 *
 * Called by the runtime agent after executing a command.
 * Authenticates via runtimeAuthToken; resolves the command to done/error.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<CommandResultPayload>;
  const { commandId, instanceId, authToken, status, result, error } = body;

  if (!commandId || !instanceId || !authToken || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (status !== "done" && status !== "error") {
    return NextResponse.json({ error: "status must be done or error" }, { status: 400 });
  }

  // Validate agent auth
  const instanceDoc = await adminDb.doc(`runtimes/${instanceId}`).get();
  if (!instanceDoc.exists) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const orgId: string = instanceDoc.data()!.orgId;
  const rtDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();

  if (!rtDoc.exists || rtDoc.data()?.runtimeAuthToken !== authToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await adminDb.doc(`runtimes/${instanceId}/commands/${commandId}`).update({
    status,
    completedAt: FieldValue.serverTimestamp(),
    ...(result !== undefined ? { result } : {}),
    ...(error !== undefined ? { error } : {}),
  });

  return NextResponse.json({ ok: true });
}
