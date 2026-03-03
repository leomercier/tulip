import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
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
  const runtimeDoc = await adminDb.doc(`orgs/${orgId}/runtime/current`).get();

  if (!runtimeDoc.exists) {
    return NextResponse.json({ commands: [] });
  }

  const { instanceId } = runtimeDoc.data()!;

  const snap = await adminDb
    .collection(`runtimes/${instanceId}/commands`)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  const commands = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ commands });
}
