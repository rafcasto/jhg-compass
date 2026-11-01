// Artefacts — WHAT VALUE DO I CREATE. docs/UX_PROFILE.md §7 / §8.
//
// Two sections, both the member's own evidence:
//
//   stories      Stories L1 + L2. L1 is the "remember a time when…" — the
//                project or achievement, named. L2 is its CCARR breakdown:
//                Context (situation) · Challenge (task) · Activities (action) ·
//                Result · Relevance (for which target company / archetype).
//                STAR with the frame the JobHackers method uses.
//   proofPoints  The proof bank — a library of proof points, each with a hero
//                metric, a short line for the CV and a long version for
//                interviews, plus an optional link. career-ops reads the
//                name / url / hero_metric triple as narrative.proof_points.
//
// Pure — no React, no Firestore. Validated the same way personalization.ts
// validates its rows: strings are extracted and capped, never obeyed.

export interface Story {
  /** L1 — the project or achievement, as a title. Required. */
  title: string;
  /** CCARR — Context: the situation. */
  context?: string;
  /** CCARR — Challenge: the task or problem. */
  challenge?: string;
  /** CCARR — Activities: what you actually did. */
  activities?: string;
  /** CCARR — Result: the measurable value delivered. */
  result?: string;
  /** CCARR — Relevance: for which target company, role or archetype this story lands. */
  relevance?: string;
}

export interface ProofPoint {
  /** The project, article, case study or credential. Required. */
  name: string;
  /** The one number — "Halved production incidents", "2K+ GitHub stars". career-ops: hero_metric. */
  metric?: string;
  /** One line for the CV. */
  short?: string;
  /** The long version for interviews. */
  long?: string;
  /** Where it can be seen. career-ops: url. */
  url?: string;
}

export const STORY_FIELDS = ["context", "challenge", "activities", "result", "relevance"] as const;
export type StoryField = (typeof STORY_FIELDS)[number];

/** Member-facing words for CCARR. */
export const STORY_COPY: Record<StoryField, { label: string; hint: string; placeholder: string }> = {
  context: { label: "Context", hint: "The situation — where, when, what was at stake.", placeholder: "e.g. A 40-engineer SaaS team shipping monthly, with every release breaking something." },
  challenge: { label: "Challenge", hint: "The task or problem that was yours.", placeholder: "e.g. Get to fortnightly releases without adding process the engineers would resent." },
  activities: { label: "Activities", hint: "What you actually did — your actions, not the team's.", placeholder: "e.g. Introduced a release train, a dependency board and a 15-minute pre-release review." },
  result: { label: "Result", hint: "The measurable value delivered. Numbers, not adjectives.", placeholder: "e.g. Fortnightly releases in two quarters; production incidents halved." },
  relevance: { label: "Relevance", hint: "Which target company, role or archetype this story is for.", placeholder: "e.g. Delivery Lead roles at scale-ups where releases have started to hurt." },
};

export const PROOF_FIELDS = ["metric", "short", "long", "url"] as const;
export type ProofField = (typeof PROOF_FIELDS)[number];

export const PROOF_COPY: Record<ProofField, { label: string; hint: string; placeholder: string }> = {
  metric: { label: "Hero metric", hint: "The one number.", placeholder: "e.g. Reduced inference latency 40%" },
  short: { label: "CV line", hint: "One line, as it would read on the CV.", placeholder: "e.g. Cut p95 inference latency 40% by moving to batched GPU scheduling." },
  long: { label: "Interview version", hint: "The longer telling — what, how, and what it changed.", placeholder: "e.g. The model-serving layer was the slowest part of the product…" },
  url: { label: "Link", hint: "Optional — a page, repo, article or demo.", placeholder: "https://…" },
};

export const ARTEFACT_CAPS = {
  stories: 12,
  proofPoints: 20,
  /** Per field. */
  storyTitle: 120,
  storyField: 600,
  proofName: 120,
  proofMetric: 160,
  proofShort: 240,
  proofLong: 1200,
  proofUrl: 300,
} as const;

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};

/** Stories from an untrusted value: only rows with a title, each field trimmed and capped, at most ARTEFACT_CAPS.stories. */
export function coerceStories(raw: unknown): Story[] {
  if (!Array.isArray(raw)) return [];
  const out: Story[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = str(r.title, ARTEFACT_CAPS.storyTitle);
    if (!title) continue;
    const s: Story = { title };
    for (const f of STORY_FIELDS) {
      const v = str(r[f], ARTEFACT_CAPS.storyField);
      if (v) s[f] = v;
    }
    out.push(s);
    if (out.length >= ARTEFACT_CAPS.stories) break;
  }
  return out;
}

/** Proof points from an untrusted value: only rows with a name; a link that is not http(s) is dropped, the row kept. */
export function coerceProofPoints(raw: unknown): ProofPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: ProofPoint[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = str(r.name, ARTEFACT_CAPS.proofName);
    if (!name) continue;
    const p: ProofPoint = { name };
    const metric = str(r.metric, ARTEFACT_CAPS.proofMetric);
    const short = str(r.short, ARTEFACT_CAPS.proofShort);
    const long = str(r.long, ARTEFACT_CAPS.proofLong);
    const url = str(r.url, ARTEFACT_CAPS.proofUrl);
    if (metric) p.metric = metric;
    if (short) p.short = short;
    if (long) p.long = long;
    if (url && /^https?:\/\//i.test(url)) p.url = url;
    out.push(p);
    if (out.length >= ARTEFACT_CAPS.proofPoints) break;
  }
  return out;
}

/** A story is told once it has at least the result on top of the title; CCARR complete = all five. */
export const storyFilled = (s: Story): number => STORY_FIELDS.filter((f) => !!s[f]?.trim()).length;
export const storyComplete = (s: Story): boolean => storyFilled(s) === STORY_FIELDS.length;

/** A proof point is usable by the agents once it has its metric or its CV line. */
export const proofUsable = (p: ProofPoint): boolean => !!(p.metric?.trim() || p.short?.trim());

/**
 * career-ops narrative.proof_points — the triple its CV and cover-letter
 * builders read. The CV line stands in for a missing metric so a proof point
 * written for the CV still reaches the file.
 */
export function proofPointsForCareerOps(points: ProofPoint[] | undefined): { name: string; url?: string; hero_metric?: string }[] {
  return (points ?? []).map((p) => {
    const row: { name: string; url?: string; hero_metric?: string } = { name: p.name };
    if (p.url) row.url = p.url;
    const metric = p.metric ?? p.short;
    if (metric) row.hero_metric = metric;
    return row;
  });
}

/** career-ops narrative.proof_points → proof bank. Only the triple exists upstream, so short/long stay empty. */
export function proofPointsFromCareerOps(raw: unknown): ProofPoint[] {
  if (!Array.isArray(raw)) return [];
  return coerceProofPoints(raw.map((row) => {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    return { name: r.name, metric: r.hero_metric, url: r.url };
  }));
}
