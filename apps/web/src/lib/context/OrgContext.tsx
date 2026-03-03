"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { orgConverter, userProfileConverter } from "@/lib/firebase/converters";
import type { Org, UserProfile } from "@tulip/types";

// ─── Storage key for the currently selected org ───────────────────────────────

const CURRENT_ORG_KEY = "tulip_current_org";

// ─── Context shape ────────────────────────────────────────────────────────────

interface OrgContextValue {
  orgs: Org[];
  currentOrg: Org | null;
  profile: UserProfile | null;
  loading: boolean;
  setCurrentOrgId: (orgId: string) => void;
}

const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  currentOrg: null,
  profile: null,
  loading: true,
  setCurrentOrgId: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OrgProvider({ uid, children }: { uid: string | null; children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(CURRENT_ORG_KEY);
  });
  const [loading, setLoading] = useState(true);

  // Listen to user profile (gives us orgIds + superAdmin flag)
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setOrgs([]);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", uid).withConverter(userProfileConverter);
    const unsubscribe = onSnapshot(ref, (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
    });
    return unsubscribe;
  }, [uid]);

  // When profile changes, subscribe to the orgs this user belongs to.
  // Superadmins keep the profile-driven subscription for their personal orgs;
  // they can view any org via the admin panel separately.
  useEffect(() => {
    if (!uid) {
      setOrgs([]);
      setLoading(false);
      return;
    }

    if (!profile) {
      // Profile not yet loaded — also check legacy ownerUid orgs as fallback
      const q = query(
        collection(db, "orgs").withConverter(orgConverter),
        where("ownerUid", "==", uid)
      );
      const unsubscribe = onSnapshot(q, (snap) => {
        setOrgs(snap.docs.map((d) => d.data()));
        setLoading(false);
      });
      return unsubscribe;
    }

    if (profile.orgIds.length === 0) {
      // New user with no orgs yet — check legacy ownerUid for backwards compat
      const q = query(
        collection(db, "orgs").withConverter(orgConverter),
        where("ownerUid", "==", uid)
      );
      const unsubscribe = onSnapshot(q, (snap) => {
        setOrgs(snap.docs.map((d) => d.data()));
        setLoading(false);
      });
      return unsubscribe;
    }

    // Firestore `in` supports up to 30 items; slice if needed
    const ids = profile.orgIds.slice(0, 30);
    const q = query(
      collection(db, "orgs").withConverter(orgConverter),
      where("__name__", "in", ids)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      // Preserve order of profile.orgIds
      const byId = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
      setOrgs(ids.map((id) => byId[id]).filter(Boolean) as Org[]);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid, profile]);

  const setCurrentOrgId = useCallback((orgId: string) => {
    localStorage.setItem(CURRENT_ORG_KEY, orgId);
    setCurrentOrgIdState(orgId);
  }, []);

  // Auto-select: if no persisted selection, or persisted id not in list, pick first
  const currentOrg =
    (currentOrgId ? orgs.find((o) => o.id === currentOrgId) ?? orgs[0] : orgs[0]) ?? null;

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, profile, loading, setCurrentOrgId }}>
      {children}
    </OrgContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useOrgContext(): OrgContextValue {
  return useContext(OrgContext);
}
