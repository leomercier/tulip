import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyIdToken, requireOrgMember } from "@/lib/firebase/adminHelpers";

/**
 * GET /api/orgs/invite/[inviteId]
 * Public — returns invite details so the acceptance page can show org name etc.
 * Does NOT require auth.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const { inviteId } = await params;
  const snap = await adminDb.doc(`orgInvites/${inviteId}`).get();

  if (!snap.exists) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const d = snap.data()!;

  // Check expiry
  if (d.status !== "pending") {
    return NextResponse.json({ error: "Invite is no longer valid", status: d.status }, { status: 410 });
  }
  if (d.expiresAt && new Date(d.expiresAt) < new Date()) {
    await snap.ref.update({ status: "expired" });
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  return NextResponse.json({
    invite: {
      id: snap.id,
      orgId: d.orgId,
      orgName: d.orgName,
      invitedByName: d.invitedByName,
      role: d.role,
      email: d.email,
      expiresAt: d.expiresAt,
    },
  });
}

/**
 * DELETE /api/orgs/invite/[inviteId]
 * Cancels a pending invite. Must be an admin of the org.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const uid = await verifyIdToken(request.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId } = await params;
  const snap = await adminDb.doc(`orgInvites/${inviteId}`).get();

  if (!snap.exists) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  const d = snap.data()!;

  try {
    await requireOrgMember(d.orgId, uid, "admin");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  await snap.ref.update({ status: "cancelled" });
  return NextResponse.json({ ok: true });
}
