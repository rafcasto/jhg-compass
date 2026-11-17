// The adapter registry (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §2 row 2): one shape per source — configured?, the
// request URL for a planned query, the parse of a page — so fetch.ts runs them in order without knowing any of them. Free
// sources first; the metered one last, as a top-up, with its own query cap. Pure. Tested.

import { adzunaConfigured, adzunaUrl, parseAdzuna } from "./adzuna";
import { careerjetConfigured, careerjetUrl, parseCareerjet } from "./careerjet";
import { SERP_MAX_QUERIES, parseSerpJobs, serpConfigured, serpJobsUrl } from "./serp";
import { JSEARCH_MAX_QUERIES, jsearchConfigured, jsearchHeaders, jsearchUrl, parseJsearch } from "./jsearch";
import { SOURCES, type PipelineCountry, type Source, type SourcedPosting } from "./keys";
import type { PlannedQuery } from "./plan";

type Env = Record<string, string | undefined>;

export interface SourceAdapter {
  source: Source;
  /** Every query costs money — runs last, only to fill a gap, within its own cap. */
  metered: boolean;
  maxQueries: number;
  configured: (env: Env) => boolean;
  url: (q: PlannedQuery, country: PipelineCountry, env: Env) => string;
  /** Request headers the source needs (RapidAPI's key header); none for a key in the URL. */
  headers?: (env: Env) => Record<string, string>;
  parse: (json: unknown, country: PipelineCountry, today: string) => SourcedPosting[];
}

export const ADAPTERS: Record<Source, SourceAdapter> = {
  // Adzuna's free plan is 25 hits a month (read 2026-11-18, UK products listed) — metered, and last in line so it is never the one spent.
  adzuna: { source: "adzuna", metered: true, maxQueries: 4, configured: adzunaConfigured, url: (q, country, env) => adzunaUrl({ country, what: q.what, where: q.where }, env), parse: (json, country) => parseAdzuna(json, country) },
  careerjet: { source: "careerjet", metered: false, maxQueries: 8, configured: careerjetConfigured, url: (q, country, env) => careerjetUrl({ country, keywords: q.what, location: q.where }, env), parse: (json, country) => parseCareerjet(json, country) },
  jsearch: { source: "jsearch", metered: true, maxQueries: JSEARCH_MAX_QUERIES, configured: jsearchConfigured, url: (q, country) => jsearchUrl({ country, q: q.what, location: q.where }), headers: jsearchHeaders, parse: (json, country) => parseJsearch(json, country) },
  serp: { source: "serp", metered: true, maxQueries: SERP_MAX_QUERIES, configured: serpConfigured, url: (q, country, env) => serpJobsUrl({ country, q: q.what, location: q.where }, env), parse: parseSerpJobs },
};

/** The adapters with a key, free ones first, then the metered ones in the registry's order (JSearch, the cheaper, before SerpApi). The run uses one metered source and falls back to the next only when the first is out (quota, rate limit) — both Google routes carry the same data. */
export const configuredAdapters = (env: Env = process.env): SourceAdapter[] => {
  const on = SOURCES.map((s) => ADAPTERS[s]).filter((a) => a.configured(env));
  return [...on.filter((a) => !a.metered), ...on.filter((a) => a.metered)];
};

/** RapidAPI and SerpApi say "out" with a 429: the plan's monthly quota, or requests too close together. */
export const isQuotaError = (message: string): boolean => /\b429\b|too many requests|quota|rate limit/i.test(message);

/** A key that cannot be used — RapidAPI's 403 "You are not subscribed to this API", a 401 "Invalid API key" — is out for the whole run just as a quota is. */
export const isAuthError = (message: string): boolean => /\b40[13]\b|not subscribed|invalid api key|unauthori[sz]ed|forbidden/i.test(message);
/** Out for this run, either way: the plan is spent, or the key cannot be used. The next metered source takes over. */
export const isSourceOut = (message: string): boolean => isQuotaError(message) || isAuthError(message);

/** What a 401/403 means, by source — the fix is on the provider's site, not in the code. */
export const authWords = (source: Source): string => source === "jsearch"
  ? "the RapidAPI key is not subscribed to JSearch — open the JSearch API on RapidAPI → Pricing → subscribe to the free Basic plan (the key alone does nothing)"
  : source === "serp" ? "the SerpApi key was refused — check it on serpapi.com → account" : source === "adzuna" ? "the Adzuna app id or key was refused — check developer.adzuna.com" : "the key was refused";

/** What a 429 means to the member and the admin, by source. */
export const quotaWords = (source: Source): string => source === "jsearch"
  ? "JSearch's RapidAPI plan is out of requests for the month (the free plan is 200) or we asked too fast — check RapidAPI → My Apps → JSearch → usage"
  : source === "serp" ? "SerpApi's plan is out of searches for the month or we asked too fast — check serpapi.com → account" : "the source refused: too many requests";
