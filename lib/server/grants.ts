import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { AccessGrant, AdminConfig, GrantStatus } from "@/lib/types";

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
  coachingTitle: "Work with a JobHackers coach",
  coachingBody:
    "Accelerate your search with 1:1 guidance. A coach will help you sharpen your Compass, open doors in the hidden job market, and keep you accountable.",
  coachingCtaLabel: "Book a coaching call",
  coachingCtaUrl: "https://jobhackers.global",
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
