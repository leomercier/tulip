import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyIdToken, isSuperAdmin } from "@/lib/firebase/adminHelpers";

/**
 * GET /api/admin/orgs
 * Returns all orgs with their member count and billing summary.
 * Requires superAdmin.
 */
export async function GET(request: NextRequest) {
  const uid = await verifyIdToken(request.headers.get("Authorization"));
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isSuperAdmin(uid))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgsSnap = await adminDb.collection("orgs").orderBy("createdAt", "desc").get();

  const orgs = await Promise.all(
    orgsSnap.docs.map(async (orgDoc) => {
      const data = orgDoc.data();
      const billingSnap = await adminDb.doc(`orgs/${orgDoc.id}/billing/account`).get();
      const billing = billingSnap.exists ? billingSnap.data() : null;
      return {
        id: orgDoc.id,
        name: data.name,
        ownerUid: data.ownerUid,
        status: data.status,
        memberCount: data.memberCount ?? 1,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        billing: billing
          ? {
              credits: billing.credits ?? 0,
              status: billing.status ?? "active",
              currencyCode: billing.currencyCode ?? "USD",
            }
          : null,
      };
    })
  );

  return NextResponse.json({ orgs });
}
