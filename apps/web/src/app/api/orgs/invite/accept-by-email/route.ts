import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyIdToken, addMemberToOrg, getOrgMemberRole } from "@/lib/firebase/adminHelpers";

/**
 * POST /api/orgs/invite/accept-by-email
 * Called automatically on first sign-in via useAuth.
 * Finds all pending email-targeted invites for the user's email and accepts them.
 */
export async function POST(request: NextRequest) {
  const uid = await verifyIdToken(request.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  // Verify the email matches the authenticated user
  const userRecord = await adminAuth.getUser(uid);
  if (userRecord.email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
  }

  const snap = await adminDb
    .collection("orgInvites")
    .where("email", "==", email.toLowerCase())
    .where("status", "==", "pending")
    .get();

  let accepted = 0;
  for (const inviteDoc of snap.docs) {
    const d = inviteDoc.data();

    // Skip expired
    if (d.expiresAt && new Date(d.expiresAt) < new Date()) {
      await inviteDoc.ref.update({ status: "expired" });
      continue;
    }

    // Skip if already a member
    const existing = await getOrgMemberRole(d.orgId, uid);
    if (existing) {
      await inviteDoc.ref.update({
        status: "accepted",
        acceptedByUid: uid,
        acceptedAt: FieldValue.serverTimestamp(),
      });
      continue;
    }

    await addMemberToOrg(d.orgId, uid, d.role, {
      email: userRecord.email ?? "",
      displayName: userRecord.displayName ?? null,
      photoURL: userRecord.photoURL ?? null,
    });

    await inviteDoc.ref.update({
      status: "accepted",
      acceptedByUid: uid,
      acceptedAt: FieldValue.serverTimestamp(),
    });

    accepted++;
  }

  return NextResponse.json({ ok: true, accepted });
}
