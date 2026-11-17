import { describe, it, expect } from "vitest";
import { JSEARCH_HOST, jsearchConfigured, jsearchHeaders, jsearchUrl, parseJsearch } from "@/lib/engine/sourcing/jsearch";
import { configuredAdapters } from "@/lib/engine/sourcing/adapters";
import { SOURCES, SOURCE_LABELS } from "@/lib/engine/sourcing/keys";
import { fromPostings } from "@/lib/engine/research/companies";

// JSearch — the cheaper Google for Jobs route (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §5 decision 1): a RapidAPI key in
// the headers, the place in the query, the apply link as the URL, the employer's site when known; one metered source a run.

describe("JSearch", () => {
  const env = { JSEARCH_API_KEY: "rk1" };
  it("is a source, configured by its RapidAPI key, asking with the place in the query and the key in the headers", () => {
    expect(SOURCES).toEqual(["adzuna", "careerjet", "jsearch", "serp"]);
    expect(SOURCE_LABELS.jsearch).toBe("Google for Jobs (JSearch)");
    expect(jsearchConfigured({})).toBe(false);
    expect(jsearchConfigured(env)).toBe(true);
    const u = new URL(jsearchUrl({ country: "nz", q: "Product Manager", location: "Auckland" }));
    expect(u.origin + u.pathname).toBe("https://jsearch.p.rapidapi.com/search");
    expect(u.searchParams.get("query")).toBe("Product Manager in Auckland");
    expect(u.searchParams.get("country")).toBe("nz");
    expect(u.searchParams.get("date_posted")).toBe("month");
    expect(new URL(jsearchUrl({ country: "au", q: "Head of Product", location: "" })).searchParams.get("query")).toBe("Head of Product");
    expect(jsearchHeaders(env)).toEqual({ "x-rapidapi-key": "rk1", "x-rapidapi-host": JSEARCH_HOST });
  });
  it("parses data[] — the apply link as the URL, the publisher in the description, the employer's site kept, the date as ISO", () => {
    const json = { status: "OK", data: [
      { job_id: "abc==", job_title: "Senior Product Manager", employer_name: "Halter", employer_website: "https://halter.co.nz", job_publisher: "Seek", job_apply_link: "https://www.seek.co.nz/job/81234567", job_description: "Own the roadmap. Lead discovery.", job_city: "Auckland", job_state: "Auckland", job_country: "NZ", job_posted_at_datetime_utc: "2026-11-12T03:00:00.000Z" },
      { job_id: "def", job_title: "Head of Product", employer_name: "Xero", apply_options: [{ publisher: "LinkedIn", apply_link: "https://nz.linkedin.com/jobs/view/1" }], job_city: "Wellington", job_country: "NZ" },
      { job_id: "x", job_title: "no employer", job_apply_link: "https://a/b" },
    ] };
    const rows = parseJsearch(json, "nz");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ source: "jsearch", externalId: "abc==", company: "Halter", url: "https://www.seek.co.nz/job/81234567", location: "Auckland, Auckland, NZ", postedAt: "2026-11-12", companyWebsite: "https://halter.co.nz" });
    expect(rows[0].description).toBe("[Seek] Own the roadmap. Lead discovery.");
    expect(rows[1]).toMatchObject({ company: "Xero", url: "https://nz.linkedin.com/jobs/view/1", location: "Wellington, NZ", postedAt: "" });
    expect(rows[1].companyWebsite).toBeUndefined();
    expect(parseJsearch({ status: "ERROR", message: "Invalid API key" }, "nz")).toEqual([]);
    // The employer's site rides onto the companies pass.
    expect(fromPostings(rows, ["Product Manager"])[0].website).toBe("https://halter.co.nz");
  });
  it("runs one metered source at most — JSearch when both Google routes have a key", () => {
    expect(configuredAdapters({ JSEARCH_API_KEY: "k", SERPAPI_KEY: "s" }).map((a) => a.source)).toEqual(["jsearch", "serp"]);
    expect(configuredAdapters({ SERPAPI_KEY: "s" }).map((a) => a.source)).toEqual(["serp"]);
    expect(configuredAdapters({ ADZUNA_APP_ID: "i", ADZUNA_APP_KEY: "k", JSEARCH_API_KEY: "j", SERPAPI_KEY: "s" }).map((a) => a.source)).toEqual(["adzuna", "jsearch", "serp"]);
  });
});

// A 429 is the source saying "out" — quota or burst; the run names it and falls back to the next Google route.
import { isQuotaError, quotaWords } from "@/lib/engine/sourcing/adapters";

describe("quota errors", () => {
  it("recognises RapidAPI's and SerpApi's 429s and says what they mean", () => {
    expect(isQuotaError('HTTP 429 — {"message":"Too many requests"}')).toBe(true);
    expect(isQuotaError("HTTP 429")).toBe(true);
    expect(isQuotaError("Your account has run out of searches (quota)")).toBe(true);
    expect(isQuotaError("HTTP 403 — You are not subscribed to this API")).toBe(false);
    expect(isQuotaError("HTTP 500")).toBe(false);
    expect(quotaWords("jsearch")).toContain("RapidAPI → My Apps → JSearch → usage");
    expect(quotaWords("serp")).toContain("serpapi.com");
  });
  it("lists every metered source so the run can fall back, JSearch first", () => {
    expect(configuredAdapters({ JSEARCH_API_KEY: "k", SERPAPI_KEY: "s" }).map((a) => a.source)).toEqual(["jsearch", "serp"]);
  });
});
