import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, isSuperAdmin, addCredits } from "@/lib/firebase/adminHelpers";
import { adminDb } from "@/lib/firebase/admin";

/**
 * POST /api/admin/orgs/[orgId]/billing/credit
 * Body: { amount: number, description?: string }
 *   amount is in credits (integer). 1 credit = $0.01 USD.
 *   Positive = add credits, negative = deduct (use sparingly).
 * Requires superAdmin.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const uid = await verifyIdToken(request.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isSuperAdmin(uid))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const orgSnap = await adminDb.doc(`orgs/${orgId}`).get();
  if (!orgSnap.exists) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await request.json();
  const { amount, description } = body as { amount: number; description?: string };

  if (typeof amount !== "number" || !Number.isInteger(amount) || amount === 0) {
    return NextResponse.json({ error: "amount must be a non-zero integer" }, { status: 400 });
  }

  const type = amount > 0 ? "credit_grant" : "adjustment";
  const desc = description?.trim() || (amount > 0 ? `Manual credit grant` : `Manual credit adjustment`);

  const { newBalance } = await addCredits(orgId, amount, desc, uid, type, {
    grantedByUid: uid,
    orgName: orgSnap.data()?.name ?? "",
  });

  return NextResponse.json({ ok: true, newBalance });
}
