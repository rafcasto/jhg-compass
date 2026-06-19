import type { Market } from "./categories";

export type ContactType =
  | "prospect" | "coach" | "recruiter" | "referral" | "peer" | "hiring_manager" | "other";

export type InteractionType =
  | "research" | "outreach_referral" | "outreach_cold" | "pleasure_interview"
  | "information_interview" | "job_interview" | "thank_you_note"
  | "networking_event" | "personal_branding" | "application" | "headhunter" | "other";

export type OpportunityStage =
  | "researching" | "contacted" | "interviewing" | "offer" | "accepted" | "rejected" | "closed";

export type GrantStatus = "pending" | "active" | "expired" | "revoked";

export interface Profile {
  email: string;
  firstName?: string;
  lastName?: string;
  archetype?: string;
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
  contactId?: string;
  company: string;
  role?: string;
  market: Market;
  stage: OpportunityStage;
  source?: string;
  url?: string;
  notes?: string;
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

// Shared networking event / meetup that admins & users can post and browse.
export interface EventItem {
  id: string;
  name: string;
  location?: string;
  city?: string;
  country?: string;
  date: string;   // YYYY-MM-DD
  time?: string;  // HH:mm
  url?: string;
  notes?: string;
  createdBy: string;
  createdByName?: string;
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
}
