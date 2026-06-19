// Activity taxonomy — sourced verbatim from the JHG Monthly Activity Tracker (Excel).
// Hidden job market = ~80% of effort. Visible job market = <=20% of effort.

export type Market = "hidden" | "visible";

export interface ActivityCategory {
  id: string;
  market: Market;
  label: string;
  emoji: string;
}

export const EFFORT_SPLIT = { hidden: 80, visible: 20 } as const;

// "You need 7 to 9 NOs to get 1 YES" — drives the dashboard funnel framing.
export const NOS_PER_YES = { min: 7, max: 9 } as const;

export const CATEGORIES: ActivityCategory[] = [
  // ---------- HIDDEN JOB MARKET (~80%) ----------
  { id: "research_industry",   market: "hidden", emoji: "🔎", label: "Research & read target industry / top-10 companies" },
  { id: "research_profiles",   market: "hidden", emoji: "🕵️", label: "Research interesting profiles at target companies" },
  { id: "outreach_referral",   market: "hidden", emoji: "🤝", label: "Contact prospects — with referrals" },
  { id: "outreach_cold",       market: "hidden", emoji: "📞", label: "Contact prospects — cold / no referral" },
  { id: "pleasure_interview",  market: "hidden", emoji: "☕", label: "Pleasure interviews (shared hobbies / interests)" },
  { id: "info_interview",      market: "hidden", emoji: "💬", label: "Information interviews (meet coaches / understand the field)" },
  { id: "job_interview",       market: "hidden", emoji: "💼", label: "Job interviews (meet potential future boss)" },
  { id: "thank_you",           market: "hidden", emoji: "✍️", label: "Thank-you notes" },
  { id: "networking_event",    market: "hidden", emoji: "🎟️", label: "Attend networking events / meetups" },
  { id: "personal_branding",   market: "hidden", emoji: "📣", label: "Increase visibility / personal branding (post on LinkedIn)" },
  // ---------- VISIBLE JOB MARKET (<=20%) ----------
  { id: "post_cv",             market: "visible", emoji: "📋", label: "Post CV on job boards" },
  { id: "headhunters",         market: "visible", emoji: "🎯", label: "Contact headhunters / search firms (full-time)" },
  { id: "placement_agency",    market: "visible", emoji: "🗂️", label: "Contact placement agency (temp / part-time)" },
  { id: "answer_ads",          market: "visible", emoji: "📰", label: "Answer ads" },
  { id: "unsolicited",         market: "visible", emoji: "✉️", label: "Send unsolicited letters" },
];

// Realistic weekly targets — a sensible default plan weighted ~80% hidden market,
// reflecting "high activity = high success" and "7–9 NOs to get 1 YES".
// Used whenever a user hasn't set their own target for a category.
export const DEFAULT_WEEKLY_TARGETS: Record<string, number> = {
  research_industry: 5,
  research_profiles: 5,
  outreach_referral: 5,
  outreach_cold: 8,
  pleasure_interview: 1,
  info_interview: 2,
  job_interview: 1,
  thank_you: 3,
  networking_event: 1,
  personal_branding: 3,
  post_cv: 2,
  headhunters: 1,
  placement_agency: 1,
  answer_ads: 3,
  unsolicited: 1,
};

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const HIDDEN_CATEGORIES = CATEGORIES.filter((c) => c.market === "hidden");
export const VISIBLE_CATEGORIES = CATEGORIES.filter((c) => c.market === "visible");
