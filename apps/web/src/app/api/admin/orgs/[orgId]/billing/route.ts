import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyIdToken, isSuperAdmin } from "@/lib/firebase/adminHelpers";

/**
 * GET /api/admin/orgs/[orgId]/billing
 * Returns billing account + recent ledger for a specific org.
 * Requires superAdmin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const uid = await verifyIdToken(request.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isSuperAdmin(uid))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;

  const [orgSnap, billingSnap, ledgerSnap] = await Promise.all([
    adminDb.doc(`orgs/${orgId}`).get(),
    adminDb.doc(`orgs/${orgId}/billing/account`).get(),
    adminDb
      .collection(`orgs/${orgId}/billing/ledger/entries`)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get(),
  ]);

  if (!orgSnap.exists) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const entries = ledgerSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
  }));

  return NextResponse.json({
    org: { id: orgId, name: orgSnap.data()?.name },
    billing: billingSnap.exists ? billingSnap.data() : null,
    entries,
  });
}
