"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
<<<<<<< HEAD
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setState({ user, loading: false });
        if (user) {
          ensureUserProfile(user).catch(() => {});
        }
      },
      (error) => {
        // Auth initialisation failed (e.g. missing/invalid Firebase config)
        console.error("[useAuth] onAuthStateChanged error:", error);
        setState({ user: null, loading: false });
=======
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user);
      if (user) {
        // Ensure a UserProfile document exists — create on first sign-in
        await ensureUserProfile(user);
>>>>>>> af13161 (sort bugs)
      }
    );
    return unsubscribe;
  }, []);

  return state;
}

/**
 * Creates a users/{uid} document on first sign-in.
 * Idempotent — uses setDoc with merge so subsequent sign-ins only update
 * mutable fields (displayName, photoURL) without clobbering superAdmin or orgIds.
 */
async function ensureUserProfile(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid);
  console.log("Ensuring user profile exists for:", user.uid);
  const snap = await getDoc(ref);
  console.log("Checking user profile for:", user.uid, "Exists:", snap.exists());

  if (!snap.exists()) {
    console.log("Creating user profile for new user:", user.uid);
    // Brand-new user — create profile
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      superAdmin: false,
      orgIds: [],
      createdAt: serverTimestamp()
    });

    // Notify server to auto-accept any pending email invites for this address
    if (user.email) {
      try {
        const idToken = await user.getIdToken();
        await fetch("/api/orgs/invite/accept-by-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({ email: user.email })
        });
      } catch {
        // Non-fatal — invites can be accepted manually
      }
    }
  } else {
    // Update mutable fields on subsequent sign-ins
    await setDoc(
      ref,
      {
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        email: user.email ?? ""
      },
      { merge: true }
    );
  }
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
