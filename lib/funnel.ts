// Single source of truth for the public acquisition funnel:
//   landing → details (name/email) → quiz → thank-you → registration link
//   (with an expired-link experience that points to the next meetup).
//
// Everything here is admin-editable and lives in the config/funnel Firestore
// document. This module is pure (no client/server-only imports) so it can be
// shared by the client hook (lib/firestore/funnel.ts), the server helpers
// (lib/server/funnel.ts) and the scoring engine (lib/funnel-scoring.ts).

// ---- scoring vocabulary (from resources/lead-scoring-quiz.md) ----
export type Archetype = "Job Seeker" | "Career Changer" | "Promotion Seeker" | "Unclassified";
export type FitGate = "qualified" | "below-icp";
export type FunnelFlag = "ai-anxious" | "vip-signal" | "below-icp" | "manual-review";

export interface QuizOption {
  id: string;
  label: string;
  archetype?: Archetype; // Q1 — sets the archetype
  readiness?: number;    // Q2 / Q5 — readiness points (summed, 0–6)
  obstacle?: string;     // Q3 — message-routing label (not scored)
  fitGate?: FitGate;     // Q4 — the qualification gate
  flag?: FunnelFlag;     // optional per-option flag (e.g. ai-anxious, vip-signal)
  isOther?: boolean;     // "Something else" → requires free text + manual review
}

export interface QuizQuestion {
  id: string;                 // q1 … q6
  kind: "choice" | "text";
  prompt: string;
  sub?: string;               // legacy — no longer rendered
  allowOther?: boolean;       // free-text box when the isOther option is picked
  options?: QuizOption[];     // choice questions
  placeholder?: string;       // text questions (Q6)
  required?: boolean;
}

export interface LandingCard { part: string; title: string; body: string; }
export interface Mentor { initials: string; name: string; role: string; bio: string; photo?: string; }
export interface CountdownConfig { mode: "fixed" | "evergreen"; deadline: string; hours: number; }

export interface FunnelConfig {
  landing: {
    headTag: string;
    brandName: string;
    brandAccent: string;
    heroH1: string;
    heroH1Accent: string;
    heroSub: string;
    ctaLabel: string;
    countdownLabel: string;
    proofrow: string;
    getEyebrow: string;
    getTitlePre: string;
    getTitleAccent: string;
    getTitlePost: string;
    cards: LandingCard[];
    mentorsEyebrow: string;
    mentorsTitle: string;
    mentorsTitleAccent: string;
    mentors: Mentor[];
    seen: string;
    closingTitle: string;
    closingSub: string;
    closingNote: string;
    footer: string;
    tagline: string;
  };
  countdown: CountdownConfig;
  // Personal details captured BEFORE the quiz (design from quiz.html).
  details: {
    eyebrow: string;
    title: string;
    lede: string;
    firstNameLabel: string;
    lastNameLabel: string;
    emailLabel: string;
    submitLabel: string;
    consent: string;
  };
  quiz: {
    footerNote: string;
    questions: QuizQuestion[];
  };
  // Thank-you page (design from thank-you.html) — CTA continues to registration.
  lead: {
    eyebrow: string;
    title: string;
    body: string;
    ctaLabel: string;
    fine: string;
    tagline: string;
  };
  // The registration link the thank-you CTA continues to (admin-updatable).
  inviteUrl: string;
  // Expired-link experience — shown when the registration link has expired.
  expired: {
    eyebrow: string;
    title: string;
    body: string;
    ctaLabel: string;
    meetupUrl: string;
  };
  // Shown when someone who already finished the quiz / is registered tries again.
  blocked: {
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
}

const DEFAULT_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1", kind: "choice", prompt: "What best describes you right now?", allowOther: true,
    options: [
      { id: "lost_job", label: "Lost my job, need one fast", archetype: "Job Seeker" },
      { id: "promotion", label: "Employed, want a promotion/raise", archetype: "Promotion Seeker" },
      { id: "wrong_role", label: "Employed but in the wrong role, want to change direction", archetype: "Career Changer" },
      { id: "ai_worried", label: "Worried AI will disrupt my career", archetype: "Career Changer", flag: "ai-anxious" },
      { id: "other", label: "Something else", archetype: "Unclassified", flag: "manual-review", isOther: true },
    ],
  },
  {
    id: "q2", kind: "choice", prompt: "When do you want to be in your new (or next) role?",
    options: [
      { id: "lt_60", label: "Within 60 days or sooner", readiness: 3 },
      { id: "2_3mo", label: "2–3 months", readiness: 2 },
      { id: "4_6mo", label: "4–6 months", readiness: 1 },
      { id: "exploring", label: "Just exploring, no timeline", readiness: 0 },
    ],
  },
  {
    id: "q3", kind: "choice", prompt: "Where are you getting stuck?", allowOther: true,
    options: [
      { id: "value", label: "Showcasing my value", obstacle: "value" },
      { id: "referrals", label: "Getting referrals", obstacle: "referrals" },
      { id: "interviews", label: "Getting interviews", obstacle: "interviews" },
      { id: "negotiation", label: "Negotiating compensation", obstacle: "negotiation" },
      { id: "other", label: "Something else", obstacle: "other", flag: "manual-review", isOther: true },
    ],
  },
  {
    id: "q4", kind: "choice", prompt: "How many years of professional experience do you have?",
    options: [
      { id: "under_3", label: "Under 3", fitGate: "below-icp", flag: "below-icp" },
      { id: "3_5", label: "3–5", fitGate: "qualified" },
      { id: "5_10", label: "5–10", fitGate: "qualified" },
      { id: "10_15", label: "10–15", fitGate: "qualified" },
      { id: "15_plus", label: "15+", fitGate: "qualified" },
    ],
  },
  {
    id: "q5", kind: "choice", prompt: "What have you already done about it?",
    options: [
      { id: "paid_course", label: "Paid for a Job Hunting course before", readiness: 3 },
      { id: "paid_coach", label: "Paid for a Job Hunting coach / Outplacement before", readiness: 3, flag: "vip-signal" },
      { id: "diy", label: "Lots of DIY effort, no results", readiness: 2 },
      { id: "tweaks", label: "A few small tweaks", readiness: 1 },
      { id: "nothing", label: "Nothing yet", readiness: 0 },
    ],
  },
  {
    id: "q6", kind: "text", prompt: "Anything else you want us to know?",
    placeholder: "Type your answer… (optional)", required: false,
  },
];

export const DEFAULT_FUNNEL: FunnelConfig = {
  landing: {
    headTag: "Free for JobHackers members",
    brandName: "JobHacker",
    brandAccent: "Compass",
    heroH1: "Run Your Entire Job Search From One Dashboard",
    heroH1Accent: "(Free For The Next 90 Days)",
    heroSub:
      "Compass runs the Job Hacking method you already learned — set your targets, track the activities that win, and work every lead in one pipeline. Free for members who claim it before the window closes.",
    ctaLabel: "Claim My 90 Days →",
    countdownLabel: "Free access closes in",
    proofrow: "3,000+ JobHackers coached · 7-step proven method · 90 days free",
    getEyebrow: "What you get",
    getTitlePre: "Everything inside your",
    getTitleAccent: "(free)",
    getTitlePost: "90 days…",
    cards: [
      { part: "Part 01", title: "Set your goal statement", body: "Lock in the role, level, and salary you're aiming at. Every target and activity in Compass points back to this one north star — so your effort always has a direction." },
      { part: "Part 02", title: "Track actual vs. target", body: "Log the activities that actually win — 80% hidden market, 20% visible — and watch Actual vs. Target update as you go. The success predictors, finally made visible." },
      { part: "Part 03", title: "Work your pipeline", body: "Every role in one board, Wishlist to Offer. Record each opportunity and interaction so no warm lead ever goes cold and your follow-ups never slip." },
    ],
    mentorsEyebrow: "Your JobHacking mentors",
    mentorsTitle: "Built on 30 years of",
    mentorsTitleAccent: "real placements",
    mentors: [
      { initials: "DP", name: "David Perry", role: "Recruiter & Author", photo: "/assets/mentor-david.jpg", bio: "30+ years recruiting. Co-founder of Perry-Martel International. Author of Guerrilla Marketing for Job Hunters and Hiring Greatness." },
      { initials: "LS", name: "Laurent Simon", role: "Co-founder & Author", photo: "/assets/mentor-laurent.jpg", bio: "20+ years across Europe & APAC. Co-founder of Digital Pathways. Author of Harnessing Digital Disruption and The AI Dojo Experiment." },
    ],
    seen: "As seen on   Forbes · Fortune · New York Times · WSJ · INSEAD · MSNBC",
    closingTitle: "Don't leave your next job to luck.",
    closingSub: "Free for 90 days — the window closes 48 hours after the event.",
    closingNote: "Members only · 2-minute setup · no credit card.",
    footer: "© 2026 JobHackers.Global · JobHacker Compass",
    tagline: "Get a job you love, at the salary you deserve. In 60 days, or less.",
  },
  countdown: { mode: "evergreen", deadline: "2026-07-15T23:59:00-04:00", hours: 48 },
  details: {
    eyebrow: "Members only · 90 days free",
    title: "Claim your free 90 days of Compass.",
    lede: "Enter your details and we'll start your Compass registration. It only takes a minute.",
    firstNameLabel: "First name",
    lastNameLabel: "Last name",
    emailLabel: "Email",
    submitLabel: "Claim My 90 Days →",
    consent: "Free for JobHackers members · closes 48 hours after the event.",
  },
  quiz: {
    footerNote: "🔒 2 minutes · No credit card",
    questions: DEFAULT_QUESTIONS,
  },
  lead: {
    eyebrow: "One step left",
    title: "You're almost in. Let's finish setting up Compass.",
    body: "Complete your Compass registration to activate your free 90 days. It only takes a minute.",
    ctaLabel: "Complete My Registration →",
    fine: "Finish within 48 hours of the event to lock in your free 90 days.",
    tagline: "© 2026 JobHackers.Global · JobHacker Compass",
  },
  inviteUrl: "https://jobhackers.global",
  expired: {
    eyebrow: "This link has expired",
    title: "Your free-access window has closed.",
    body: "The registration link for this offer is no longer active. The good news: we run these regularly — join our next live meetup and you'll get a fresh invite.",
    ctaLabel: "Join our next meetup event →",
    meetupUrl: "https://www.meetup.com/job-hackers-global",
  },
  blocked: {
    title: "You've already claimed your Compass.",
    body: "Looks like you've already completed this — sign in to pick up right where you left off.",
    ctaLabel: "Sign in →",
    ctaHref: "/login",
  },
};

// ---- merge helpers (defaults <- stored overrides) ----
// Scalars/copy merge shallowly; arrays (cards / mentors / questions) fully replace
// the defaults when present, so admins can add/remove items.
export function mergeFunnel(stored?: Partial<FunnelConfig> | null): FunnelConfig {
  const s = stored ?? {};
  return {
    landing: {
      ...DEFAULT_FUNNEL.landing,
      ...(s.landing ?? {}),
      cards: Array.isArray(s.landing?.cards) && s.landing!.cards.length ? s.landing!.cards : DEFAULT_FUNNEL.landing.cards,
      mentors: Array.isArray(s.landing?.mentors) && s.landing!.mentors.length ? s.landing!.mentors : DEFAULT_FUNNEL.landing.mentors,
    },
    countdown: { ...DEFAULT_FUNNEL.countdown, ...(s.countdown ?? {}) },
    details: { ...DEFAULT_FUNNEL.details, ...(s.details ?? {}) },
    quiz: {
      ...DEFAULT_FUNNEL.quiz,
      ...(s.quiz ?? {}),
      questions: Array.isArray(s.quiz?.questions) && s.quiz!.questions.length ? s.quiz!.questions : DEFAULT_FUNNEL.quiz.questions,
    },
    lead: { ...DEFAULT_FUNNEL.lead, ...(s.lead ?? {}) },
    inviteUrl: s.inviteUrl ?? DEFAULT_FUNNEL.inviteUrl,
    expired: { ...DEFAULT_FUNNEL.expired, ...(s.expired ?? {}) },
    blocked: { ...DEFAULT_FUNNEL.blocked, ...(s.blocked ?? {}) },
  };
}

// Build the registration redirect URL with the lead's identity as query strings,
// so the destination page can prefill name + email without re-asking.
export function buildInviteUrl(
  base: string,
  lead: { firstName?: string; lastName?: string; email?: string }
): string {
  try {
    const url = new URL(base);
    if (lead.firstName) url.searchParams.set("firstName", lead.firstName);
    if (lead.lastName) url.searchParams.set("lastName", lead.lastName);
    if (lead.email) url.searchParams.set("email", lead.email);
    return url.toString();
  } catch {
    const q = new URLSearchParams();
    if (lead.firstName) q.set("firstName", lead.firstName);
    if (lead.lastName) q.set("lastName", lead.lastName);
    if (lead.email) q.set("email", lead.email);
    const sep = base.includes("?") ? "&" : "?";
    return q.toString() ? `${base}${sep}${q}` : base;
  }
}
