import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyIdToken, addMemberToOrg, getOrgMemberRole } from "@/lib/firebase/adminHelpers";

/**
 * POST /api/orgs/invite/[inviteId]/accept
 * Authenticated — the calling user accepts the invite and is added to the org.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const uid = await verifyIdToken(request.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId } = await params;
  const inviteRef = adminDb.doc(`orgInvites/${inviteId}`);
  const snap = await inviteRef.get();

  if (!snap.exists) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  const d = snap.data()!;

  if (d.status !== "pending") {
    return NextResponse.json({ error: "Invite is no longer valid", status: d.status }, { status: 410 });
  }
  if (d.expiresAt && new Date(d.expiresAt) < new Date()) {
    await inviteRef.update({ status: "expired" });
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // For email-targeted invites, verify the signed-in user's email matches
  if (d.email) {
    const userRecord = await adminAuth.getUser(uid);
    if (userRecord.email?.toLowerCase() !== d.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address" },
        { status: 403 }
      );
    }
  }

  // Check if already a member
  const existingRole = await getOrgMemberRole(d.orgId, uid);
  if (existingRole) {
    // Already a member — just mark invite accepted and return
    await inviteRef.update({
      status: "accepted",
      acceptedByUid: uid,
      acceptedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, orgId: d.orgId, alreadyMember: true });
  }

  // Add user to org
  const userRecord = await adminAuth.getUser(uid);
  await addMemberToOrg(d.orgId, uid, d.role, {
    email: userRecord.email ?? "",
    displayName: userRecord.displayName ?? null,
    photoURL: userRecord.photoURL ?? null,
  });

  // Mark invite accepted
  await inviteRef.update({
    status: "accepted",
    acceptedByUid: uid,
    acceptedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, orgId: d.orgId });
}
