import type { Market } from "./categories";

export type ContactType =
  | "prospect" | "coach" | "recruiter" | "referral" | "peer" | "hiring_manager" | "other";

export type InteractionType =
  | "research" | "outreach_referral" | "outreach_cold" | "pleasure_interview"
  | "information_interview" | "job_interview" | "thank_you_note"
  | "networking_event" | "personal_branding" | "application" | "headhunter" | "other";

// Kanban pipeline stages (req 4.3).
export type OpportunityStage =
  | "wishlist" | "applied" | "interview" | "offer" | "rejected";

export type GrantStatus = "pending" | "active" | "expired" | "revoked";

// A timestamped note entry — keeps a record of conversations on both
// contacts and opportunities (req 4).
export interface NoteEntry {
  at: number;
  text: string;
}

// The user's Compass — a refined recap of the job-search formula (req 3.2).
export interface CompassFormula {
  jobTitle?: string;    // function / title
  industry?: string;
  geography?: string;
  companyType?: string; // startup / small / mid-size / large
  targetSalary?: string; // expected / target compensation
  minSalary?: string;    // minimum acceptable — the deal-breaker
}

export interface Profile {
  email: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  archetype?: string;
  compass?: CompassFormula;
  onboardedAt?: number;
  createdAt?: number;
}

export interface Contact {
  id: string;
  fullName: string;
  company?: string;
  role?: string;
  type: ContactType;
  market: Market;
  linkedinUrl?: string;
  email?: string;
  phone?: string;
  hasReferral?: boolean;
  status?: string;
  notes?: string;
  log?: NoteEntry[];
  lastContactedAt?: number;
  createdAt?: number;
}

export interface Interaction {
  id: string;
  contactId?: string;
  type: InteractionType;
  scheduledAt?: number;
  occurredAt?: number;
  thankYouSent?: boolean;
  outcome?: string;
  notes?: string;
  createdAt?: number;
}

export interface Opportunity {
  id: string;
  contactIds?: string[];   // attached contacts (req 4.4)
  company: string;
  role?: string;
  market: Market;
  stage: OpportunityStage;
  source?: string;
  url?: string;
  notes?: string;
  log?: NoteEntry[];       // conversation record (req 4)
  createdAt?: number;
}

export interface ActivityLog {
  id: string;
  categoryId: string;
  contactId?: string;
  loggedOn: string; // YYYY-MM-DD
  count: number;
  notes?: string;
  createdAt?: number;
}

export interface AccessGrant {
  email: string;
  plan: string;
  durationDays: number;
  source?: string;
  status: GrantStatus;
  redeemBy?: number | null;
  startsAt?: number | null;
  expiresAt?: number | null;
}

export interface AdminConfig {
  paywallTitle: string;
  paywallBody: string;
  paywallCtaLabel: string;
  paywallCtaUrl: string;
  pwResetSubject: string;
  pwResetBody: string;
  // Email verification template (req 2) — admin-editable.
  emailVerifySubject: string;
  emailVerifyBody: string;
  // Coaching modal copy (Q1) — admin-editable.
  coachingTitle: string;
  coachingBody: string;
  coachingCtaLabel: string;
  coachingCtaUrl: string;
}

// An editable activity in the Performance tab / onboarding.
// Extends the static ActivityCategory with a per-activity default weekly target,
// so the whole taxonomy can live in admin-editable content.
export interface Activity {
  id: string;
  market: Market;
  emoji: string;
  label: string;
  defaultWeekly: number; // sensible weekly target used until the user sets their own
}

// Admin-editable content for the whole app: static copy + the activity taxonomy.
// Stored at config/content and live-read by every page (Performance, onboarding, Compass).
export interface ContentConfig {
  // Effort-split percentages shown on the Hidden / Visible banners.
  effortSplit: { hidden: number; visible: number };
  // The full activity list (both markets); admin can add / remove / reorder.
  activities: Activity[];
  // All editable static strings, keyed (see lib/content.ts for the catalogue).
  text: Record<string, string>;
}
