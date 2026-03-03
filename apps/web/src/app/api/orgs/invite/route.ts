import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyIdToken, requireOrgMember } from "@/lib/firebase/adminHelpers";
import type { OrgRole } from "@tulip/types";

const INVITE_TTL_DAYS = 7;

/**
 * POST /api/orgs/invite
 * Body: { orgId, role, email? }
 *   - email omitted → open link invite (anyone with the link can accept)
 *   - email provided → targeted invite; auto-accepted on that user's first sign-in
 *
 * Returns: { inviteId, inviteUrl }
 */
export async function POST(request: NextRequest) {
  const uid = await verifyIdToken(request.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { orgId, role = "member", email } = body as {
    orgId: string;
    role?: OrgRole;
    email?: string;
  };

  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "role must be admin or member" }, { status: 400 });
  }

  try {
    // Must be at least an admin to invite
    await requireOrgMember(orgId, uid, "admin");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const orgSnap = await adminDb.doc(`orgs/${orgId}`).get();
  if (!orgSnap.exists) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const inviterSnap = await adminDb.doc(`users/${uid}`).get();
  const inviterName = inviterSnap.exists
    ? (inviterSnap.data()?.displayName ?? inviterSnap.data()?.email ?? null)
    : null;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const inviteRef = adminDb.collection("orgInvites").doc();
  await inviteRef.set({
    orgId,
    orgName: orgSnap.data()?.name ?? "",
    invitedByUid: uid,
    invitedByName: inviterName,
    email: email ?? null,
    role,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: expiresAt.toISOString(),
    acceptedByUid: null,
    acceptedAt: null,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.tulip.ai";
  const inviteUrl = `${baseUrl}/invite/${inviteRef.id}`;

  return NextResponse.json({ inviteId: inviteRef.id, inviteUrl });
}

/**
 * GET /api/orgs/invite?orgId=xxx
 * Returns all pending invites for an org (admin+).
 */
export async function GET(request: NextRequest) {
  const uid = await verifyIdToken(request.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  try {
    await requireOrgMember(orgId, uid, "admin");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const snap = await adminDb
    .collection("orgInvites")
    .where("orgId", "==", orgId)
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .get();

  const invites = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ invites });
}
