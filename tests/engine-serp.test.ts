import { describe, it, expect } from "vitest";
import { SERP_MAX_QUERIES, parseSerpJobs, postedAtFrom, serpConfigured, serpJobsUrl, serpTopUpNeeded } from "@/lib/engine/sourcing/serp";
import { ADAPTERS, configuredAdapters } from "@/lib/engine/sourcing/adapters";
import { SOURCES, SOURCE_LABELS } from "@/lib/engine/sourcing/keys";

// The Google for Jobs top-up (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §5 decision 1): SerpApi google_jobs, metered, after
// the free sources and only to fill a gap — the way Seek postings come in for NZ and AU.

describe("SerpApi google_jobs", () => {
  const env = { SERPAPI_KEY: "k1" };
  it("is a source, configured by its key, asking google_jobs in the country with the city as location", () => {
    expect(SOURCES).toEqual(["careerjet", "jsearch", "serp", "adzuna"]);
    expect(SOURCE_LABELS.serp).toBe("Google for Jobs (SerpApi)");
    expect(serpConfigured({})).toBe(false);
    expect(serpConfigured(env)).toBe(true);
    const u = new URL(serpJobsUrl({ country: "nz", q: "Product Manager", location: "Auckland" }, env));
    expect(u.origin + u.pathname).toBe("https://serpapi.com/search.json");
    expect(u.searchParams.get("engine")).toBe("google_jobs");
    expect(u.searchParams.get("q")).toBe("Product Manager");
    expect(u.searchParams.get("location")).toBe("Auckland");
    expect(u.searchParams.get("gl")).toBe("nz");
    expect(u.searchParams.get("api_key")).toBe("k1");
  });

  it("reads relative dates against today", () => {
    expect(postedAtFrom("3 days ago", "2026-11-17")).toBe("2026-11-14");
    expect(postedAtFrom("2 hours ago", "2026-11-17")).toBe("2026-11-17");
    expect(postedAtFrom("1 week ago", "2026-11-17")).toBe("2026-11-10");
    expect(postedAtFrom("30+ days ago", "2026-11-17")).toBe("2026-10-18");
    expect(postedAtFrom("Just posted", "2026-11-17")).toBe("2026-11-17");
    expect(postedAtFrom("", "2026-11-17")).toBe("");
    expect(postedAtFrom("Full-time", "2026-11-17")).toBe("");
  });

  it("parses jobs_results — the board's apply link as the URL, the board's name kept in the description, Seek included", () => {
    const json = { jobs_results: [
      { job_id: "eyJqb2JfdGl0bGUiOiJQcm9kdWN0IE1hbmFnZXIi", title: "Product Manager", company_name: "Xero", location: "Auckland, Auckland", via: "via Seek", description: "Own the roadmap…", detected_extensions: { posted_at: "2 days ago" }, apply_options: [{ title: "Seek", link: "https://www.seek.co.nz/job/81234567" }, { title: "LinkedIn", link: "https://nz.linkedin.com/jobs/view/1" }], share_link: "https://www.google.com/search?q=x" },
      { job_id: "abc", title: "Head of Product", company_name: "Halter", location: "Auckland", via: "via LinkedIn", share_link: "https://www.google.com/search?ibp=htl;jobs#htivrt=jobs&htidocid=abc" },
      { title: "no company", job_id: "z", apply_options: [{ link: "https://a/b" }] },
    ] };
    const rows = parseSerpJobs(json, "nz", "2026-11-17");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ source: "serp", externalId: "eyJqb2JfdGl0bGUiOiJQcm9kdWN0IE1hbmFnZXIi", title: "Product Manager", company: "Xero", url: "https://www.seek.co.nz/job/81234567", country: "nz", postedAt: "2026-11-15" });
    expect(rows[0].description).toBe("[Seek] Own the roadmap…");
    expect(rows[1].url).toBe("https://www.google.com/search?ibp=htl;jobs#htivrt=jobs&htidocid=abc");
    expect(parseSerpJobs({ error: "Invalid API key" }, "nz", "2026-11-17")).toEqual([]);
  });

  it("runs only to fill a gap, within its cap", () => {
    expect(SERP_MAX_QUERIES).toBe(4);
    expect(serpTopUpNeeded(41, true, 30)).toBe(false);
    expect(serpTopUpNeeded(12, true, 30)).toBe(true);
    expect(serpTopUpNeeded(0, false, 30)).toBe(true);
  });
});

describe("the adapter registry", () => {
  it("runs the free sources first and the metered one last, each by its own key", () => {
    expect(configuredAdapters({}).map((a) => a.source)).toEqual([]);
    expect(configuredAdapters({ SERPAPI_KEY: "k" }).map((a) => a.source)).toEqual(["serp"]);
    expect(configuredAdapters({ SERPAPI_KEY: "k", ADZUNA_APP_ID: "i", ADZUNA_APP_KEY: "k", CAREERJET_AFFID: "a" }).map((a) => a.source)).toEqual(["careerjet", "serp", "adzuna"]);
    expect(ADAPTERS.serp.metered).toBe(true);
    expect(ADAPTERS.adzuna.metered).toBe(true); // 25 hits a month on its free plan (2026-11-18)
    expect(ADAPTERS.careerjet.metered).toBe(false);
    expect(ADAPTERS.serp.maxQueries).toBe(SERP_MAX_QUERIES);
    const u = new URL(ADAPTERS.adzuna.url({ what: "PM", where: "Auckland", from: "title" }, "nz", { ADZUNA_APP_ID: "i", ADZUNA_APP_KEY: "k" }));
    expect(u.pathname).toBe("/v1/api/jobs/nz/search/1");
    expect(ADAPTERS.serp.parse({ jobs_results: [] }, "nz", "2026-11-17")).toEqual([]);
  });
});
