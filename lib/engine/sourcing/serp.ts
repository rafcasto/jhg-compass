// SerpApi `google_jobs` — the Google for Jobs top-up (docs/AGENTIC_PIPELINE_PLAN.md §5; docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md
// §5 decision 1, taken 2026-11-17: SerpApi, for the top-up only). It is how Seek postings come in without Seek's API: Google
// indexes them, the result carries the Seek apply link, and the job opens it. The one metered source — every query is one
// paid search — so it runs after the free aggregators and only to fill the gap. Pure: the URL, the parse, the relative dates.
// API: https://serpapi.com/google-jobs-api — GET /search.json?engine=google_jobs&q&location&gl&hl&api_key

import type { PipelineCountry, SourcedPosting } from "./keys";

export const SERP_BASE = "https://serpapi.com/search.json";
/** Queries a run may spend on the top-up — titles first (queriesFor orders them so). */
export const SERP_MAX_QUERIES = 4;

export const serpConfigured = (env: Record<string, string | undefined> = process.env): boolean => !!env.SERPAPI_KEY;

export interface SerpJobsQuery { country: PipelineCountry; q: string; location: string }

/** google_jobs takes the free aggregators' same brief: the title or competency as q, the city as location, the country as gl. */
export function serpJobsUrl(q: SerpJobsQuery, env: Record<string, string | undefined> = process.env): string {
  const u = new URL(SERP_BASE);
  u.searchParams.set("engine", "google_jobs");
  u.searchParams.set("q", q.q);
  if (q.location) u.searchParams.set("location", q.location);
  u.searchParams.set("gl", q.country);
  u.searchParams.set("hl", "en");
  u.searchParams.set("api_key", env.SERPAPI_KEY ?? "");
  return u.toString();
}

interface SerpJob { job_id?: unknown; title?: unknown; company_name?: unknown; location?: unknown; via?: unknown; description?: unknown; share_link?: unknown; apply_options?: { title?: unknown; link?: unknown }[]; detected_extensions?: { posted_at?: unknown } }

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** "3 days ago" · "2 hours ago" · "1 week ago" · "30+ days ago" → an ISO date before today; "" when the text says nothing. */
export function postedAtFrom(text: string, today: string): string {
  const m = text.trim().toLowerCase().match(/^(\d+)\+?\s*(hour|day|week|month)s?\s+ago$/);
  if (!m) return /^(just posted|today)$/i.test(text.trim()) ? today : "";
  const n = parseInt(m[1], 10);
  const days = m[2] === "hour" ? 0 : m[2] === "day" ? n : m[2] === "week" ? n * 7 : n * 30;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** One page of jobs_results → postings. The URL is the first apply link (the board's own page — Seek, LinkedIn, a careers site), else the share link. */
export function parseSerpJobs(json: unknown, country: PipelineCountry, today: string): SourcedPosting[] {
  const jobs = (json as { jobs_results?: unknown } | null)?.jobs_results;
  if (!Array.isArray(jobs)) return [];
  const out: SourcedPosting[] = [];
  for (const j of jobs as SerpJob[]) {
    const title = str(j.title), company = str(j.company_name);
    const apply = (j.apply_options ?? []).map((o) => str(o.link)).find((l) => /^https?:\/\//i.test(l));
    const url = apply ?? (/^https?:\/\//i.test(str(j.share_link)) ? str(j.share_link) : "");
    const externalId = str(j.job_id) || url;
    if (!title || !company || !url || !externalId) continue;
    const via = str(j.via).replace(/^via\s+/i, "");
    out.push({ source: "serp", externalId: externalId.slice(0, 120), title, company, location: str(j.location), country, url, description: `${via ? `[${via}] ` : ""}${str(j.description)}`, postedAt: postedAtFrom(str(j.detected_extensions?.posted_at), today) });
  }
  return out;
}

/** The top-up runs only to fill a gap: when the free sources came back below `enough` unique rows, or when they are the only source there is. */
export const serpTopUpNeeded = (uniqueSoFar: number, freeSourcesRan: boolean, enough: number): boolean => !freeSourcesRan || uniqueSoFar < enough;
