// Admin information architecture — four top-level tabs, each with sub-tabs.
// Pure module (no React, no Firebase) so the hash ↔ location parsing is
// unit-testable and every tab component imports its sub-tab list from here.

export const TOFU_SUBTABS = [
  { key: "landing", label: "Landing page", hint: "Hero, countdown, details form, thank-you, expired & already-done screens" },
  { key: "quiz", label: "Quiz", hint: "Questions, options and per-option scoring" },
  { key: "registration", label: "Registration & access", hint: "Invite-link generator, sign-in / verify / set-password copy, paywall & emails" },
  { key: "onboarding", label: "Onboarding", hint: "The three-step first-run flow" },
] as const;
export type TofuSub = (typeof TOFU_SUBTABS)[number]["key"];

export const CMS_SUBTABS = [
  { key: "compass", label: "Compass", hint: "Goal statement copy, reading rail, tab names" },
  { key: "performance", label: "Performance", hint: "Copy, effort split, activity taxonomy" },
  { key: "progress", label: "Progress", hint: "Pipeline stages and every Progress-board string" },
  { key: "coaching", label: "Coaching", hint: "The Coaching screen (draft / publish)" },
] as const;
export type CmsSub = (typeof CMS_SUBTABS)[number]["key"];

export const INTERACTIONS_SUBTABS = [
  { key: "feedback", label: "Feedback", hint: "In-app survey (UAT) — questions, toggle, responses" },
  { key: "tracking", label: "Tracking", hint: "Which interactions are tracked, their Supabase tags and AAARRR stage" },
] as const;
export type InteractionsSub = (typeof INTERACTIONS_SUBTABS)[number]["key"];

export const ANALYTICS_SUBTABS = [
  { key: "quiz", label: "Quiz results", hint: "Answers, archetypes, readiness & fit, respondents" },
  { key: "segments", label: "Segments", hint: "4-quadrant matrix (ICP fit × propensity) and follow-up actions" },
  { key: "pirate", label: "Pirate metrics", hint: "AAARRR dashboard and data source" },
  { key: "usage", label: "Usage", hint: "Members, access, and the latest Compass events" },
] as const;
export type AnalyticsSub = (typeof ANALYTICS_SUBTABS)[number]["key"];

export const TABS = [
  { key: "tofu", label: "TOFU", title: "Top of the funnel", subs: TOFU_SUBTABS },
  { key: "cms", label: "Lead magnet CMS", title: "JHCompass lead magnet CMS", subs: CMS_SUBTABS },
  { key: "interactions", label: "User interactions", title: "User interactions", subs: INTERACTIONS_SUBTABS },
  { key: "analytics", label: "Analytics", title: "Analytics", subs: ANALYTICS_SUBTABS },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

export interface AdminLocation { tab: TabKey; sub: string }

// "#cms/compass" → { tab: "cms", sub: "compass" }; unknown parts fall back to the
// first tab / that tab's first sub-tab.
export function parseAdminHash(hash: string): AdminLocation {
  const [rawTab, rawSub] = hash.replace(/^#/, "").split("/");
  const tab = TABS.find((t) => t.key === rawTab) ?? TABS[0];
  const sub = (tab.subs as readonly { key: string }[]).some((s) => s.key === rawSub) ? rawSub : tab.subs[0].key;
  return { tab: tab.key, sub };
}
export const adminHash = (loc: AdminLocation) => `#${loc.tab}/${loc.sub}`;
export const firstSub = (tab: TabKey) => TABS.find((t) => t.key === tab)!.subs[0].key as string;
