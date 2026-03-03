import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CommandType } from "@tulip/types";

const ALLOWED_COMMANDS: CommandType[] = [
  "restart_openclaw",
  "restart_cloudflared",
  "rebootstrap",
];

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
  const rtDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();

  if (!rtDoc.exists) {
    return NextResponse.json({ error: "No runtime" }, { status: 404 });
  }

  const { type } = await request.json() as { type?: CommandType };

  if (!type || !ALLOWED_COMMANDS.includes(type)) {
    return NextResponse.json(
      { error: `Invalid command. Allowed: ${ALLOWED_COMMANDS.join(", ")}` },
      { status: 400 }
    );
  }

  const instanceId: string = rtDoc.data()!.instanceId;

  const cmdRef = adminDb.collection(`runtimes/${instanceId}/commands`).doc();
  await cmdRef.set({
    type,
    status: "queued",
    createdAt: FieldValue.serverTimestamp(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
  });

  return NextResponse.json({ commandId: cmdRef.id });
}
