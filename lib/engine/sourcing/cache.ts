// Free first (decision 2026-11-17, no paid plan for now): a metered source answers only to fill a gap the free sources left,
// spends at most SOURCING_METERED_MAX requests a run, and never answers the same question twice in a day — a query's rows are
// kept 24 h in the shared `sourcingCache` (plan §4 principle 5: researched once for every member; the same "Product Manager in
// Auckland" is asked by everyone in Auckland). Pure: the key, the freshness rule, the cap. The reads and writes are in fetch.ts.

import type { PipelineCountry, Source } from "./keys";

export const CACHE_TTL_MS = 24 * 60 * 60_000;
/** Metered requests a run may spend when the free sources came up short — the free Google plans are 100–200 a month. */
export const DEFAULT_METERED_MAX = 6;

/** One document per source × country × query × place — case- and space-insensitive. */
export function cacheKey(source: Source, country: PipelineCountry, what: string, where: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return `${source}_${country}_${encodeURIComponent(norm(what)).replace(/%/g, "-")}_${encodeURIComponent(norm(where)).replace(/%/g, "-") || "any"}`.slice(0, 200);
}

export const cacheFresh = (fetchedAt: number | undefined, now = Date.now(), ttl = CACHE_TTL_MS): boolean => typeof fetchedAt === "number" && now - fetchedAt < ttl;

/** The metered cap, from SOURCING_METERED_MAX when it is a whole number 0–50, else the default. 0 switches metered sources off. */
export function meteredMaxFrom(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.SOURCING_METERED_MAX);
  return Number.isInteger(n) && n >= 0 && n <= 50 ? n : DEFAULT_METERED_MAX;
}
