import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");

  const sa = JSON.parse(raw);

  // Only needed if your env var has \\n sequences
  if (typeof sa.private_key === "string") {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }

  return sa;
}

function getAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  return initializeApp({
    credential: cert(getServiceAccount())
  });
}

export const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp, "default");
