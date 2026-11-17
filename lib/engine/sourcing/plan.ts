// The planner and the merge (docs/AGENTIC_PIPELINE_PLAN.md §4 steps 1–2). The planner is code in v1 — titles × region
// first, competencies after — not the Haiku call the plan names: a query list is checkable, and a model earns its place
// only when the eval says the code's queries miss postings. Pure. Tested.

import type { RawPosting } from "../research/postings";
import { cityOf, type PipelineCountry, type SourcedPosting } from "./keys";

export const MAX_QUERIES = 8;

export interface SourcingBrief { titles: string[]; competencies: string[]; region: string; country: PipelineCountry }
export interface PlannedQuery { what: string; where: string; from: "title" | "competency" }

/** The queries a run makes, titles first (the market's words) then competencies, ≤ MAX_QUERIES, no duplicates. */
export function queriesFor(b: SourcingBrief, max = MAX_QUERIES): PlannedQuery[] {
  const where = cityOf(b.region);
  const seen = new Set<string>();
  const out: PlannedQuery[] = [];
  const add = (what: string, from: PlannedQuery["from"]) => {
    const w = what.trim().replace(/\s+/g, " ");
    const k = w.toLowerCase();
    if (!w || seen.has(k) || out.length >= max) return;
    seen.add(k); out.push({ what: w, where, from });
  };
  for (const t of b.titles) add(t, "title");
  for (const c of b.competencies) add(c, "competency");
  return out;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const key = (p: Pick<SourcedPosting, "company" | "title" | "location">) => [p.company, p.title, p.location].map(norm).join("|");

/** Several sources' pages → one list: same company · title · location is one posting; the first source to return it wins. */
export function mergePostings(lists: readonly (readonly SourcedPosting[])[]): SourcedPosting[] {
  const seen = new Set<string>();
  const out: SourcedPosting[] = [];
  for (const list of lists) for (const p of list) {
    const k = key(p);
    if (seen.has(k)) continue;
    seen.add(k); out.push(p);
  }
  return out;
}

/** Newest first when both carry a date; undated rows keep their order after the dated ones. */
export function newestFirst(rows: readonly SourcedPosting[]): SourcedPosting[] {
  return [...rows].sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""));
}

/** The shape the postings job's verify-and-write half already takes — phrases come later, from the descriptions. */
export const toRawPosting = (p: SourcedPosting): RawPosting => ({ title: p.title, company: p.company, location: p.location, url: p.url, phrases: [] });

/** The coverage line the coach reads: which sources answered, how many queries, how many unique. */
export function sourcingNote(parts: readonly { source: string; country: PipelineCountry; queries: number; rows: number; error?: string }[], unique: number): string {
  const said = parts.map((p) => (p.error ? `${p.source} (${p.country}) failed: ${p.error}` : `${p.source} (${p.country}) · ${p.queries} queries · ${p.rows} rows`));
  return `Sourced by API — ${said.join("; ")}; ${unique} unique.`;
}
