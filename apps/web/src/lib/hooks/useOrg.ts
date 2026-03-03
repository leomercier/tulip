"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  orgConverter,
  runtimeConverter,
  slackConverter,
  commandConverter,
  orgMemberConverter,
  orgInviteConverter,
  billingAccountConverter,
  ledgerEntryConverter,
} from "@/lib/firebase/converters";
import type {
  Org,
  Runtime,
  SlackIntegration,
  RuntimeCommand,
  OrgMember,
  OrgInvite,
  BillingAccount,
  LedgerEntry,
} from "@tulip/types";
import { useOrgContext } from "@/lib/context/OrgContext";

// ─── Re-export context helpers so pages only need one import ──────────────────

export { useOrgContext };

/**
 * Backwards-compatible hook — returns the currently selected org for the user.
 */
export function useUserOrg(uid: string | undefined) {
  const { currentOrg, orgs, loading } = useOrgContext();
  const [legacyOrg, setLegacyOrg] = useState<Org | null>(null);
  const [legacyLoading, setLegacyLoading] = useState(true);

  useEffect(() => {
    // Only run the legacy path when the context reports no orgs and is still loading
    if (!uid || orgs.length > 0 || !loading) {
      setLegacyLoading(false);
      return;
    }

    const q = query(
      collection(db, "orgs").withConverter(orgConverter),
      where("ownerUid", "==", uid)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setLegacyOrg(snap.empty ? null : snap.docs[0]!.data());
      setLegacyLoading(false);
    });
    return unsubscribe;
  }, [uid, orgs.length, loading]);

  if (orgs.length > 0 || !loading) {
    return { org: currentOrg, loading: false };
  }
  return { org: legacyOrg, loading: legacyLoading };
}

// ─── Org members ──────────────────────────────────────────────────────────────

export function useOrgMembers(orgId: string | undefined) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "orgs", orgId, "members").withConverter(orgMemberConverter),
      orderBy("joinedAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map((d) => d.data()));
      setLoading(false);
    });
    return unsubscribe;
  }, [orgId]);

  return { members, loading };
}

// ─── Org invites ──────────────────────────────────────────────────────────────

export function useOrgInvites(orgId: string | undefined) {
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setInvites([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "orgInvites").withConverter(orgInviteConverter),
      where("orgId", "==", orgId),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setInvites(snap.docs.map((d) => d.data()));
      setLoading(false);
    });
    return unsubscribe;
  }, [orgId]);

  return { invites, loading };
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export function useBillingAccount(orgId: string | undefined) {
  const [billing, setBilling] = useState<BillingAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setBilling(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "orgs", orgId, "billing", "account").withConverter(billingAccountConverter);
    const unsubscribe = onSnapshot(ref, (snap) => {
      setBilling(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
    return unsubscribe;
  }, [orgId]);

  return { billing, loading };
}

export function useLedger(orgId: string | undefined, limitCount = 50) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "orgs", orgId, "billing", "ledger", "entries").withConverter(
        ledgerEntryConverter
      ),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => d.data()));
      setLoading(false);
    });
    return unsubscribe;
  }, [orgId, limitCount]);

  return { entries, loading };
}

// ─── Runtime ──────────────────────────────────────────────────────────────────

export function useRuntime(orgId: string | undefined) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setRuntime(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "orgs", orgId, "runtime", "current").withConverter(runtimeConverter);
    const unsubscribe = onSnapshot(ref, (snap) => {
      setRuntime(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
    return unsubscribe;
  }, [orgId]);

  return { runtime, loading };
}

// ─── Slack Integration ────────────────────────────────────────────────────────

export function useSlackIntegration(orgId: string | undefined) {
  const [slack, setSlack] = useState<SlackIntegration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setSlack(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "orgs", orgId, "integrations", "slack").withConverter(slackConverter);
    const unsubscribe = onSnapshot(ref, (snap) => {
      setSlack(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
    return unsubscribe;
  }, [orgId]);

  return { slack, loading };
}

// ─── Command history ──────────────────────────────────────────────────────────

export function useCommandHistory(instanceId: string | undefined) {
  const [commands, setCommands] = useState<RuntimeCommand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instanceId) {
      setCommands([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "runtimes", instanceId, "commands").withConverter(commandConverter),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setCommands(snap.docs.map((d) => d.data()));
      setLoading(false);
    });
    return unsubscribe;
  }, [instanceId]);

  return { commands, loading };
}
