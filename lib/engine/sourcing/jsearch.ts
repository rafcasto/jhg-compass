// JSearch (OpenWeb Ninja, via RapidAPI) — Google for Jobs data, the cheaper of the two Google routes
// (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §5 decision 1; the comparison of 2026-11-17). Same inventory as SerpApi's
// google_jobs — Seek postings included — with the full job description, so the phrases can be quoted from the JD, not a
// snippet. Metered (a RapidAPI quota), so it runs after the free sources; when both Google routes have a key, this one runs
// and SerpApi stays idle. Pure: the URL, the headers, the parse. The fetch is in ./fetch.ts. Tested.
// API: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch — GET /search?query&page&num_pages&country&date_posted

import type { PipelineCountry, SourcedPosting } from "./keys";

// Two doors to the same API: RapidAPI's marketplace gateway (the key in x-rapidapi-key, the host header), or OpenWeb Ninja's own
// platform — app.openwebninja.com — (the key in x-api-key). JSEARCH_PROVIDER picks the door; the data and the query are the same.
export const JSEARCH_PROVIDERS = ["rapidapi", "openwebninja"] as const;
export type JsearchProvider = (typeof JSEARCH_PROVIDERS)[number];
export const JSEARCH_BASE = "https://jsearch.p.rapidapi.com/search";
export const JSEARCH_HOST = "jsearch.p.rapidapi.com";
export const OPENWEBNINJA_BASE = "https://api.openwebninja.com/jsearch/search";
/** Queries a run may spend on the top-up — titles first (queriesFor orders them so). */
export const JSEARCH_MAX_QUERIES = 4;

type Env = Record<string, string | undefined>;

export const jsearchConfigured = (env: Env = process.env): boolean => !!env.JSEARCH_API_KEY;

/** Which door the key opens — JSEARCH_PROVIDER, default RapidAPI (the marketplace most keys come from). */
export const jsearchProvider = (env: Env = process.env): JsearchProvider => (env.JSEARCH_PROVIDER === "openwebninja" ? "openwebninja" : "rapidapi");

export interface JsearchQuery { country: PipelineCountry; q: string; location: string }

/** JSearch takes the place in the query ("Product Manager in Auckland"), the country as a code, and a freshness window. */
export function jsearchUrl(q: JsearchQuery, env: Env = process.env): string {
  const u = new URL(jsearchProvider(env) === "openwebninja" ? OPENWEBNINJA_BASE : JSEARCH_BASE);
  u.searchParams.set("query", q.location ? `${q.q} in ${q.location}` : q.q);
  u.searchParams.set("page", "1");
  u.searchParams.set("num_pages", "1");
  u.searchParams.set("country", q.country);
  u.searchParams.set("date_posted", "month");
  return u.toString();
}

export const jsearchHeaders = (env: Env = process.env): Record<string, string> => jsearchProvider(env) === "openwebninja"
  ? { "x-api-key": env.JSEARCH_API_KEY ?? "" }
  : { "x-rapidapi-key": env.JSEARCH_API_KEY ?? "", "x-rapidapi-host": JSEARCH_HOST };

interface JsearchJob {
  job_id?: unknown; job_title?: unknown; employer_name?: unknown; employer_website?: unknown; job_publisher?: unknown; job_apply_link?: unknown;
  job_description?: unknown; job_city?: unknown; job_state?: unknown; job_country?: unknown; job_posted_at_datetime_utc?: unknown;
  apply_options?: { publisher?: unknown; apply_link?: unknown }[];
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** { status: "OK", data: [] } → postings; the apply link is the URL (the board's own page), the publisher's name rides the description. */
export function parseJsearch(json: unknown, country: PipelineCountry): SourcedPosting[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const out: SourcedPosting[] = [];
  for (const j of data as JsearchJob[]) {
    const title = str(j.job_title), company = str(j.employer_name);
    const apply = str(j.job_apply_link) || (j.apply_options ?? []).map((o) => str(o.apply_link)).find((l) => /^https?:\/\//i.test(l)) || "";
    const externalId = str(j.job_id) || apply;
    if (!title || !company || !/^https?:\/\//i.test(apply) || !externalId) continue;
    const location = [str(j.job_city), str(j.job_state), str(j.job_country)].filter(Boolean).join(", ");
    const via = str(j.job_publisher);
    const website = str(j.employer_website);
    out.push({ source: "jsearch", externalId: externalId.slice(0, 120), title, company, location, country, url: apply, description: `${via ? `[${via}] ` : ""}${str(j.job_description)}`, postedAt: str(j.job_posted_at_datetime_utc).slice(0, 10), ...(website ? { companyWebsite: website } : {}) });
  }
  return out;
}
