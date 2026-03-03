import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { addMemberToOrg, ensureBillingAccount } from "@/lib/firebase/adminHelpers";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  let displayName: string | undefined;
  let email: string | undefined;
  let photoURL: string | undefined;

  try {
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    displayName = decoded.name;
    email = decoded.email;
    const userRecord = await adminAuth.getUser(uid);
    photoURL = userRecord.photoURL;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // If user is already a member of an org (via profile), return that org
  const profileSnap = await adminDb.doc(`users/${uid}`).get();
  const profileData = profileSnap.data();
  if (profileData?.orgIds?.length > 0) {
    return NextResponse.json({ orgId: profileData.orgIds[0], existed: true });
  }

  // Legacy: check ownerUid
  const existing = await adminDb
    .collection("orgs")
    .where("ownerUid", "==", uid)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    // Back-fill member record and billing if missing
    await addMemberToOrg(doc.id, uid, "owner", {
      email: email ?? "",
      displayName: displayName ?? null,
      photoURL: photoURL ?? null,
    }).catch(() => {}); // idempotent — ignore if already exists
    return NextResponse.json({ orgId: doc.id, existed: true });
  }

  const body = await request.json().catch(() => ({}));
  const orgName = (body.name as string | undefined)?.trim() || displayName || email || "My Org";

  const orgRef = adminDb.collection("orgs").doc();
  await orgRef.set({
    name: orgName,
    ownerUid: uid,
    createdAt: FieldValue.serverTimestamp(),
    status: "active",
    memberCount: 1,
  });

  // Add creator as owner member, bootstrap billing
  await addMemberToOrg(orgRef.id, uid, "owner", {
    email: email ?? "",
    displayName: displayName ?? null,
    photoURL: photoURL ?? null,
  });

  await ensureBillingAccount(orgRef.id);

  return NextResponse.json({ orgId: orgRef.id, existed: false });
}
