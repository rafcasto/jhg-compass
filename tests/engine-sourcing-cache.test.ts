import { describe, it, expect } from "vitest";
import { CACHE_TTL_MS, DEFAULT_METERED_MAX, cacheFresh, cacheKey, meteredMaxFrom } from "@/lib/engine/sourcing/cache";
import { COMPANIES_ENOUGH_ROWS } from "@/lib/engine/research/companies";

// Free first (decision 2026-11-17): a metered source fills a gap, within a small cap, and never answers the same question twice a day.

describe("the sourcing cache", () => {
  it("keys a query by source, country, words and place — case and spacing aside — and is fresh for a day", () => {
    expect(cacheKey("jsearch", "nz", "Product  Manager", "Auckland")).toBe(cacheKey("jsearch", "nz", "product manager", "auckland"));
    expect(cacheKey("jsearch", "nz", "Product Manager", "Auckland")).not.toBe(cacheKey("serp", "nz", "Product Manager", "Auckland"));
    expect(cacheKey("adzuna", "au", "Head of Product", "")).toMatch(/_any$/);
    expect(cacheKey("adzuna", "nz", "a/b & c", "x")).not.toContain("/");
    expect(cacheFresh(Date.now() - 1000)).toBe(true);
    expect(cacheFresh(Date.now() - CACHE_TTL_MS - 1)).toBe(false);
    expect(cacheFresh(undefined)).toBe(false);
  });
  it("caps metered requests a run from the environment, default six, zero switches them off", () => {
    expect(DEFAULT_METERED_MAX).toBe(6);
    expect(meteredMaxFrom({})).toBe(6);
    expect(meteredMaxFrom({ SOURCING_METERED_MAX: "3" })).toBe(3);
    expect(meteredMaxFrom({ SOURCING_METERED_MAX: "0" })).toBe(0);
    expect(meteredMaxFrom({ SOURCING_METERED_MAX: "nope" })).toBe(6);
    expect(meteredMaxFrom({ SOURCING_METERED_MAX: "500" })).toBe(6);
    expect(COMPANIES_ENOUGH_ROWS).toBe(80);
  });
});
