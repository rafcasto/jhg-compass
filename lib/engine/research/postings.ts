// The postings job — True North Part B as a job, not a turn (docs/COACH_ASSESSMENT_2026-11-16.md §1.2,
// docs/AGENTIC_PIPELINE_PLAN.md §4 step 2). Pure: what to search from, the schema the model answers,
// de-duplication, which postings count (opened — by code), the table the coach reads next turn.
// The handler (lib/engine/handlers/postings.ts) does the calls and the writes. Tested.

import { z } from "zod";
import type { ProfileFile } from "../../careerops/profile-file";
import type { JhgPosting } from "../../careerops/types";
import type { ProfilePortal } from "../../jobhacking/sections";

export const POSTINGS_TARGET = { min: 15, max: 20 } as const;
/** Searches per call — one or two per competency × board; the results never enter a transcript. */
export const POSTINGS_MAX_SEARCHES = 12;
export const POSTINGS_MAX_URL_CHECKS = 30;

export interface PostingsPayload {
  /** The Narrative's core competencies — what the market is searched for. */
  competencies: string[];
  /** Titles already bucketed as target, when Part B is re-run. */
  titles: string[];
  /** Where the member is based, as the goal or the Narrative says it. */
  region: string;
  /** The portal the member is on — the write's links go there. */
  portal: ProfilePortal;
  /** Boards the member already checks, in their words, when they said. */
  boards: string[];
}

const strings = (v: unknown, max = 8): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()).slice(0, max) : []);

/** What the job searches from: the profile first, the coach's hints over it. */
export function postingsPayload(profile: ProfileFile, hints: Record<string, unknown> = {}): PostingsPayload {
  const competencies = strings(hints.competencies).length ? strings(hints.competencies) : strings(profile.narrative?.superpowers, 5);
  const titles = strings(hints.titles).length ? strings(hints.titles) : strings(profile.jhg?.trueNorth?.titles?.target, 6);
  const region = (typeof hints.region === "string" && hints.region.trim()) || profile.goal?.city?.trim() || profile.jhg?.identity?.location?.trim() || profile.contact?.location?.trim() || [profile.jhg?.identity?.city, profile.jhg?.identity?.country].filter(Boolean).join(", ");
  return { competencies, titles, region, portal: hints.portal === "compass" ? "compass" : "jobhacking", boards: strings(hints.boards, 6) };
}

/** Nothing to search from — the Narrative has no competencies and no title was given. */
export const postingsPayloadEmpty = (p: PostingsPayload): boolean => !p.competencies.length && !p.titles.length;

/** The model's answer — one row per posting it read. */
export const PostingsSchema = z.object({
  postings: z.array(z.object({
    title: z.string().describe("The title as posted"),
    company: z.string().describe("The employer as the posting names it"),
    location: z.string().describe("As posted"),
    url: z.string().describe("The posting's own URL, exactly as returned by search — never constructed"),
    phrases: z.array(z.string()).describe("2–3 phrases quoted from the job description"),
  })).describe("Every live posting you read; aim for 20"),
  note: z.string().describe("One line on coverage: boards that answered, what was thin; '' when nothing to say"),
});
export type PostingsAnswer = z.infer<typeof PostingsSchema>;
export type RawPosting = PostingsAnswer["postings"][number];

/** The task message: the search brief in the shape the prompt expects. */
export function postingsTask(p: PostingsPayload, today: string): string {
  return [
    `Today: ${today}.`,
    `Region: ${p.region || "(not given — ask nothing; search the member's country if the competencies imply one, else globally remote)"}.`,
    `Core competencies: ${p.competencies.join(" · ") || "(none)"}.`,
    p.titles.length ? `Titles already chosen as target: ${p.titles.join(" · ")}.` : "No titles chosen yet — let the postings propose them.",
    p.boards.length ? `Boards the member already checks: ${p.boards.join(" · ")}.` : "",
    `Return ${POSTINGS_TARGET.min}–${POSTINGS_TARGET.max} postings.`,
  ].filter(Boolean).join("\n");
}

const key = (x: { company: string; title: string; location: string }) => [x.company, x.title, x.location].map((s) => s.trim().toLowerCase().replace(/\s+/g, " ")).join("|");
const isUrl = (u: string) => /^https?:\/\/\S+$/i.test(u.trim());

/** Same company, title and location is one posting; a row without an absolute URL is no posting. */
export function dedupePostings(rows: readonly RawPosting[]): RawPosting[] {
  const seen = new Set<string>();
  const out: RawPosting[] = [];
  for (const r of rows) {
    if (!r.title?.trim() || !r.company?.trim() || !isUrl(r.url ?? "")) continue;
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...r, url: r.url.trim(), phrases: (r.phrases ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 3) });
  }
  return out;
}

/** The URL as search returned it — a posting counts only when it was in the results or opened (the handler checks reachability). */
export const urlWasFound = (url: string, sources: readonly { url: string }[]): boolean => {
  const u = url.toLowerCase().replace(/\/+$/, "");
  return sources.some((s) => { const v = s.url.toLowerCase().replace(/\/+$/, ""); return v === u || v.startsWith(`${u}?`) || u.startsWith(`${v}?`); });
};

/** The rows that count, as the profile stores them, dated today — at most the target. */
export function toProfilePostings(rows: readonly RawPosting[], today: string, max = POSTINGS_TARGET.max): JhgPosting[] {
  return rows.slice(0, max).map((r) => ({ title: r.title.trim(), company: r.company.trim(), location: r.location?.trim() ?? "", url: r.url, phrases: r.phrases, verified: today }));
}

/** The table the coach reads on its next turn — the result in 20 rows, never the pages. */
export function postingsSummary(postings: readonly JhgPosting[], dropped: number, note: string): string {
  const rows = postings.map((p, i) => `| ${i + 1} | ${p.title} | ${p.company} | ${p.location ?? ""} | ${p.url} | ${(p.phrases ?? []).join("; ")} |`);
  return [
    `${postings.length} postings opened and written to jhg.trueNorth.postings${dropped ? ` (${dropped} dropped: dead or duplicate links)` : ""}.${note ? ` ${note}` : ""}`,
    "| # | Title | Company | Location | URL | Phrases |",
    "|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

export interface PostingsResult { count: number; dropped: number; summary: string; searches: number }
