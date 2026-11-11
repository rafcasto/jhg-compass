// The six coaches (docs/UX_COACH.md) — the Gemini Gems of the Packer, inside the portal.
// Pure: names, order, which page each writes, which coaches it needs first. The
// conversation runs in lib/engine/coach/turn.ts; the writes in write.ts. Tested.

import type { JhgFileKey } from "../../careerops/types";
import type { JhPageKey } from "../../jobhacking/sections";

export type CoachKey = JhgFileKey;
export const COACH_KEYS: readonly CoachKey[] = ["narrative", "trueNorth", "targetCompanies", "storyBank", "masterCv", "linkedin"];

export interface Coach {
  key: CoachKey;
  /** 1–6 */
  n: number;
  label: string;
  /** The page it writes — the launcher opens this coach on that page. */
  page: JhPageKey;
  /** The menu group its page sits under (docs/UX_JOBHACKING.md §9). */
  group: "compass" | "artefacts";
  /** One line, what you leave with. */
  outcome: string;
  /** How long it takes, in the student guide's words. */
  time: string;
  /** The coaches that must be complete first (the Gem's "Asks for"). */
  needs: readonly CoachKey[];
  /** Built — a coach without a prompt is shown but cannot start yet. */
  ready: boolean;
  /**
   * Web searches per call (`max_uses`): market wording for most; the research coaches (2, 3) do the research
   * in the conversation. A turn runs up to six calls, so a cap of 5 is up to 30 searches a turn — each one
   * $0.01 plus its results, which sit in the transcript for the rest of the conversation. Fixed for the whole
   * conversation: changing a tool definition between calls breaks the cache and the preserved-thinking check.
   */
  search: number;
}

export const COACHES: readonly Coach[] = [
  { key: "narrative", n: 1, label: "Narrative", page: "narrative", group: "compass", outcome: "Your contact details, a headline a recruiter gets in ten seconds, your bridge story and three to five core competencies.", time: "about 1 hour", needs: [], ready: true, search: 3 },
  { key: "trueNorth", n: 2, label: "True North", page: "true-north", group: "compass", outcome: "Your boundaries, the roles the market really posts for you, target industries, seniority, salary range and company type.", time: "2–3 hours", needs: ["narrative"], ready: true, search: 5 },
  { key: "targetCompanies", n: 3, label: "Target companies", page: "companies", group: "compass", outcome: "40 companies with their careers pages, scored; your Top 10 and Top 3 with a first move this week.", time: "3–4 hours", needs: ["narrative", "trueNorth"], ready: true, search: 5 },
  { key: "storyBank", n: 4, label: "Story Bank", page: "story-bank", group: "artefacts", outcome: "Eight to ten proven stories (STAR+R), each number with its source; which stories prove each target role.", time: "1–2 sittings", needs: ["narrative", "trueNorth", "targetCompanies"], ready: true, search: 3 },
  { key: "masterCv", n: 5, label: "Master CV", page: "master-cv", group: "artefacts", outcome: "Your complete CV, every line a result from your stories.", time: "about 2 hours", needs: ["narrative", "trueNorth", "targetCompanies", "storyBank"], ready: true, search: 3 },
  { key: "linkedin", n: 6, label: "LinkedIn", page: "linkedin", group: "artefacts", outcome: "Your LinkedIn profile, section by section, ready to paste.", time: "1–2 hours", needs: ["narrative", "storyBank", "masterCv"], ready: true, search: 3 },
];

export const COACH_TOTAL = COACHES.length;
export const findCoach = (key: string | null | undefined): Coach | undefined => COACHES.find((c) => c.key === key);
export const isCoachKey = (v: unknown): v is CoachKey => COACHES.some((c) => c.key === v);

/** The coach that writes a page — the Artefacts hub and the Agents area have none. */
export function coachForPage(page: JhPageKey | null | undefined): Coach | undefined {
  if (page === "artefacts") return findCoach("storyBank");
  return COACHES.find((c) => c.page === page);
}

/**
 * The page a pathname is on, on either portal: /jobhacking/true-north → "true-north",
 * /settings/companies → "companies", /settings → null (the hub), elsewhere → null.
 */
export function pageOfPath(pathname: string): JhPageKey | null {
  const m = pathname.match(/^\/(?:jobhacking|settings)\/([a-z-]+)/);
  if (!m) return null;
  const seg = m[1];
  const pages: JhPageKey[] = ["narrative", "true-north", "companies", "artefacts", "story-bank", "master-cv", "linkedin", "agents"];
  return (pages as string[]).includes(seg) ? (seg as JhPageKey) : null;
}

/**
 * Whether a pathname is somewhere the coach floats: a page a coach writes, on either portal
 * (decision 2026-11-10: not the Settings hub, not JobHacking → Settings, not the Agents area).
 */
export const coachShowsOn = (pathname: string): boolean => !!coachForPage(pageOfPath(pathname));

export type CoachState = "complete" | "in_progress" | "not_started";

/** Each coach's state from the profile's stamps (jhg.progress.<coach>, written by the coach or carried by an uploaded file). */
export function coachStates(progress: Partial<Record<CoachKey, { status?: string }>> | null | undefined): Record<CoachKey, CoachState> {
  const out = {} as Record<CoachKey, CoachState>;
  for (const c of COACHES) {
    const s = progress?.[c.key]?.status;
    out[c.key] = s === "complete" ? "complete" : s === "in_progress" ? "in_progress" : "not_started";
  }
  return out;
}

/** The first coach that is not complete — where "Continue with your coach" goes. */
export const nextCoach = (states: Record<CoachKey, CoachState>): Coach => COACHES.find((c) => states[c.key] !== "complete") ?? COACHES[COACHES.length - 1];

/** The coaches this one needs that are not complete yet — empty when it may start. */
export const missingBefore = (coach: Coach, states: Record<CoachKey, CoachState>): Coach[] =>
  coach.needs.filter((k) => states[k] !== "complete").map((k) => findCoach(k)!);

/** The launcher's tail: what tapping it does for this coach right now. */
export function launcherLabel(coach: Coach, states: Record<CoachKey, CoachState>): string {
  const s = states[coach.key];
  if (s === "complete") return `Your coach · ${coach.label}`;
  if (s === "in_progress") return `Continue ${coach.label}`;
  return `Start ${coach.label}`;
}
