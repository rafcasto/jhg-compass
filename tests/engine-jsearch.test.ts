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
    expect(SOURCES).toEqual(["careerjet", "jsearch", "serp", "adzuna"]);
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
    expect(configuredAdapters({ ADZUNA_APP_ID: "i", ADZUNA_APP_KEY: "k", JSEARCH_API_KEY: "j", SERPAPI_KEY: "s" }).map((a) => a.source)).toEqual(["jsearch", "serp", "adzuna"]);
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

// A refused key is out for the run like a spent quota — the next Google route takes over, and the words say where to fix it.
import { authWords, isAuthError, isSourceOut } from "@/lib/engine/sourcing/adapters";

describe("a refused key", () => {
  it("is recognised and explained — subscribe on RapidAPI, the key alone does nothing", () => {
    expect(isAuthError('HTTP 403 — {"message":"You are not subscribed to this API."}')).toBe(true);
    expect(isAuthError("HTTP 401 — Invalid API key")).toBe(true);
    expect(isAuthError("HTTP 500")).toBe(false);
    expect(isSourceOut("HTTP 429 — Too many requests")).toBe(true);
    expect(isSourceOut("HTTP 403 — forbidden")).toBe(true);
    expect(isSourceOut("HTTP 502")).toBe(false);
    expect(authWords("jsearch")).toContain("free Basic plan");
    expect(authWords("jsearch")).toContain("JSEARCH_PROVIDER=openwebninja");
  });
});

// Two doors to the same API: RapidAPI's gateway, or OpenWeb Ninja's own platform — the key goes to the right host with the right header.
import { OPENWEBNINJA_BASE, jsearchProvider } from "@/lib/engine/sourcing/jsearch";

describe("JSearch providers", () => {
  it("sends an OpenWeb Ninja key to api.openwebninja.com in x-api-key, a RapidAPI key to the gateway", () => {
    const own = { JSEARCH_API_KEY: "own1", JSEARCH_PROVIDER: "openwebninja" };
    expect(jsearchProvider(own)).toBe("openwebninja");
    expect(jsearchProvider({ JSEARCH_API_KEY: "r" })).toBe("rapidapi");
    const u = new URL(jsearchUrl({ country: "nz", q: "Product Manager", location: "Auckland" }, own));
    expect(u.origin + u.pathname).toBe(OPENWEBNINJA_BASE);
    expect(u.searchParams.get("query")).toBe("Product Manager in Auckland");
    expect(jsearchHeaders(own)).toEqual({ "x-api-key": "own1" });
    expect(jsearchHeaders({ JSEARCH_API_KEY: "r" })).toEqual({ "x-rapidapi-key": "r", "x-rapidapi-host": JSEARCH_HOST });
  });
});

// Listings move: the Search endpoint can be set from the environment, and the RapidAPI host header follows it.
import { jsearchBase } from "@/lib/engine/sourcing/jsearch";

describe("JSearch endpoint override", () => {
  it("uses JSEARCH_BASE_URL when set and derives the host header from it; ignores junk", () => {
    const env = { JSEARCH_API_KEY: "r", JSEARCH_BASE_URL: "https://jsearch6.p.rapidapi.com/v2/search?x=1" };
    expect(jsearchBase(env)).toBe("https://jsearch6.p.rapidapi.com/v2/search");
    expect(new URL(jsearchUrl({ country: "nz", q: "PM", location: "Auckland" }, env)).pathname).toBe("/v2/search");
    expect(jsearchHeaders(env)["x-rapidapi-host"]).toBe("jsearch6.p.rapidapi.com");
    expect(jsearchBase({ JSEARCH_API_KEY: "r", JSEARCH_BASE_URL: "not a url" })).toBe("https://jsearch.p.rapidapi.com/search");
    expect(jsearchBase({ JSEARCH_API_KEY: "r" })).toBe("https://jsearch.p.rapidapi.com/search");
  });
});
