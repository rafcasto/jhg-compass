// Where a conversation is (docs/UX_COACH_AGENTIC.md §1): the Part line under the eyebrow — *Part B · What
// the market posts* — derived in code from the stored keys, never from the model. Zero tokens. Each coach's
// parts are the prompt's own headings, in order; the current part is the first whose keys are not stored
// yet. Pure — tested.

import type { ProfileFile } from "../../careerops/profile-file";
import type { CoachKey } from "./keys";

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
