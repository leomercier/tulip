/**
 * Shared server-side helpers for API routes.
 * Keeps auth, org membership checks, and billing ops in one place.
 */
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { OrgRole } from "@tulip/types";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function verifyIdToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

// ─── User profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string) {
  return adminDb.doc(`users/${uid}`).get();
}

export async function isSuperAdmin(uid: string): Promise<boolean> {
  const snap = await getUserProfile(uid);
  return snap.exists && (snap.data()?.superAdmin ?? false) === true;
}

// ─── Org membership ───────────────────────────────────────────────────────────

export async function getOrgMemberRole(orgId: string, uid: string): Promise<OrgRole | null> {
  const snap = await adminDb.doc(`orgs/${orgId}/members/${uid}`).get();
  if (!snap.exists) return null;
  return (snap.data()?.role as OrgRole) ?? null;
}

export async function requireOrgMember(
  orgId: string,
  uid: string,
  minRole: OrgRole = "member"
): Promise<OrgRole> {
  const role = await getOrgMemberRole(orgId, uid);
  if (!role) throw new Error("Not a member of this organisation");
  const order: OrgRole[] = ["member", "admin", "owner"];
  if (order.indexOf(role) < order.indexOf(minRole)) {
    throw new Error("Insufficient permissions");
  }
  return role;
}

// ─── Billing helpers ──────────────────────────────────────────────────────────

const INITIAL_CREDITS = 0;

/**
 * Creates billing/account if it doesn't exist, then adds credits and records
 * a ledger entry atomically using a Firestore transaction.
 */
export async function addCredits(
  orgId: string,
  amount: number,
  description: string,
  createdByUid: string | null,
  type: import("@tulip/types").LedgerEntryType = "credit_grant",
  metadata: Record<string, unknown> = {}
): Promise<{ newBalance: number }> {
  const accountRef = adminDb.doc(`orgs/${orgId}/billing/account`);
  const ledgerRef = adminDb
    .collection(`orgs/${orgId}/billing/ledger/entries`)
    .doc();

  const newBalance = await adminDb.runTransaction(async (tx) => {
    const accountSnap = await tx.get(accountRef);
    const current: number = accountSnap.exists
      ? (accountSnap.data()?.credits ?? INITIAL_CREDITS)
      : INITIAL_CREDITS;
    const next = current + amount;

    if (accountSnap.exists) {
      tx.update(accountRef, {
        credits: next,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(accountRef, {
        orgId,
        credits: next,
        currencyCode: "USD",
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(ledgerRef, {
      orgId,
      type,
      amount,
      balanceAfter: next,
      description,
      createdAt: FieldValue.serverTimestamp(),
      createdByUid,
      metadata,
    });

    return next;
  });

  return { newBalance };
}

/**
 * Ensures billing/account exists for a new org.
 */
export async function ensureBillingAccount(orgId: string): Promise<void> {
  const ref = adminDb.doc(`orgs/${orgId}/billing/account`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      orgId,
      credits: INITIAL_CREDITS,
      currencyCode: "USD",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

// ─── Invite helpers ───────────────────────────────────────────────────────────

/**
 * Adds a user to an org:
 * - Creates orgs/{orgId}/members/{uid}
 * - Appends orgId to users/{uid}.orgIds
 * - Increments orgs/{orgId}.memberCount
 * - Ensures billing/account exists
 */
export async function addMemberToOrg(
  orgId: string,
  uid: string,
  role: OrgRole,
  memberData: {
    email: string;
    displayName: string | null;
    photoURL: string | null;
  }
): Promise<void> {
  const batch = adminDb.batch();

  batch.set(adminDb.doc(`orgs/${orgId}/members/${uid}`), {
    uid,
    email: memberData.email,
    displayName: memberData.displayName ?? null,
    photoURL: memberData.photoURL ?? null,
    role,
    joinedAt: FieldValue.serverTimestamp(),
  });

  batch.update(adminDb.doc(`users/${uid}`), {
    orgIds: FieldValue.arrayUnion(orgId),
  });

  batch.update(adminDb.doc(`orgs/${orgId}`), {
    memberCount: FieldValue.increment(1),
  });

  await batch.commit();
  await ensureBillingAccount(orgId);
}

export async function removeMemberFromOrg(orgId: string, uid: string): Promise<void> {
  const batch = adminDb.batch();

  batch.delete(adminDb.doc(`orgs/${orgId}/members/${uid}`));

  batch.update(adminDb.doc(`users/${uid}`), {
    orgIds: FieldValue.arrayRemove(orgId),
  });

  batch.update(adminDb.doc(`orgs/${orgId}`), {
    memberCount: FieldValue.increment(-1),
  });

  await batch.commit();
}
