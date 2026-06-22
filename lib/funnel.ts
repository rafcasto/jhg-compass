// Single source of truth for the public acquisition funnel (landing → quiz → thank-you).
//
// Everything here is admin-editable and lives in the config/funnel Firestore document:
//   1) landing  — all marketing copy on the landing page
//   2) quiz      — the questions, their options, AND the per-option scoring metadata
//   3) lead      — the thank-you page copy + lead-form labels
//   4) inviteUrl — the single admin-updatable invitation link the CTA redirects to
//
// This module is pure (no client/server-only imports) so it can be shared by the
// client hook (lib/firestore/funnel.ts), the server helpers (lib/server/funnel.ts),
// and the scoring engine (lib/funnel-scoring.ts).

// ---- scoring vocabulary (from resources/lead-scoring-quiz.md) ----
export type Archetype = "Job Seeker" | "Career Changer" | "Promotion Seeker" | "Unclassified";
export type FitGate = "qualified" | "below-icp";
export type FunnelFlag = "ai-anxious" | "vip-signal" | "below-icp" | "manual-review";

// One answer choice. The optional scoring fields drive the engine; an admin can
// retune them in the Funnel tab without touching code.
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
  sub?: string;
  // choice questions
  allowOther?: boolean;       // show a free-text box when the isOther option is picked
  options?: QuizOption[];
  // text questions (Q6)
  placeholder?: string;
  required?: boolean;
}

export interface LandingCapability { emoji: string; title: string; body: string; }
export interface LandingStep { n: string; text: string; }

export interface FunnelConfig {
  landing: {
    brandName: string;
    brandAccent: string;
    eyebrow: string;
    h1: string;
    h1accent: string;
    lede: string;
    ctaLabel: string;
    ctaFine: string;
    proof: string;
    s2eyebrow: string;
    s2title: string;
    s2accent: string;
    s2bigline: string;
    capabilities: LandingCapability[];
    s3eyebrow: string;
    s3title: string;
    s3accent: string;
    steps: LandingStep[];
    s3ctaLabel: string;
    s3note: string;
    footer: string;
    tagline: string;
  };
  quiz: {
    intro: string;
    sub: string;
    footerNote: string;
    questions: QuizQuestion[];
  };
  lead: {
    eyebrow: string;
    title: string;
    body: string;
    firstNameLabel: string;
    lastNameLabel: string;
    emailLabel: string;
    ctaLabel: string;
    fine: string;
    tagline: string;
  };
  // The single admin-updatable invitation link the thank-you CTA redirects to.
  inviteUrl: string;
}

// ---- default funnel (ports the static prototypes + the scoring spec) ----
export const DEFAULT_FUNNEL: FunnelConfig = {
  landing: {
    brandName: "JobHacker",
    brandAccent: "Compass",
    eyebrow: "The hidden-job-market command center",
    h1: "Land the job",
    h1accent: "hiding in plain sight.",
    lede:
      "AI broke the job board. Compass helps you work the hidden job market like a pro — track the right activities, manage every lead, and always know your next move.",
    ctaLabel: "Find My Job-Search Blind Spot →",
    ctaFine: "2-minute quiz. No credit card.",
    proof: "3,000+ professionals coached · 70–80% of roles never advertised",
    s2eyebrow: "Why it works",
    s2title: "Job searching feels like darts in the dark.",
    s2accent: "Compass turns it into a system.",
    s2bigline:
      "It takes roughly 7–9 NOs to get 1 YES. Compass makes those NOs visible — so you keep swinging instead of quitting one conversation too early.",
    capabilities: [
      { emoji: "📊", title: "Track the success predictors", body: "Actual vs. Target on the activities that matter — 80% hidden market, 20% visible." },
      { emoji: "🗂️", title: "Run every role in one pipeline", body: "Drag each job from Wishlist to Offer. No more lost follow-ups." },
      { emoji: "🎯", title: "See your NO → YES funnel", body: "One dashboard shows your balance, your momentum, and your next move." },
    ],
    s3eyebrow: "How it works",
    s3title: "Your next role isn't on a job board.",
    s3accent: "It's one conversation away.",
    steps: [
      { n: "1", text: "Set your daily targets across the hidden and visible job markets." },
      { n: "2", text: "Log as you go — tap + after every call, application, or thank-you note." },
      { n: "3", text: "Watch your dashboard each week, adjust, and repeat until you land the offer." },
    ],
    s3ctaLabel: "Get Started With Compass →",
    s3note: "Built on the system 3,000+ professionals used to crack the hidden job market.",
    footer: "© 2026 JobHackers.Global · JobHacker Compass",
    tagline: "Get a job you love, at the salary you deserve. In 60 days, or less.",
  },
  quiz: {
    intro: "Let's find your job-search blind spot.",
    sub: "Six quick questions — then your Compass.",
    footerNote: "🔒 2 minutes · No credit card",
    questions: [
      {
        id: "q1",
        kind: "choice",
        prompt: "What best describes you right now?",
        sub: "This points your Compass at the right plan.",
        allowOther: true,
        options: [
          { id: "lost_job", label: "Lost my job, need one fast", archetype: "Job Seeker" },
          { id: "promotion", label: "Employed, want a promotion/raise", archetype: "Promotion Seeker" },
          { id: "wrong_role", label: "Employed but in the wrong role, want to change direction", archetype: "Career Changer" },
          { id: "ai_worried", label: "Worried AI will disrupt my career", archetype: "Career Changer", flag: "ai-anxious" },
          { id: "other", label: "Something else", archetype: "Unclassified", flag: "manual-review", isOther: true },
        ],
      },
      {
        id: "q2",
        kind: "choice",
        prompt: "When do you want to be in your new (or next) role?",
        sub: "Be honest about your timeline.",
        options: [
          { id: "lt_60", label: "Within 60 days or sooner", readiness: 3 },
          { id: "2_3mo", label: "2–3 months", readiness: 2 },
          { id: "4_6mo", label: "4–6 months", readiness: 1 },
          { id: "exploring", label: "Just exploring, no timeline", readiness: 0 },
        ],
      },
      {
        id: "q3",
        kind: "choice",
        prompt: "Where are you getting stuck?",
        sub: "Pick the one that stings most.",
        allowOther: true,
        options: [
          { id: "value", label: "Showcasing my value", obstacle: "value" },
          { id: "referrals", label: "Getting referrals", obstacle: "referrals" },
          { id: "interviews", label: "Getting interviews", obstacle: "interviews" },
          { id: "negotiation", label: "Negotiating compensation", obstacle: "negotiation" },
          { id: "other", label: "Something else", obstacle: "other", flag: "manual-review", isOther: true },
        ],
      },
      {
        id: "q4",
        kind: "choice",
        prompt: "How many years of professional experience do you have?",
        options: [
          { id: "under_3", label: "Under 3", fitGate: "below-icp", flag: "below-icp" },
          { id: "3_5", label: "3–5", fitGate: "qualified" },
          { id: "5_10", label: "5–10", fitGate: "qualified" },
          { id: "10_15", label: "10–15", fitGate: "qualified" },
          { id: "15_plus", label: "15+", fitGate: "qualified" },
        ],
      },
      {
        id: "q5",
        kind: "choice",
        prompt: "What have you already done about it?",
        sub: "What you've tried tells us where to start.",
        options: [
          { id: "paid_course", label: "Paid for a Job Hunting course before", readiness: 3 },
          { id: "paid_coach", label: "Paid for a Job Hunting coach / Outplacement before", readiness: 3, flag: "vip-signal" },
          { id: "diy", label: "Lots of DIY effort, no results", readiness: 2 },
          { id: "tweaks", label: "A few small tweaks", readiness: 1 },
          { id: "nothing", label: "Nothing yet", readiness: 0 },
        ],
      },
      {
        id: "q6",
        kind: "text",
        prompt: "Anything else you want us to know?",
        sub: "Optional — tell us anything that helps us help you.",
        placeholder: "Type your answer… (optional)",
        required: false,
      },
    ],
  },
  lead: {
    eyebrow: "Almost there",
    title: "Your Compass is ready.",
    body: "Enter your details and we'll send you straight to your JobHacker Compass.",
    firstNameLabel: "First name",
    lastNameLabel: "Last name",
    emailLabel: "Email",
    ctaLabel: "Get Started With Compass →",
    fine: "Land the job hiding in plain sight. In 60 days, or less.",
    tagline: "© 2026 JobHackers.Global · JobHacker Compass",
  },
  inviteUrl: "https://jobhackers.global",
};

// ---- merge helpers (defaults <- stored overrides) ----
// Scalars and nested copy merge shallowly; arrays (capabilities / steps / questions)
// fully replace the defaults when present, so admins can add/remove items.
export function mergeFunnel(stored?: Partial<FunnelConfig> | null): FunnelConfig {
  const s = stored ?? {};
  return {
    landing: {
      ...DEFAULT_FUNNEL.landing,
      ...(s.landing ?? {}),
      capabilities:
        Array.isArray(s.landing?.capabilities) && s.landing!.capabilities.length
          ? s.landing!.capabilities
          : DEFAULT_FUNNEL.landing.capabilities,
      steps:
        Array.isArray(s.landing?.steps) && s.landing!.steps.length
          ? s.landing!.steps
          : DEFAULT_FUNNEL.landing.steps,
    },
    quiz: {
      ...DEFAULT_FUNNEL.quiz,
      ...(s.quiz ?? {}),
      questions:
        Array.isArray(s.quiz?.questions) && s.quiz!.questions.length
          ? s.quiz!.questions
          : DEFAULT_FUNNEL.quiz.questions,
    },
    lead: { ...DEFAULT_FUNNEL.lead, ...(s.lead ?? {}) },
    inviteUrl: s.inviteUrl ?? DEFAULT_FUNNEL.inviteUrl,
  };
}

// Build the invite redirect URL with the lead's identity as query strings, so the
// destination page can prefill name + email without re-asking.
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
    // base wasn't an absolute URL — fall back to a manual query string
    const q = new URLSearchParams();
    if (lead.firstName) q.set("firstName", lead.firstName);
    if (lead.lastName) q.set("lastName", lead.lastName);
    if (lead.email) q.set("email", lead.email);
    const sep = base.includes("?") ? "&" : "?";
    return q.toString() ? `${base}${sep}${q}` : base;
  }
}
