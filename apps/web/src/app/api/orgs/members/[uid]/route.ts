import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  verifyIdToken,
  requireOrgMember,
  getOrgMemberRole,
  removeMemberFromOrg,
} from "@/lib/firebase/adminHelpers";
import type { OrgRole } from "@tulip/types";

/**
 * PATCH /api/orgs/members/[uid]?orgId=xxx
 * Body: { role: "admin" | "member" }
 * Changes a member's role. Requires admin. Cannot demote the owner.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const callerId = await verifyIdToken(request.headers.get("Authorization"));
  if (!callerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uid: targetUid } = await params;
  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const body = await request.json();
  const { role } = body as { role: OrgRole };

  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "role must be admin or member" }, { status: 400 });
  }

  try {
    await requireOrgMember(orgId, callerId, "admin");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const targetRole = await getOrgMemberRole(orgId, targetUid);
  if (!targetRole) return NextResponse.json({ error: "User is not a member" }, { status: 404 });
  if (targetRole === "owner") {
    return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 400 });
  }

  await adminDb.doc(`orgs/${orgId}/members/${targetUid}`).update({ role });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/orgs/members/[uid]?orgId=xxx
 * Removes a member from the org. Admins can remove members; owners can remove admins.
 * Users can remove themselves (leave org).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const callerId = await verifyIdToken(request.headers.get("Authorization"));
  if (!callerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uid: targetUid } = await params;
  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const callerRole = await getOrgMemberRole(orgId, callerId);
  const targetRole = await getOrgMemberRole(orgId, targetUid);

  if (!targetRole) return NextResponse.json({ error: "User is not a member" }, { status: 404 });
  if (targetRole === "owner") {
    return NextResponse.json({ error: "Cannot remove the owner" }, { status: 400 });
  }

  // Allow self-removal (leave), or admin/owner removing others
  const isSelf = callerId === targetUid;
  const callerOrder = ["member", "admin", "owner"].indexOf(callerRole ?? "member");
  const targetOrder = ["member", "admin", "owner"].indexOf(targetRole);

  if (!isSelf && callerOrder <= targetOrder) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  await removeMemberFromOrg(orgId, targetUid);
  return NextResponse.json({ ok: true });
}
