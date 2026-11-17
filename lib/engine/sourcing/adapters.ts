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
  adzuna: { source: "adzuna", metered: false, maxQueries: 8, configured: adzunaConfigured, url: (q, country, env) => adzunaUrl({ country, what: q.what, where: q.where }, env), parse: (json, country) => parseAdzuna(json, country) },
  careerjet: { source: "careerjet", metered: false, maxQueries: 8, configured: careerjetConfigured, url: (q, country, env) => careerjetUrl({ country, keywords: q.what, location: q.where }, env), parse: (json, country) => parseCareerjet(json, country) },
  jsearch: { source: "jsearch", metered: true, maxQueries: JSEARCH_MAX_QUERIES, configured: jsearchConfigured, url: (q, country) => jsearchUrl({ country, q: q.what, location: q.where }), headers: jsearchHeaders, parse: (json, country) => parseJsearch(json, country) },
  serp: { source: "serp", metered: true, maxQueries: SERP_MAX_QUERIES, configured: serpConfigured, url: (q, country, env) => serpJobsUrl({ country, q: q.what, location: q.where }, env), parse: parseSerpJobs },
};

/** The adapters with a key, free ones first, in the registry's order — and one metered source at most: both Google routes carry the same data, so the first configured (JSearch, the cheaper) runs and the other stays idle. */
export const configuredAdapters = (env: Env = process.env): SourceAdapter[] => {
  const on = SOURCES.map((s) => ADAPTERS[s]).filter((a) => a.configured(env));
  const metered = on.filter((a) => a.metered);
  return [...on.filter((a) => !a.metered), ...metered.slice(0, 1)];
};
