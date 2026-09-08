// Prospect segmentation — the 4-quadrant matrix used by Analytics → Segments.
//
// Every quiz respondent carries two scores (lib/funnel-scoring.ts):
//   • ICP fit          — the Q4 gate: "qualified" | "below-icp"
//   • Buying propensity — the readiness score, 0–6 (Q2 + Q5 points)
// Crossing the two puts each prospect in exactly one quadrant, and each quadrant
// has ONE follow-up action the team should run. The action copy is admin-editable
// (config/segments); the maths lives here so the app, the API and the tests agree.
//
// This module is pure (no client/server-only imports).

import type { FitGate } from "./funnel";

export type QuadrantKey = "fit-high" | "fit-low" | "nofit-high" | "nofit-low";

export interface Quadrant {
  key: QuadrantKey;
  /** Short name shown on the matrix tile. */
  name: string;
  /** Row / column the tile sits in. */
  fit: "ICP fit" | "Below ICP";
  propensity: "High propensity" | "Low propensity";
  /** Lead grades (A–E) that land here — informational. */
  grades: string;
}

export const QUADRANTS: Quadrant[] = [
  { key: "fit-high",   name: "Fast-track",   fit: "ICP fit",   propensity: "High propensity", grades: "A · B" },
  { key: "fit-low",    name: "Nurture",      fit: "ICP fit",   propensity: "Low propensity",  grades: "C" },
  { key: "nofit-high", name: "Redirect",     fit: "Below ICP", propensity: "High propensity", grades: "D" },
  { key: "nofit-low",  name: "Deprioritise", fit: "Below ICP", propensity: "Low propensity",  grades: "E" },
];

// One follow-up per quadrant. `automation` is the hook the team wants to wire
// next (a Kit tag / sequence, a Slack ping…) — free text for now, so the plan is
// written down beside the numbers even before it's automated.
export interface FollowUpAction {
  title: string;
  description: string;
  owner: string;
  channel: string;
  automation: string;
}

export interface SegmentsConfig {
  /** Readiness score at or above which a prospect counts as "high propensity". 0–6. */
  propensityThreshold: number;
  actions: Record<QuadrantKey, FollowUpAction>;
}

export const DEFAULT_SEGMENTS: SegmentsConfig = {
  propensityThreshold: 3,
  actions: {
    "fit-high": {
      title: "Book a call within 24h",
      description: "Qualified and in a hurry. Personal outreach from a coach the same day, with a booking link.",
      owner: "Coach", channel: "Email + WhatsApp",
      automation: "Kit tag: compass-fast-track → coaching-offer sequence",
    },
    "fit-low": {
      title: "Nurture with the playbook",
      description: "Right profile, no urgency yet. Enrol in the onboarding sequence and let the Compass do the work.",
      owner: "Marketing", channel: "Email",
      automation: "Kit tag: compass-nurture → onboarding sequence",
    },
    "nofit-high": {
      title: "Redirect to the right offer",
      description: "Motivated but outside the ICP. Point them to the community / self-serve resources; manual review if flagged.",
      owner: "Community", channel: "Email",
      automation: "Kit tag: compass-redirect → community sequence",
    },
    "nofit-low": {
      title: "Keep on the list, no outreach",
      description: "Neither fit nor urgency. Stays on the newsletter; re-scored if they retake the quiz.",
      owner: "—", channel: "Newsletter",
      automation: "Kit tag: compass-cold",
    },
  },
};

/** Which quadrant a prospect with this fit + readiness lands in. */
export function quadrantFor(fit: FitGate | string | null | undefined, readiness: number | null | undefined, threshold = DEFAULT_SEGMENTS.propensityThreshold): QuadrantKey {
  const high = typeof readiness === "number" && readiness >= threshold;
  const isFit = fit === "qualified";
  if (isFit) return high ? "fit-high" : "fit-low";
  return high ? "nofit-high" : "nofit-low";
}

// Group anything carrying a fit + score (quiz respondents) by quadrant.
export function bucketRespondents<T extends { fit: string; score: number | null }>(rows: T[], threshold: number): Record<QuadrantKey, T[]> {
  const buckets: Record<QuadrantKey, T[]> = { "fit-high": [], "fit-low": [], "nofit-high": [], "nofit-low": [] };
  for (const r of rows) buckets[quadrantFor(r.fit, r.score, threshold)].push(r);
  return buckets;
}

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

// Coerce whatever is stored into the exact shape, back-filling from defaults.
export function mergeSegments(stored?: Partial<SegmentsConfig> | null): SegmentsConfig {
  const d = DEFAULT_SEGMENTS;
  const t = Number(stored?.propensityThreshold);
  const propensityThreshold = Number.isFinite(t) ? Math.min(6, Math.max(0, Math.round(t))) : d.propensityThreshold;
  const actions = {} as SegmentsConfig["actions"];
  for (const q of QUADRANTS) {
    const s = (stored?.actions?.[q.key] ?? {}) as Partial<FollowUpAction>;
    const def = d.actions[q.key];
    actions[q.key] = {
      title: str(s.title, def.title),
      description: str(s.description, def.description),
      owner: str(s.owner, def.owner),
      channel: str(s.channel, def.channel),
      automation: str(s.automation, def.automation),
    };
  }
  return { propensityThreshold, actions };
}
