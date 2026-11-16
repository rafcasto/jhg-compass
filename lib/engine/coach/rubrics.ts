// The scoring rubrics, in code (decision 2026-11-16, docs/UX_COACH_AGENTIC.md §9–§10). Wherever a coach
// asks the member for 1–5 numbers — Coach 1's skills, Coach 3's company fit — the scale is one of these:
// four axes, five anchors each, the same words for every member; the member scores every row at once in
// the panel's matrix (`ScoreMatrix`); and the arithmetic — totals, ranks, the tie-break, the cut — is the
// portal's, never the model's. A rubric's own flags and stored shape live beside it (skills.ts,
// companies.ts); this file is the shared core. Pure — tested.

import type { CoachKey } from "./keys";

export type RubricKind = "skills" | "companies";

export interface RubricAxis { key: string; label: string; short: string; anchors: readonly [string, string, string, string, string] }

export interface Rubric {
  kind: RubricKind;
  /** The coach whose conversation shows this matrix. */
  coach: CoachKey;
  /** "Score your skills" — the matrix's heading. */
  title: string;
  /** "skill" — what a row is; "skills" — several of them. */
  item: string;
  items: string;
  axes: readonly RubricAxis[];
  /** Axis keys that break a tie on total, in order; then the matrix's order. */
  tieBreak: readonly string[];
  /** How many rows go through: the playoff's six, the Top 10. */
  cut: number;
  /** "the top 6 go to the playoff" — under the scored table. */
  cutLine: string;
  min: number;
  max: number;
}

export const RUBRICS: Record<RubricKind, Rubric> = {
  skills: {
    kind: "skills", coach: "narrative", title: "Score your skills", item: "skill", items: "skills",
    axes: [
      { key: "good", label: "Good at it", short: "Good", anchors: ["Beginner", "Can do it with help", "Solid, unsupervised", "Others ask me for it", "Among the best I know"] },
      { key: "love", label: "Love it", short: "Love", anchors: ["Avoid it", "Tolerate it", "Fine", "Enjoy it", "Would do it unpaid"] },
      { key: "proof", label: "Can prove it", short: "Prove", anchors: ["Nothing to show", "No result in 10 seconds", "One example", "A result with a number", "Several results with numbers"] },
      { key: "pays", label: "Market pays", short: "Pays", anchors: ["Rarely in postings", "Nice to have", "Asked for", "Required and paid", "Scarce, paid a premium"] },
    ],
    tieBreak: ["proof", "pays", "love"], cut: 6, cutLine: "The line is the cut: the top 6 go to the playoff.", min: 3, max: 20,
  },
  companies: {
    kind: "companies", coach: "targetCompanies", title: "Score your companies", item: "company", items: "companies",
    axes: [
      { key: "growth", label: "Growth signals", short: "Growth", anchors: ["Shrinking or silent", "Steady, nothing new", "One recent signal", "Several dated signals", "Funding, hiring wave or expansion this quarter"] },
      { key: "interest", label: "Interest", short: "Interest", anchors: ["Would not go", "Only if nothing else", "Open to it", "Want to be there", "Top of my list, within my boundaries"] },
      { key: "access", label: "Access", short: "Access", anchors: ["Nobody, no route", "A cold application", "A community, event or posting", "A second-degree contact", "Someone I can message today"] },
      { key: "proof", label: "Proof", short: "Proof", anchors: ["No visible problem I solve", "A guess", "One competency fits a stated need", "A competency fits a problem they posted about", "My story answers a problem they are hiring for"] },
    ],
    tieBreak: ["interest", "proof"], cut: 10, cutLine: "The line is the cut: ranks 1–10 become your Top 10.", min: 3, max: 50,
  },
};

export const RUBRIC_KINDS = Object.keys(RUBRICS) as RubricKind[];
export const isRubricKind = (v: unknown): v is RubricKind => typeof v === "string" && v in RUBRICS;
export const rubricOf = (kind: RubricKind): Rubric => RUBRICS[kind];
/** The rubrics a coach's conversation may show. */
export const coachRubrics = (coach: CoachKey): Rubric[] => Object.values(RUBRICS).filter((r) => r.coach === coach);

export const MAX_ITEM_CHARS = 80;
export const maxTotal = (r: Rubric): number => 5 * r.axes.length;

/** One row as the member sends it: the item and its numbers in axis order. */
export interface MatrixRow { item: string; values: number[] }
/** One row as the portal returns it. */
export interface ScoredRow extends MatrixRow { total: number; rank: number }

const lower = (s: string) => s.trim().toLowerCase();
const inRange = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;

/** The items a coach hands the matrix, cleaned: trimmed, capped, de-duplicated (case-insensitive), within the rubric's bounds. */
export function cleanItems(raw: unknown, r: Rubric): { ok: true; items: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "items must be a list of strings" };
  const seen = new Set<string>();
  const items: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.trim().slice(0, MAX_ITEM_CHARS);
    if (!s || seen.has(lower(s))) continue;
    seen.add(lower(s));
    items.push(s);
  }
  if (items.length < r.min) return { ok: false, error: `at least ${r.min} ${r.items} — collect more first` };
  if (items.length > r.max) return { ok: false, error: `at most ${r.max} ${r.items} — cut the list with the member first` };
  return { ok: true, items };
}

/** The member's rows against the matrix they were shown: every item once, every axis 1–5, nothing else. Order follows the matrix. */
export function parseRows(raw: unknown, items: readonly string[], r: Rubric): { ok: true; rows: MatrixRow[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "scores must be a list" };
  const byName = new Map<string, MatrixRow>();
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const row = v as { item?: unknown; values?: unknown };
    if (typeof row.item !== "string") continue;
    const item = items.find((s) => lower(s) === lower(row.item as string));
    if (!item) return { ok: false, error: `"${row.item}" is not one of the ${r.items} in the matrix` };
    const values = Array.isArray(row.values) ? row.values : [];
    if (values.length !== r.axes.length || !values.every(inRange)) return { ok: false, error: `"${item}" needs ${r.axes.length} whole numbers from 1 to 5` };
    byName.set(lower(item), { item, values: values as number[] });
  }
  const missing = items.filter((s) => !byName.has(lower(s)));
  if (missing.length) return { ok: false, error: `Not scored yet: ${missing.join(", ")}` };
  return { ok: true, rows: items.map((s) => byName.get(lower(s))!) };
}

/** total = the sum; ranked by total, then the rubric's tie-break axes, then the matrix's order. Ranks 1…n. */
export function rankRows(rows: readonly MatrixRow[], r: Rubric): ScoredRow[] {
  const ix = r.tieBreak.map((k) => r.axes.findIndex((a) => a.key === k));
  const withTotal = rows.map((row, i) => ({ ...row, total: row.values.reduce((n, v) => n + v, 0), i }));
  const sorted = [...withTotal].sort((a, b) => (b.total - a.total) || ix.reduce((d, j) => d || (b.values[j] - a.values[j]), 0) || (a.i - b.i));
  const rank = new Map(sorted.map((s, k) => [s.i, k + 1]));
  return withTotal.map(({ i, ...row }) => ({ ...row, rank: rank.get(i)! }));
}

export const byRank = <T extends { rank: number }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.rank - b.rank);
export const topCut = <T extends { rank: number }>(rows: readonly T[], n: number): T[] => byRank(rows).slice(0, n);
export const valueOf = (row: MatrixRow, r: Rubric, axis: string): number => row.values[r.axes.findIndex((a) => a.key === axis)];

export interface MatrixFlag { id: string; line: string; items?: string[] }

/** The pattern flags every rubric shares: a scale that does not separate, totals that do not differ, a tie at the cut. */
export function commonFlags(scored: readonly ScoredRow[], r: Rubric, dropLine: string, keepLine: string): MatrixFlag[] {
  const out: MatrixFlag[] = [];
  if (!scored.length) return out;
  const cells = scored.flatMap((s) => s.values);
  const high = cells.filter((c) => c >= 4).length;
  if (scored.length >= 5 && high / cells.length >= 0.8) out.push({ id: "inflated", line: `${Math.round((high / cells.length) * 100)}% of the numbers are 4 or 5 — the scale is not separating anything. ${dropLine}` });
  const totals = scored.map((s) => s.total);
  if (scored.length >= 5 && Math.max(...totals) - Math.min(...totals) <= 2) out.push({ id: "flat", line: `The totals are within 2 points of each other — nothing stands out yet. ${keepLine}` });
  const ranked = byRank(scored);
  if (ranked.length > r.cut && ranked[r.cut - 1].total === ranked[r.cut].total) {
    const tb = r.axes.filter((a) => r.tieBreak.includes(a.key)).map((a) => a.short).join(", then ");
    out.push({ id: "tie_at_cut", line: `${ranked[r.cut - 1].item} and ${ranked[r.cut].item} tie at the cut (${ranked[r.cut].total}); the portal broke the tie on ${tb} — ask the member which one belongs above the line.`, items: [ranked[r.cut - 1].item, ranked[r.cut].item] });
  }
  return out;
}

/** The scored table as the coach reads it — a ranked Markdown table in the rubric's own columns. */
export function scoredTable(scored: readonly ScoredRow[], r: Rubric): string {
  const head = `| # | ${r.item[0].toUpperCase()}${r.item.slice(1)} | ${r.axes.map((a) => a.short).join(" | ")} | Total |`;
  const sep = `| --- | --- | ${r.axes.map(() => "---").join(" | ")} | --- |`;
  return [head, sep, ...byRank(scored).map((s) => `| ${s.rank} | ${s.item} | ${s.values.join(" | ")} | **${s.total}** |`)].join("\n");
}

/** "Scored 15 skills — ranked: a 20, b 12" — the recap line for a scored turn. */
export const scoredRecap = (scored: readonly ScoredRow[], r: Rubric): string => `Scored ${scored.length} ${scored.length === 1 ? r.item : r.items} — ranked: ${byRank(scored).map((s) => `${s.item} ${s.total}`).join(", ")}`;
