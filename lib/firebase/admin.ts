import "server-only";
import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Service account is provided as base64-encoded JSON in FIREBASE_SERVICE_ACCOUNT_B64.
function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_B64 is not set. Generate a service account key in the " +
        "Firebase console and set it (base64-encoded) before using server-side Firebase."
    );
  }
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

let _app: App | null = null;
function adminApp(): App {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp({ credential: cert(loadServiceAccount()) });
  return _app;
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
