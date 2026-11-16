// Careerjet — the second aggregator (docs/AGENTIC_PIPELINE_PLAN.md §5: AU · US · CA; NZ has a locale too).
// Pure: the request URL and the parse. The fetch is in ./fetch.ts. Tested.
// API: https://www.careerjet.com/partners/api/ — GET public.api.careerjet.net/search?locale_code&keywords&location&affid&user_ip&user_agent&url&pagesize&sort

import type { PipelineCountry, SourcedPosting } from "./keys";

export const CAREERJET_BASE = "https://public.api.careerjet.net/search";
export const CAREERJET_PAGE_SIZE = 25;
export const CAREERJET_LOCALES: Record<PipelineCountry, string> = { nz: "en_NZ", au: "en_AU", us: "en_US", ca: "en_CA" };

export const careerjetConfigured = (env: Record<string, string | undefined> = process.env): boolean => !!env.CAREERJET_AFFID;

export interface CareerjetQuery { country: PipelineCountry; keywords: string; location: string; page?: number }

export function careerjetUrl(q: CareerjetQuery, env: Record<string, string | undefined> = process.env, referer = env.APP_URL || "https://compass.jobhackers.global"): string {
  const u = new URL(CAREERJET_BASE);
  u.searchParams.set("locale_code", CAREERJET_LOCALES[q.country]);
  u.searchParams.set("keywords", q.keywords);
  if (q.location) u.searchParams.set("location", q.location);
  u.searchParams.set("affid", env.CAREERJET_AFFID ?? "");
  u.searchParams.set("user_ip", "127.0.0.1");
  u.searchParams.set("user_agent", "JobHackerCompass/1.0");
  u.searchParams.set("url", referer);
  u.searchParams.set("pagesize", String(CAREERJET_PAGE_SIZE));
  u.searchParams.set("page", String(q.page ?? 1));
  u.searchParams.set("sort", "date");
  return u.toString();
}

interface CareerjetJob { title?: unknown; company?: unknown; locations?: unknown; url?: unknown; description?: unknown; date?: unknown }

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The API answers { type: "JOBS", jobs: [] } — or an ERROR type. Careerjet has no stable id: the URL's path is the id. */
export function parseCareerjet(json: unknown, country: PipelineCountry): SourcedPosting[] {
  const jobs = (json as { jobs?: unknown } | null)?.jobs;
  if (!Array.isArray(jobs)) return [];
  const out: SourcedPosting[] = [];
  for (const j of jobs as CareerjetJob[]) {
    const title = str(j.title), company = str(j.company), url = str(j.url);
    if (!title || !company || !/^https?:\/\//i.test(url)) continue;
    let externalId = "";
    try { externalId = new URL(url).pathname.replace(/^\/+|\/+$/g, "").replace(/\.html?$/i, "") || url; } catch { externalId = url; }
    out.push({ source: "careerjet", externalId, title, company, location: str(j.locations), country, url, description: str(j.description), postedAt: str(j.date).slice(0, 10) });
  }
  return out;
}
