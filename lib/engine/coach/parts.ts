// Where a conversation is (docs/UX_COACH_AGENTIC.md §1): the Part line under the eyebrow — *Part B · What
// the market posts* — derived in code from the stored keys, never from the model. Zero tokens. Each coach's
// parts are the prompt's own headings, in order; the current part is the first whose keys are not stored
// yet. Pure — tested.

import type { ProfileFile } from "../../careerops/profile-file";
import type { CoachKey } from "./keys";
import { findJhSection, type JhSectionKey } from "../../jobhacking/sections";

export interface CoachPart {
  /** The prompt's heading, as the panel shows it: "Part B · What the market posts". */
  label: string;
  /** Whether the stored profile holds what this part produces. */
  done: (p: ProfileFile) => boolean;
}

const has = (v: unknown): boolean => Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim().length > 0 : v != null && typeof v === "object" ? Object.keys(v as object).length > 0 : v != null;
const cvHas = (p: ProfileFile, heading: string) => (p.cv ?? "").split("\n").some((l) => l.trim() === heading);

export const COACH_PARTS: Record<CoachKey, readonly CoachPart[]> = {
  narrative: [
    { label: "1 · Who you are", done: (p) => has(p.jhg?.identity?.city) || has(p.contact?.phone) },
    { label: "2 · What you're good at", done: (p) => has(p.narrative?.superpowers) },
    { label: "3 · Your headline", done: (p) => has(p.narrative?.headline) },
    { label: "4 · Where you're going", done: (p) => has(p.personalization?.exitNarrative) },
  ],
  trueNorth: [
    { label: "Part A · Boundaries", done: (p) => has(p.jhg?.trueNorth?.boundaries) },
    { label: "Part B · What the market posts", done: (p) => has(p.jhg?.trueNorth?.clusters) },
    { label: "Part C · Industries and the North Star", done: (p) => has(p.jhg?.trueNorth?.industries) && has(p.goal?.role) },
  ],
  targetCompanies: [
    { label: "Part A · The 40", done: (p) => (p.jhg?.targetCompanies?.companies?.length ?? 0) >= 40 },
    { label: "Part B · Fit scores", done: (p) => (p.jhg?.targetCompanies?.companies ?? []).some((c) => typeof c.scores?.total === "number") && (p.jhg?.targetCompanies?.companies?.length ?? 0) >= 40 },
    { label: "Part C · Top 10 and careers pages", done: (p) => has(p.jhg?.targetCompanies?.top10) },
    { label: "Part D · Top 3", done: (p) => has(p.jhg?.targetCompanies?.top3) },
  ],
  storyBank: [
    { label: "Part A · The stories", done: (p) => (p.stories?.length ?? 0) >= 8 },
    { label: "Part B · Framing, proof asset, snapshots", done: (p) => has(p.personalization?.adaptiveFraming) },
  ],
  masterCv: [
    { label: "Agree the frame", done: (p) => has(p.jhg?.artefacts?.currentDomain) || has(p.cv) },
    { label: "Write it, section by section", done: (p) => cvHas(p, "## Skills") },
    { label: "Quality check", done: (p) => has(p.contact?.title) && cvHas(p, "## Skills") },
  ],
  linkedin: [
    { label: "Headline", done: (p) => has(p.linkedin?.headline) },
    { label: "About", done: (p) => has(p.linkedin?.about) },
    { label: "Experience", done: (p) => has(p.linkedin?.experience) },
    { label: "Featured", done: (p) => has(p.linkedin?.featured) },
    { label: "Skills", done: (p) => has(p.linkedin?.skills) },
    { label: "Education", done: (p) => has(p.linkedin?.education) },
    { label: "Certifications", done: (p) => has(p.linkedin?.certifications) },
  ],
};

/**
 * The part the conversation is in: the first not yet stored; "Hand over" once every part is; null before
 * the conversation has produced anything AND the first part is not started (nothing to say yet is said by
 * the caller — a complete coach shows nothing here either).
 */
export function coachPart(coach: CoachKey, profile: ProfileFile, complete = false): string | null {
  if (complete) return null;
  const parts = COACH_PARTS[coach];
  const current = parts.find((part) => !part.done(profile));
  return current ? current.label : "Hand over";
}

/** The index of the part the conversation is in; parts.length once every part is stored. */
export function currentPartIndex(coach: CoachKey, profile: ProfileFile): number {
  const i = COACH_PARTS[coach].findIndex((part) => !part.done(profile));
  return i < 0 ? COACH_PARTS[coach].length : i;
}

/**
 * Which part of a coach's conversation produces each section of its page — so a member who opened the coach from an empty
 * Top 3 is not started on the Top 3. The page reads result-first (Top 3 · Top 10 · Top 40, docs/UX_JOBHACKING.md §3b);
 * the work runs the other way (the 40 → the scores → the Top 10 → the Top 3), and the conversation keeps the work's order.
 */
export const SECTION_PARTS: Partial<Record<CoachKey, Partial<Record<JhSectionKey, number>>>> = {
  trueNorth: { salary: 0, location: 0, "work-rights": 0, boundaries: 0, roles: 1, seniority: 1, industry: 2, "company-type": 2 },
  targetCompanies: { top40: 0, companies: 2, top10: 2, top3: 3 },
};

/**
 * The operator's line when the member opened the coach on a section whose part comes later than the one the conversation
 * is in — the coach says in one line where that section comes from and stays on its part. null when the section is the
 * current part's, an earlier one's, or unknown.
 */
export function steerNote(coach: CoachKey, section: JhSectionKey | null | undefined, profile: ProfileFile): string | null {
  if (!section) return null;
  const target = SECTION_PARTS[coach]?.[section];
  if (target === undefined) return null;
  const current = currentPartIndex(coach, profile);
  if (target <= current) return null;
  const parts = COACH_PARTS[coach];
  const label = findJhSection(section)?.label ?? section;
  return `The member opened you from the empty ${label} section — that is ${parts[target].label}, which comes out of the parts before it. You are on ${parts[current].label}: say in one line that ${label} comes later and from where, then carry on with ${parts[current].label}. Do not start on ${label}.`;
}
