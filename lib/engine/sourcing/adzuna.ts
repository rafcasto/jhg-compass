// Adzuna — the primary structured aggregator (docs/AGENTIC_PIPELINE_PLAN.md §5: NZ · AU · US · CA on one key).
// Pure: the request URL and the parse of one page. The fetch is in ./fetch.ts. Tested.
// API: https://developer.adzuna.com/ — GET /v1/api/jobs/{country}/search/{page}?app_id&app_key&what&where&results_per_page&max_days_old

import type { PipelineCountry, SourcedPosting } from "./keys";

export const ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs";
export const ADZUNA_PAGE_SIZE = 25;
export const ADZUNA_MAX_DAYS_OLD = 30;

export const adzunaConfigured = (env: Record<string, string | undefined> = process.env): boolean => !!(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY);

export interface AdzunaQuery { country: PipelineCountry; what: string; where: string; page?: number }

export function adzunaUrl(q: AdzunaQuery, env: Record<string, string | undefined> = process.env): string {
  const u = new URL(`${ADZUNA_BASE}/${q.country}/search/${q.page ?? 1}`);
  u.searchParams.set("app_id", env.ADZUNA_APP_ID ?? "");
  u.searchParams.set("app_key", env.ADZUNA_APP_KEY ?? "");
  u.searchParams.set("results_per_page", String(ADZUNA_PAGE_SIZE));
  u.searchParams.set("what", q.what);
  if (q.where) u.searchParams.set("where", q.where);
  u.searchParams.set("max_days_old", String(ADZUNA_MAX_DAYS_OLD));
  u.searchParams.set("content-type", "application/json");
  return u.toString();
}

interface AdzunaResult { id?: unknown; title?: unknown; description?: unknown; redirect_url?: unknown; created?: unknown; company?: { display_name?: unknown }; location?: { display_name?: unknown } }

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** One page of results → postings; rows without an id, a title, a company or a URL are skipped. */
export function parseAdzuna(json: unknown, country: PipelineCountry): SourcedPosting[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: SourcedPosting[] = [];
  for (const r of results as AdzunaResult[]) {
    const externalId = str(r.id), title = str(r.title), company = str(r.company?.display_name), url = str(r.redirect_url);
    if (!externalId || !title || !company || !/^https?:\/\//i.test(url)) continue;
    out.push({ source: "adzuna", externalId, title, company, location: str(r.location?.display_name), country, url, description: str(r.description), postedAt: str(r.created).slice(0, 10) });
  }
  return out;
}
