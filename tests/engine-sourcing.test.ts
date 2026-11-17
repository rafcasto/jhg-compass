import { describe, it, expect } from "vitest";
import { COUNTRY_LABELS, PIPELINE_COUNTRIES, cityOf, companyKey, countryOf, domainOf, postingDocId, slug, type SourcedPosting } from "@/lib/engine/sourcing/keys";
import { ADZUNA_PAGE_SIZE, adzunaConfigured, adzunaUrl, parseAdzuna } from "@/lib/engine/sourcing/adzuna";
import { CAREERJET_LOCALES, careerjetConfigured, careerjetUrl, parseCareerjet } from "@/lib/engine/sourcing/careerjet";
import { MAX_QUERIES, mergePostings, newestFirst, queriesFor, sourcingNote, toRawPosting } from "@/lib/engine/sourcing/plan";
import { atsBoardApi, atsJobCount, atsOf } from "@/lib/engine/sourcing/ats";
import { PhrasesSchema, phrasesTask, withPhrases } from "@/lib/engine/research/postings";

// Sourcing by API (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §2 row 2, §4 PRs 1–2; docs/AGENTIC_PIPELINE_PLAN.md §4 step 2, §5):
// the country enum on the pipeline, the adapters' requests and parses, the planner in code, the merge, the ATS registry,
// and the one model call that is left — quoting the descriptions.

const posting = (over: Partial<SourcedPosting> = {}): SourcedPosting => ({ source: "adzuna", externalId: "1", title: "Product Manager", company: "Xero", location: "Auckland", country: "nz", url: "https://www.adzuna.co.nz/land/ad/1", description: "Own the roadmap. Lead discovery with customers.", postedAt: "2026-11-10", ...over });

describe("the pipeline country", () => {
  it("is an enum of the four countries the sources cover, read from the member's region words", () => {
    expect(PIPELINE_COUNTRIES).toEqual(["nz", "au", "us", "ca"]);
    expect(countryOf("Auckland, New Zealand")).toBe("nz");
    expect(countryOf("Wellington")).toBe("nz");
    expect(countryOf("Sydney, AU")).toBe("au");
    expect(countryOf("Toronto")).toBe("ca");
    expect(countryOf("New York, USA")).toBe("us");
    expect(countryOf("Remote (NZ)")).toBe("nz");
    expect(countryOf("Berlin, Germany")).toBeNull();
    expect(countryOf("")).toBeNull();
    expect(countryOf(undefined)).toBeNull();
    expect(COUNTRY_LABELS.nz).toBe("New Zealand");
  });
  it("searches from the city half of a region", () => {
    expect(cityOf("Auckland, New Zealand")).toBe("Auckland");
    expect(cityOf("Sydney")).toBe("Sydney");
  });
});

describe("the shared ids", () => {
  it("keys a posting by source and external id, a company by domain else a slug of its name", () => {
    expect(postingDocId({ source: "adzuna", externalId: "5120987" })).toBe("adzuna_5120987");
    expect(postingDocId({ source: "careerjet", externalId: "jobad/nz1a2b/3c" })).toBe("careerjet_jobad-nz1a2b-3c");
    expect(companyKey("Xero", "https://www.xero.com/nz/")).toBe("xero.com");
    expect(companyKey("Xero")).toBe("xero");
    expect(companyKey("Fisher & Paykel Healthcare")).toBe("fisher-and-paykel-healthcare");
    expect(slug("  Ménage à Trois Ltd. ")).toBe("menage-a-trois-ltd");
    expect(domainOf("xero.com")).toBe("xero.com");
    expect(domainOf("not a url at all !")).toBeNull();
    expect(domainOf("")).toBeNull();
  });
});

describe("Adzuna", () => {
  const env = { ADZUNA_APP_ID: "id1", ADZUNA_APP_KEY: "key1" };
  it("is configured by its two keys and asks the country's endpoint for recent postings", () => {
    expect(adzunaConfigured({})).toBe(false);
    expect(adzunaConfigured(env)).toBe(true);
    const u = new URL(adzunaUrl({ country: "nz", what: "Product Manager", where: "Auckland" }, env));
    expect(u.origin + u.pathname).toBe("https://api.adzuna.com/v1/api/jobs/nz/search/1");
    expect(u.searchParams.get("app_id")).toBe("id1");
    expect(u.searchParams.get("what")).toBe("Product Manager");
    expect(u.searchParams.get("where")).toBe("Auckland");
    expect(u.searchParams.get("results_per_page")).toBe(String(ADZUNA_PAGE_SIZE));
    expect(u.searchParams.get("max_days_old")).toBe("30");
  });
  it("parses a page into postings and skips rows without an id, a title, a company or a URL", () => {
    const json = { results: [
      { id: 5120987, title: "Senior Product Manager", description: "Own the roadmap…", redirect_url: "https://www.adzuna.co.nz/land/ad/5120987", created: "2026-11-10T02:00:00Z", company: { display_name: "Xero" }, location: { display_name: "Auckland, Auckland Region" } },
      { id: 1, title: "No company", redirect_url: "https://x.y/1" },
      { id: 2, title: "No url", company: { display_name: "A" } },
    ] };
    const rows = parseAdzuna(json, "nz");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "adzuna", externalId: "5120987", title: "Senior Product Manager", company: "Xero", location: "Auckland, Auckland Region", country: "nz", postedAt: "2026-11-10" });
    expect(parseAdzuna(null, "nz")).toEqual([]);
    expect(parseAdzuna({ results: "nope" }, "nz")).toEqual([]);
  });
});

describe("Careerjet", () => {
  const env = { CAREERJET_AFFID: "aff1", APP_URL: "https://compass.example" };
  it("is configured by its affiliate id and asks the country's locale", () => {
    expect(careerjetConfigured({})).toBe(false);
    expect(CAREERJET_LOCALES).toEqual({ nz: "en_NZ", au: "en_AU", us: "en_US", ca: "en_CA" });
    const u = new URL(careerjetUrl({ country: "au", keywords: "Product Manager", location: "Sydney" }, env));
    expect(u.origin + u.pathname).toBe("https://public.api.careerjet.net/search");
    expect(u.searchParams.get("locale_code")).toBe("en_AU");
    expect(u.searchParams.get("affid")).toBe("aff1");
    expect(u.searchParams.get("url")).toBe("https://compass.example");
  });
  it("parses jobs, taking the URL's path as the id since the API has none", () => {
    const rows = parseCareerjet({ type: "JOBS", jobs: [{ title: "Product Manager", company: "Canva", locations: "Sydney, NSW", url: "https://jobview.careerjet.com.au/pm-canva-123.html", description: "Lead the team", date: "2026-11-11 10:00:00" }, { title: "x", company: "", url: "https://a/b" }] }, "au");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "careerjet", externalId: "pm-canva-123", company: "Canva", postedAt: "2026-11-11" });
    expect(parseCareerjet({ type: "ERROR" }, "au")).toEqual([]);
  });
});

describe("the planner in code", () => {
  it("queries titles first, then competencies, from the city, without duplicates, at most MAX_QUERIES", () => {
    const q = queriesFor({ titles: ["Product Manager", "product manager", "Head of Product"], competencies: ["Product discovery", "Stakeholder alignment"], region: "Auckland, New Zealand", country: "nz" });
    expect(q.map((x) => x.what)).toEqual(["Product Manager", "Head of Product", "Product discovery", "Stakeholder alignment"]);
    expect(q[0]).toEqual({ what: "Product Manager", where: "Auckland", from: "title" });
    expect(q[2].from).toBe("competency");
    const many = queriesFor({ titles: Array.from({ length: 12 }, (_, i) => `T${i}`), competencies: ["C"], region: "Sydney", country: "au" });
    expect(many).toHaveLength(MAX_QUERIES);
  });
  it("merges sources on company · title · location, first source winning, newest first", () => {
    const a = posting(); const b = posting({ source: "careerjet", externalId: "x", url: "https://c.j/x", postedAt: "2026-11-12" });
    const c = posting({ externalId: "9", title: "Head of Product", postedAt: "2026-11-14" });
    const merged = mergePostings([[a], [b, c]]);
    expect(merged.map((p) => p.externalId)).toEqual(["1", "9"]);
    expect(newestFirst(merged).map((p) => p.externalId)).toEqual(["9", "1"]);
    expect(toRawPosting(a)).toEqual({ title: "Product Manager", company: "Xero", location: "Auckland", url: a.url, phrases: [] });
  });
  it("tells the coach which sources answered", () => {
    expect(sourcingNote([{ source: "Adzuna", country: "nz", queries: 3, rows: 41 }, { source: "Careerjet", country: "nz", queries: 3, rows: 0, error: "HTTP 403" }], 38)).toBe("Sourced by API — Adzuna (nz) · 3 queries · 41 rows; Careerjet (nz) failed: HTTP 403; 38 unique.");
  });
});

describe("the ATS registry", () => {
  it("names the board behind a careers URL and the public endpoint that lists its jobs", () => {
    expect(atsOf("https://boards.greenhouse.io/xero")).toEqual({ provider: "greenhouse", boardId: "xero" });
    expect(atsOf("https://job-boards.greenhouse.io/canva/jobs/123")).toEqual({ provider: "greenhouse", boardId: "canva" });
    expect(atsOf("https://jobs.lever.co/halter")).toEqual({ provider: "lever", boardId: "halter" });
    expect(atsOf("https://jobs.ashbyhq.com/tracksuit")).toEqual({ provider: "ashby", boardId: "tracksuit" });
    expect(atsOf("https://apply.workable.com/sharesies/")).toEqual({ provider: "workable", boardId: "sharesies" });
    expect(atsOf("https://careers.smartrecruiters.com/FisherPaykel")).toEqual({ provider: "smartrecruiters", boardId: "FisherPaykel" });
    expect(atsOf("https://halter.teamtailor.com/jobs")).toEqual({ provider: "teamtailor", boardId: "halter" });
    expect(atsOf("https://www.xero.com/careers/")).toBeNull();
    expect(atsOf("https://boards.greenhouse.io/")).toBeNull();
    expect(atsOf("nope")).toBeNull();
    expect(atsBoardApi({ provider: "greenhouse", boardId: "xero" })).toBe("https://boards-api.greenhouse.io/v1/boards/xero/jobs");
    expect(atsBoardApi({ provider: "lever", boardId: "halter" })).toBe("https://api.lever.co/v0/postings/halter?mode=json");
    expect(atsBoardApi({ provider: "teamtailor", boardId: "halter" })).toBe("https://halter.teamtailor.com/jobs.json");
  });
  it("counts a board's jobs per provider shape", () => {
    expect(atsJobCount("greenhouse", { jobs: [{}, {}] })).toBe(2);
    expect(atsJobCount("lever", [{}, {}, {}])).toBe(3);
    expect(atsJobCount("smartrecruiters", { content: [] })).toBe(0);
    expect(atsJobCount("ashby", { nope: 1 })).toBeNull();
  });
});

describe("quoting the descriptions", () => {
  it("numbers the snippets and keeps only phrases the snippet really contains, at most three", () => {
    const rows = [{ title: "PM", company: "Xero", location: "Auckland", url: "https://a/1", phrases: [] }, { title: "HoP", company: "Halter", location: "Auckland", url: "https://a/2", phrases: [] }];
    const descriptions = ["Own the roadmap. Lead discovery with customers and ship outcomes.", "Build the product org."];
    expect(phrasesTask([{ title: "PM", company: "Xero", description: descriptions[0] }])).toBe(`#1 · PM · Xero\n${descriptions[0]}`);
    const answer = PhrasesSchema.parse({ rows: [{ n: 1, phrases: ["Own the roadmap", "lead discovery with customers", "invented phrase", "ship outcomes"] }, { n: 2, phrases: [] }] });
    const out = withPhrases(rows, descriptions, answer);
    expect(out[0].phrases).toEqual(["Own the roadmap", "lead discovery with customers", "ship outcomes"]);
    expect(out[1].phrases).toEqual([]);
  });
});
