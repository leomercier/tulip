"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { orgConverter, runtimeConverter, slackConverter } from "@/lib/firebase/converters";
import type { Org, Runtime, SlackIntegration } from "@tulip/types";

export function useUserOrg(uid: string | undefined) {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setOrg(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "orgs").withConverter(orgConverter),
      where("ownerUid", "==", uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setOrg(null);
      } else {
        setOrg(snap.docs[0]!.data());
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [uid]);

  return { org, loading };
}

export function useRuntime(orgId: string | undefined) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setRuntime(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "orgs", orgId, "runtime", "default").withConverter(
      runtimeConverter
    );

    const unsubscribe = onSnapshot(ref, (snap) => {
      setRuntime(snap.exists() ? snap.data() : null);
      setLoading(false);
    });

    return unsubscribe;
  }, [orgId]);

  return { runtime, loading };
}

export function useSlackIntegration(orgId: string | undefined) {
  const [slack, setSlack] = useState<SlackIntegration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setSlack(null);
      setLoading(false);
      return;
    }

    const ref = doc(
      db,
      "orgs",
      orgId,
      "integrations",
      "slack"
    ).withConverter(slackConverter);

    const unsubscribe = onSnapshot(ref, (snap) => {
      setSlack(snap.exists() ? snap.data() : null);
      setLoading(false);
    });

    return unsubscribe;
  }, [orgId]);

  return { slack, loading };
}
