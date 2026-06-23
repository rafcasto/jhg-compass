import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface RegistrationLink {
  token: string;
  createdBy: string;
  accessDurationDays: number; // access granted on signup (default 90)
  expiresAt: number;          // when the LINK stops working
  maxUses: number;            // how many signups the link allows (default 1)
  uses: number;
  email: string | null;       // optional: lock the link to one email
  status: "active" | "used" | "expired";
  createdAt: number;
}

// Admin creates a time-boxed registration link (req 8).
export async function createRegistrationLink(
  adminUid: string,
  opts: { expiryHours?: number; accessDurationDays?: number; maxUses?: number; email?: string | null }
): Promise<RegistrationLink> {
  const token = globalThis.crypto.randomUUID().replace(/-/g, "");
  const now = Date.now();
  const link: RegistrationLink = {
    token,
    createdBy: adminUid,
    accessDurationDays: opts.accessDurationDays ?? 90,
    expiresAt: now + (opts.expiryHours ?? 48) * HOUR,
    maxUses: opts.maxUses ?? 1,
    uses: 0,
    email: opts.email?.trim() || null,
    status: "active",
    createdAt: now,
  };
  await adminDb().doc(`registrationLinks/${token}`).set(link);
  return link;
}

export async function listRegistrationLinks(limit = 20): Promise<RegistrationLink[]> {
  const snap = await adminDb().collection("registrationLinks").orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => d.data() as RegistrationLink);
}

interface ValidationResult {
  valid: boolean;
  reason?: "not_found" | "expired" | "used";
  email?: string | null;
  accessDurationDays?: number;
}

export async function validateLink(token: string): Promise<ValidationResult> {
  const ref = adminDb().doc(`registrationLinks/${token}`);
  const snap = await ref.get();
  if (!snap.exists) return { valid: false, reason: "not_found" };
  const link = snap.data() as RegistrationLink;
  const now = Date.now();
  if (now > link.expiresAt) {
    if (link.status !== "expired") await ref.set({ status: "expired" }, { merge: true });
    return { valid: false, reason: "expired" };
  }
  if (link.uses >= link.maxUses || link.status === "used") return { valid: false, reason: "used" };
  return { valid: true, email: link.email, accessDurationDays: link.accessDurationDays };
}

interface CompleteResult {
  ok: boolean;
  uid?: string;
  error?: string;
}

// Consumes the link: create the user, grant 90-day access, mark link used.
export async function completeRegistration(
  token: string,
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<CompleteResult> {
  const v = await validateLink(token);
  if (!v.valid) return { ok: false, error: v.reason ?? "invalid" };
  if (v.email && v.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, error: "email_mismatch" };
  }

  const auth = adminAuth();
  const db = adminDb();
  const now = Date.now();
  const days = v.accessDurationDays ?? 90;

  // create or update the user with the chosen password
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || undefined;
  let user;
  try {
    user = await auth.getUserByEmail(email);
    user = await auth.updateUser(user.uid, { password, emailVerified: true, displayName });
  } catch {
    user = await auth.createUser({ email, password, emailVerified: true, displayName });
  }

  // profile (first + last name carry through to onboarding) + 90-day active grant
  await db.doc(`users/${user.uid}`).set(
    { email, firstName: firstName ?? null, lastName: lastName ?? null, createdAt: now },
    { merge: true }
  );
  await db.doc(`accessGrants/${user.uid}`).set(
    {
      email, plan: "3_month", durationDays: days, status: "active",
      redeemBy: null, startsAt: now, expiresAt: now + days * DAY,
      source: "registration_link", createdAt: now, updatedAt: now,
    },
    { merge: true }
  );

  // consume the link (single/limited use)
  const ref = db.doc(`registrationLinks/${token}`);
  const uses = ((await ref.get()).data()?.uses ?? 0) + 1;
  const linkData = (await ref.get()).data() as RegistrationLink;
  await ref.set({ uses, usedBy: user.uid, usedAt: now, status: uses >= linkData.maxUses ? "used" : "active" }, { merge: true });

  return { ok: true, uid: user.uid };
}
