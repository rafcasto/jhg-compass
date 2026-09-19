import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { AccessGrant, AdminConfig, GrantStatus, Profile } from "@/lib/types";
import { effectiveStatus, renewalPeriod, type MemberAccessRow } from "@/lib/access";

const DAY = 86_400_000;

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  paywallTitle: "Your access has ended",
  paywallBody:
    "Your JobHacker Compass access period is over. Renew to keep tracking your job-search momentum.",
  paywallCtaLabel: "Renew access",
  paywallCtaUrl: "https://jobhackers.global",
  pwResetSubject: "Set your JobHacker Compass password",
  pwResetBody: "Click the button below to set your password and start tracking.",
  emailVerifySubject: "Verify your email — JobHacker Compass",
  emailVerifyBody:
    "Welcome aboard! Confirm your email address to unlock your JobHacker Compass and start your job search the smart way.",
};

export async function getAdminConfig(): Promise<AdminConfig> {
  const snap = await adminDb().doc("config/admin").get();
  return { ...DEFAULT_ADMIN_CONFIG, ...(snap.exists ? (snap.data() as AdminConfig) : {}) };
}

export async function saveAdminConfig(patch: Partial<AdminConfig>, updatedBy?: string) {
  await adminDb().doc("config/admin").set(
    { ...patch, updatedBy: updatedBy ?? null, updatedAt: Date.now() },
    { merge: true }
  );
}

// Find or create a Firebase Auth user for an email.
export async function ensureUser(email: string, firstName?: string) {
  try {
    return await adminAuth().getUserByEmail(email);
  } catch {
    return await adminAuth().createUser({
      email,
      emailVerified: false,
      displayName: firstName,
    });
  }
}

interface GrantInput {
  email: string;
  firstName?: string;
  plan?: string;
  durationDays?: number; // length of access once active (default 90 = 3 months)
  source?: string;
  redeemHours?: number | null; // if set, grant is "pending" until redeemed within window (req 8)
  webhookPayload?: unknown;
}

// Creates/updates an access grant for a user (req 6,7,8).
export async function createGrant(input: GrantInput) {
  const user = await ensureUser(input.email, input.firstName);
  const uid = user.uid;
  const now = Date.now();
  const durationDays = input.durationDays ?? 90;

  let grant: AccessGrant;
  if (input.redeemHours && input.redeemHours > 0) {
    // Limited-time offer: a 3-month pass that must be redeemed within N hours.
    grant = {
      email: input.email,
      plan: input.plan ?? "3_month",
      durationDays,
      source: input.source,
      status: "pending",
      redeemBy: now + input.redeemHours * 3_600_000,
      startsAt: null,
      expiresAt: null,
    };
  } else {
    // Immediate access for `durationDays` (req 7).
    grant = {
      email: input.email,
      plan: input.plan ?? "3_month",
      durationDays,
      source: input.source,
      status: "active",
      redeemBy: null,
      startsAt: now,
      expiresAt: now + durationDays * DAY,
    };
  }

  await adminDb().doc(`accessGrants/${uid}`).set(
    { ...grant, webhookPayload: input.webhookPayload ?? null, createdAt: now, updatedAt: now },
    { merge: true }
  );

  return { uid, user, grant };
}

// Activate / expire transitions — trusted writer (req 8 redemption + req 9 expiry).
export async function syncGrant(uid: string): Promise<AccessGrant | null> {
  const ref = adminDb().doc(`accessGrants/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const g = snap.data() as AccessGrant;
  const now = Date.now();
  let next: Partial<AccessGrant> = {};

  if (g.status === "pending") {
    if (g.redeemBy && now <= g.redeemBy) {
      next = { status: "active", startsAt: now, expiresAt: now + g.durationDays * DAY };
    } else if (g.redeemBy && now > g.redeemBy) {
      next = { status: "expired" };
    }
  } else if (g.status === "active" && g.expiresAt && now >= g.expiresAt) {
    next = { status: "expired" };
  }

  if (Object.keys(next).length) {
    await ref.set({ ...next, updatedAt: now }, { merge: true });
    return { ...g, ...next } as AccessGrant;
  }
  return g;
}

// ---- Admin → TOFU → Access renewals ----

// Every grant, with its EFFECTIVE status and the member's name from users/{uid}.
export async function listGrants(now = Date.now()): Promise<MemberAccessRow[]> {
  const db = adminDb();
  const snap = await db.collection("accessGrants").get();
  const docs = snap.docs;
  // profiles in chunks (getAll takes up to a few hundred refs comfortably)
  const profiles = new Map<string, Partial<Profile>>();
  for (let i = 0; i < docs.length; i += 100) {
    const refs = docs.slice(i, i + 100).map((d) => db.doc(`users/${d.id}`));
    if (!refs.length) continue;
    const got = await db.getAll(...refs);
    for (const p of got) if (p.exists) profiles.set(p.id, p.data() as Partial<Profile>);
  }
  const rows: MemberAccessRow[] = docs.map((d) => {
    const g = d.data() as AccessGrant & { updatedAt?: number };
    const prof = profiles.get(d.id) ?? {};
    return {
      uid: d.id,
      email: g.email ?? prof.email ?? "",
      firstName: prof.firstName ?? null,
      lastName: prof.lastName ?? null,
      plan: g.plan ?? null,
      source: g.source ?? null,
      status: effectiveStatus(g, now),
      storedStatus: g.status,
      durationDays: g.durationDays ?? 0,
      startsAt: g.startsAt ?? null,
      expiresAt: g.expiresAt ?? null,
      redeemBy: g.redeemBy ?? null,
      updatedAt: g.updatedAt ?? null,
      renewedAt: g.renewedAt ?? null,
      renewedBy: g.renewedBy ?? null,
      careerOps: g.features?.careerOps === true,
    };
  });
  // newest change first
  rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return rows;
}

export interface RenewResult { uid: string; email: string; expiresAt: number }

// Re-activate (or extend) access for one or many members. Expired / pending /
// revoked members start a fresh period from now; members still active are
// extended from their current end date (lib/access.ts renewalPeriod).
export async function renewGrants(uids: string[], days: number, by: string | null): Promise<{ renewed: RenewResult[]; missing: string[] }> {
  const db = adminDb();
  const now = Date.now();
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const renewed: RenewResult[] = [];
  const missing: string[] = [];
  for (let i = 0; i < unique.length; i += 400) {
    const chunk = unique.slice(i, i + 400);
    const refs = chunk.map((uid) => db.doc(`accessGrants/${uid}`));
    const snaps = await db.getAll(...refs);
    const batch = db.batch();
    let n = 0;
    snaps.forEach((snap, j) => {
      if (!snap.exists) { missing.push(chunk[j]); return; }
      const g = snap.data() as AccessGrant;
      const { startsAt, expiresAt } = renewalPeriod(g, days, now);
      batch.set(refs[j], {
        status: "active" satisfies GrantStatus, startsAt, expiresAt, redeemBy: null,
        durationDays: days, renewedAt: now, renewedBy: by, updatedAt: now,
      }, { merge: true });
      renewed.push({ uid: chunk[j], email: g.email, expiresAt });
      n++;
    });
    if (n) await batch.commit();
  }
  return { renewed, missing };
}

// ---- feature flags (Admin → TOFU → Access renewals → Agents column) ----
export interface FeatureResult { uid: string; email: string }

export async function setGrantFeatures(uids: string[], features: { careerOps: boolean }, by: string | null): Promise<{ updated: FeatureResult[]; missing: string[] }> {
  const db = adminDb();
  const now = Date.now();
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const updated: FeatureResult[] = [];
  const missing: string[] = [];
  for (let i = 0; i < unique.length; i += 400) {
    const chunk = unique.slice(i, i + 400);
    const refs = chunk.map((uid) => db.doc(`accessGrants/${uid}`));
    const snaps = await db.getAll(...refs);
    const batch = db.batch();
    let n = 0;
    snaps.forEach((snap, j) => {
      if (!snap.exists) { missing.push(chunk[j]); return; }
      const g = snap.data() as AccessGrant;
      batch.set(refs[j], { features: { ...(g.features ?? {}), ...features }, featuresUpdatedAt: now, featuresUpdatedBy: by, updatedAt: now }, { merge: true });
      updated.push({ uid: chunk[j], email: g.email });
      n++;
    });
    if (n) await batch.commit();
  }
  return { updated, missing };
}
