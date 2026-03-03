import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  let displayName: string | undefined;
  let email: string | undefined;

  try {
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    displayName = decoded.name;
    email = decoded.email;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Check if org already exists for this user
  const existing = await adminDb
    .collection("orgs")
    .where("ownerUid", "==", uid)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    return NextResponse.json({ orgId: doc.id, existed: true });
  }

  const { name } = await request.json().catch(() => ({}));

  const orgRef = await adminDb.collection("orgs").add({
    name: name ?? displayName ?? email ?? "My Org",
    ownerUid: uid,
    createdAt: FieldValue.serverTimestamp(),
    status: "active",
  });

  return NextResponse.json({ orgId: orgRef.id, existed: false });
}
