import "server-only";
import type { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { AccessGrant } from "@/lib/types";
import { effectiveStatus } from "@/lib/access";

// Bearer Firebase ID token → decoded claims, or null. Shared by every API route.
export async function requireUser(req: NextRequest): Promise<DecodedIdToken | null> {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!idToken) return null;
  try { return await adminAuth().verifyIdToken(idToken); } catch { return null; }
}

export async function requireAdmin(req: NextRequest): Promise<DecodedIdToken | null> {
  const u = await requireUser(req);
  return u?.admin === true ? u : null;
}

// A member who may use the CareerOps portal: signed in, access currently active, and
// the admin has switched features.careerOps on for them. Checked on every
// CareerOps API route so the flag can't be bypassed by guessing a URL.
export async function requireAgentsMember(req: NextRequest): Promise<{ user: DecodedIdToken; grant: AccessGrant } | null> {
  const user = await requireUser(req);
  if (!user) return null;
  const snap = await adminDb().doc(`accessGrants/${user.uid}`).get();
  if (!snap.exists) return null;
  const grant = snap.data() as AccessGrant;
  if (effectiveStatus(grant) !== "active") return null;
  if (!grant.features?.careerOps && user.admin !== true) return null;
  return { user, grant };
}
