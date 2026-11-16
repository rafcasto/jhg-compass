// The sourcing layer's contract (docs/AGENTIC_PIPELINE_PLAN.md §4 step 2, §5; docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md
// §2 row 2): the countries the pipeline runs sources for, the sources, one posting as a source returns it, and the
// ids of the shared collections. Pure — no fetch, no Firebase. Tested.

/** The country enum lives on the pipeline, never on the profile (plan §2 decision 7) — which sources run. */
export const PIPELINE_COUNTRIES = ["nz", "au", "us", "ca"] as const;
export type PipelineCountry = (typeof PIPELINE_COUNTRIES)[number];
export const isPipelineCountry = (v: unknown): v is PipelineCountry => (PIPELINE_COUNTRIES as readonly string[]).includes(v as string);

export const COUNTRY_LABELS: Record<PipelineCountry, string> = { nz: "New Zealand", au: "Australia", us: "United States", ca: "Canada" };

// The words a member writes for where they are — country names, codes and the cities a search is run from.
const COUNTRY_WORDS: Record<PipelineCountry, readonly string[]> = {
  nz: ["new zealand", "nz", "aotearoa", "auckland", "wellington", "christchurch", "hamilton", "tauranga", "dunedin", "queenstown"],
  au: ["australia", "au", "sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra", "hobart", "gold coast"],
  us: ["united states", "usa", "u.s.", "us", "new york", "san francisco", "seattle", "austin", "boston", "chicago", "los angeles", "denver", "atlanta", "miami"],
  ca: ["canada", "ca", "toronto", "vancouver", "montreal", "montréal", "calgary", "ottawa", "edmonton"],
};

/** The pipeline country a region string names — "Auckland, New Zealand" → nz; null when no source covers it. */
export function countryOf(region: string | null | undefined): PipelineCountry | null {
  const r = ` ${(region ?? "").toLowerCase().replace(/[(),/;]+/g, " ").replace(/\s+/g, " ").trim()} `;
  if (r.trim() === "") return null;
  // A country name wins over a city; a city wins over a bare code (so "US" never beats "Sydney, AU"… which also never happens).
  for (const c of PIPELINE_COUNTRIES) if (r.includes(` ${COUNTRY_LABELS[c].toLowerCase()} `)) return c;
  for (const c of PIPELINE_COUNTRIES) for (const w of COUNTRY_WORDS[c]) if (w.length > 3 && r.includes(` ${w} `)) return c;
  for (const c of PIPELINE_COUNTRIES) for (const w of COUNTRY_WORDS[c]) if (w.length <= 3 && r.includes(` ${w} `)) return c;
  return null;
}

/** The city half of a region — "Auckland, New Zealand" → "Auckland"; the whole string when there is no comma. */
export const cityOf = (region: string): string => region.split(",")[0].trim();

export const SOURCES = ["adzuna", "careerjet"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABELS: Record<Source, string> = { adzuna: "Adzuna", careerjet: "Careerjet" };

/** One posting as a source returned it — what jobPostings/{source}_{externalId} stores (plan §6). */
export interface SourcedPosting {
  source: Source;
  externalId: string;
  title: string;
  company: string;
  location: string;
  country: PipelineCountry;
  /** The posting's URL as the source gave it — an aggregator redirect is fine; the job opens it. */
  url: string;
  /** The description as the source carries it — often a snippet, never the whole JD. */
  description: string;
  /** ISO date when the source says; "" when it doesn't. */
  postedAt: string;
}

/** jobPostings/{id} — the id does unique(source, externalId). */
export const postingDocId = (p: Pick<SourcedPosting, "source" | "externalId">): string => `${p.source}_${p.externalId.replace(/[^A-Za-z0-9_-]+/g, "-")}`;

/** A company's key in companies/{key}: its domain when known, else a slug of its name (plan §6 keys by domain; postings from an aggregator carry none). */
export function companyKey(name: string, website?: string | null): string {
  const d = domainOf(website);
  if (d) return d;
  return slug(name);
}

export const slug = (s: string): string => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "unknown";

/** The bare host of a website — "https://www.xero.com/nz/" → "xero.com"; null when it isn't one. */
export function domainOf(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`);
    return u.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch { return null; }
}
