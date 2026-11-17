import { describe, it, expect } from "vitest";
import { ENGINE_JOB_AGENT, ENGINE_JOB_LABELS, ENGINE_JOB_TYPES } from "@/lib/engine/keys";
import { COMPANIES_PER_INDUSTRY, COMPANIES_TARGET, CompaniesSchema, companiesPayload, companiesPayloadEmpty, companiesSummary, companiesTask, fromPostings, mergeCandidates, outlookFor, toProfileCompanies, type Candidate, type VerifiedCandidate } from "@/lib/engine/research/companies";
import { COACH_RESEARCH, coachTools, runResearchTool } from "@/lib/engine/coach/tools";
import { COACH_PROMPTS } from "@/lib/engine/coach/prompts";
import { countryOf, type SourcedPosting } from "@/lib/engine/sourcing/keys";
import type { ProfileFile } from "@/lib/careerops/profile-file";

// Target companies Part A as a job (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §2 row 5, §4 PR 3): the brief from True
// North, the two passes, the merge that keeps the never-join list out and caps at forty, the rows the profile stores, the
// table the coach reads — and Coach 3 now starting it instead of searching.

const profile: ProfileFile = {
  version: 1, goal: { city: "Auckland, New Zealand", companyType: "scaleup" },
  jhg: { trueNorth: {
    boundaries: { neverApply: ["Acme Corp"], exclude: "Australia" },
    titles: { target: ["Product Manager", "Head of Product"] },
    clusters: [{ name: "Discovery to delivery", titles: ["Senior Product Manager", "Product Lead"], fit: "primary" }, { name: "Platform", titles: ["Platform PM"], fit: "secondary" }],
    industries: [{ name: "Agritech", subSectors: [{ name: "Farm software", outlook: "sunrise" }, { name: "Dairy processing", outlook: "sunset" }] }, { name: "Fintech", subSectors: [{ name: "Payments", outlook: "" }] }],
  } },
};

const posting = (over: Partial<SourcedPosting>): SourcedPosting => ({ source: "adzuna", externalId: "1", title: "Product Manager", company: "Halter", location: "Auckland", country: "nz", url: "https://www.adzuna.co.nz/land/ad/1", description: "", postedAt: "2026-11-10", ...over });
const cand = (over: Partial<Candidate>): Candidate => ({ name: "X", inspiredBy: "industry_growth", industry: "Agritech", subSector: "Farm software", location: "Auckland", website: "", growthSignal: "Raised NZD 20m (2026-09)", growthSource: "https://news.example/x", careersUrl: "", ...over });

describe("the companies job", () => {
  it("is a job type on the researcher agent that Coach 3 may start", () => {
    expect(ENGINE_JOB_TYPES).toContain("companies");
    expect(ENGINE_JOB_AGENT.companies).toBe("researcher");
    expect(ENGINE_JOB_LABELS.companies).toBe("Sourcing companies");
    expect(COACH_RESEARCH.targetCompanies).toEqual(["companies"]);
    expect(coachTools("targetCompanies").map((t) => t.name)).toEqual(["update_profile", "run_research", "score_matrix"]);
    const t = runResearchTool("targetCompanies")!;
    expect((t.input_schema.properties.kind as { enum: string[] }).enum).toEqual(["companies"]);
    expect((t.input_schema.properties.kind as { description: string }).description).toContain("Target companies Part A");
    expect(t.input_schema.properties.names).toBeTruthy();
    expect((runResearchTool("trueNorth")!.input_schema.properties.kind as { enum: string[] }).enum).toEqual(["postings"]);
  });

  it("is what Coach 3's prompt asks for in Part A — once, then the member decides", () => {
    const p = COACH_PROMPTS.targetCompanies;
    expect(p.version).toBe(7);
    expect(p.text).toContain('Call run_research with kind "companies" — once, at the start of Part A.');
    expect(p.text).toContain("Until then do not search for companies yourself.");
    expect(p.text).toContain("goes through run_research once more with names[]");
    expect(p.text).not.toContain("You have web search for the research.");
  });

  it("sources from True North — the primary cluster's titles first, the industries with their outlooks, the boundaries that are code", () => {
    const p = companiesPayload(profile, {}, countryOf);
    expect(p.titles).toEqual(["Senior Product Manager", "Product Lead", "Product Manager", "Head of Product"]);
    expect(p.industries).toEqual([{ name: "Agritech", subSectors: [{ name: "Farm software", outlook: "sunrise" }, { name: "Dairy processing", outlook: "sunset" }] }, { name: "Fintech", subSectors: [{ name: "Payments", outlook: "" }] }]);
    expect(p.country).toBe("nz");
    expect(p.companyType).toBe("scaleup");
    expect(p.neverApply).toEqual(["Acme Corp"]);
    expect(p.exclude).toBe("Australia");
    expect(p.stored).toEqual([]);
    expect(companiesPayloadEmpty(p)).toBe(false);
    expect(companiesPayloadEmpty(companiesPayload({ version: 1 }))).toBe(true);
    const h = companiesPayload(profile, { titles: ["Chief Product Officer"], names: ["Xero", "Halter"], portal: "compass" }, countryOf);
    expect(h.titles[0]).toBe("Chief Product Officer");
    expect(h.names).toEqual(["Xero", "Halter"]);
    expect(h.portal).toBe("compass");
    expect(companiesPayloadEmpty(companiesPayload({ version: 1 }, { names: ["Xero"] }))).toBe(false);
  });

  it("frames the proposal with the industries, the never-include list and what is already on the page", () => {
    const p = companiesPayload({ ...profile, jhg: { ...profile.jhg, targetCompanies: { companies: [{ name: "Xero", rank: 1 }] } } }, { names: ["Halter"] }, countryOf);
    const task = companiesTask(p, "2026-11-17");
    expect(task).toContain("- Agritech — sub-sectors: Farm software · Dairy processing");
    expect(task).toContain("Geography: Auckland, New Zealand; excluded: Australia.");
    expect(task).toContain("Never include: Acme Corp.");
    expect(task).toContain("Already on their page (do not propose again): Xero.");
    expect(task).toContain("source each one too: Halter.");
    expect(task).toContain(`Return up to ${COMPANIES_PER_INDUSTRY} companies per industry`);
  });

  it("groups the job boards' postings by employer — the signal is the open roles, the source the newest posting", () => {
    const rows = [posting({}), posting({ externalId: "2", title: "Head of Product", postedAt: "2026-11-12", url: "https://www.adzuna.co.nz/land/ad/2" }), posting({ externalId: "3", company: "Xero", postedAt: "2026-11-01", url: "https://www.adzuna.co.nz/land/ad/3" })];
    const c = fromPostings(rows, ["Product Manager"]);
    expect(c.map((x) => x.name)).toEqual(["Halter", "Xero"]);
    expect(c[0]).toMatchObject({ inspiredBy: "job_posting", growthSource: "https://www.adzuna.co.nz/land/ad/2", location: "Auckland" });
    expect(c[0].growthSignal).toBe("2 open postings now — Product Manager, Head of Product (2026-11-12)");
    expect(c[1].growthSignal).toContain("1 open posting now");
  });

  it("merges stored first, one row per company, nobody on the never-join list, at most forty", () => {
    const stored = [{ name: "Xero", rank: 1 }];
    const passes = [[cand({ name: "Halter" }), cand({ name: "xero" })], [cand({ name: "Acme Corp Ltd" }), cand({ name: "Halter " }), cand({ name: "Tracksuit" })]];
    const { kept, excluded } = mergeCandidates(stored, passes, ["Acme Corp"]);
    expect(kept.map((c) => c.name)).toEqual(["Halter", "Tracksuit"]);
    expect(excluded).toEqual(["Acme Corp Ltd"]);
    const many = Array.from({ length: 50 }, (_, i) => cand({ name: `Co ${i}` }));
    expect(mergeCandidates(stored, [many], []).kept).toHaveLength(COMPANIES_TARGET - 1);
  });

  it("stores the rows after the stored ones, ranked, with the outlook copied from True North and the careers page only when opened", () => {
    const p = companiesPayload(profile, {}, countryOf);
    expect(outlookFor(p, "Agritech", "Farm software")).toBe("sunrise");
    expect(outlookFor(p, "agritech", "dairy processing")).toBe("sunset");
    expect(outlookFor(p, "Fintech", "Payments")).toBe("");
    expect(outlookFor(p, "Nope", "x")).toBe("");
    const v = (over: Partial<VerifiedCandidate>): VerifiedCandidate => ({ ...cand({}), sourceOpened: true, careersUrlStatus: "none", ...over });
    const rows = toProfileCompanies([{ name: "Xero", rank: 7, scores: { growth: 5, interest: 4, access: 3, proof: 2, total: 14 } }], [
      v({ name: "Halter", companyType: "scaleup", careersUrl: "https://jobs.lever.co/halter", careersUrlStatus: "opened_by_coach" }),
      v({ name: "Dead Link Co", sourceOpened: false }),
      v({ name: "Tracksuit", inspiredBy: "job_posting", industry: "", subSector: "", companyType: "weird" }),
    ], p);
    expect(rows.map((r) => [r.rank, r.name])).toEqual([[1, "Xero"], [2, "Halter"], [3, "Tracksuit"]]);
    expect(rows[0].scores?.total).toBe(14);
    expect(rows[1]).toMatchObject({ companyType: "scaleup", outlook: "sunrise", careersUrl: "https://jobs.lever.co/halter", careersUrlStatus: "opened_by_coach", knownContact: "" });
    expect(rows[2].careersUrl).toBeUndefined();
    expect(rows[2].careersUrlStatus).toBe("none");
    expect(rows[2].companyType).toBeUndefined();
    expect(rows[2].outlook).toBe("");
  });

  it("hands the coach the field as a table and the schema takes the proposal", () => {
    const s = companiesSummary([{ rank: 1, name: "Halter", companyType: "scaleup", inspiredBy: "industry_growth", industry: "Agritech", subSector: "Farm software", location: "Auckland", growthSignal: "Raised NZD 20m", growthSource: "https://n.example/h", careersUrl: "https://jobs.lever.co/halter", careersUrlStatus: "opened_by_coach" }], 1, ["Acme Corp Ltd"], "Fintech was thin.");
    expect(s).toContain("1 companies on jhg.targetCompanies.companies (1 added by the portal");
    expect(s).toContain("left out as never-join: Acme Corp Ltd");
    expect(s).toContain("Fintech was thin.");
    expect(s).toContain("| 1 | Halter | scaleup | industry_growth | Agritech | Farm software | Auckland | Raised NZD 20m | https://n.example/h | https://jobs.lever.co/halter |");
    const parsed = CompaniesSchema.safeParse({ companies: [{ name: "Halter", companyType: "scaleup", inspiredBy: "competitor", industry: "Agritech", subSector: "", location: "Auckland", website: "", growthSignal: "x", growthSource: "https://a/b", careersUrl: "" }], note: "" });
    expect(parsed.success).toBe(true);
    expect(CompaniesSchema.safeParse({ companies: [{ name: "H", companyType: "mega", inspiredBy: "competitor", industry: "", subSector: "", location: "", website: "", growthSignal: "", growthSource: "", careersUrl: "" }], note: "" }).success).toBe(false);
  });
});

// API first (2026-11-17): the boards' pass asks titles and industries, city and country-wide, reads the careers page off a
// posting link on an ATS board, and the model's proposal runs only to fill a gap — or never.
import { queriesFor } from "@/lib/engine/sourcing/plan";
import { atsBoardPage } from "@/lib/engine/sourcing/ats";

describe("the companies job, API first", () => {
  it("plans titles in the city, industries in the city, titles country-wide, then competencies — the industry on its query", () => {
    const q = queriesFor({ titles: ["Product Manager", "Head of Product"], competencies: ["Discovery"], industries: ["Agritech", "Fintech"], broaden: true, region: "Auckland, New Zealand", country: "nz" }, 12);
    expect(q.map((x) => [x.what, x.where, x.from])).toEqual([
      ["Product Manager", "Auckland", "title"], ["Head of Product", "Auckland", "title"],
      ["Agritech jobs", "Auckland", "industry"], ["Fintech jobs", "Auckland", "industry"],
      ["Product Manager", "", "title"], ["Head of Product", "", "title"],
      ["Discovery", "Auckland", "competency"],
    ]);
    expect(q[2].industry).toBe("Agritech");
    expect(q[0].industry).toBeUndefined();
    // Without broaden, no country-wide variants; the cap still holds.
    expect(queriesFor({ titles: ["PM"], competencies: [], industries: ["Agritech"], region: "Sydney", country: "au" }).map((x) => x.where)).toEqual(["Sydney", "Sydney"]);
  });
  it("carries the industry a query named onto the employers it found, and the board a posting link sits on as the careers page", () => {
    const rows: SourcedPosting[] = [
      posting({ externalId: "1", company: "Halter", url: "https://jobs.lever.co/halter/abc-123", foundBy: { what: "Agritech jobs", from: "industry", industry: "Agritech" } }),
      posting({ externalId: "2", company: "Halter", title: "Head of Product", url: "https://www.seek.co.nz/job/1", foundBy: { what: "Product Manager", from: "title" } }),
      posting({ externalId: "3", company: "Xero", url: "https://www.seek.co.nz/job/2", foundBy: { what: "Product Manager", from: "title" } }),
    ];
    const c = fromPostings(rows, ["Product Manager"]);
    expect(c[0]).toMatchObject({ name: "Halter", industry: "Agritech", inspiredBy: "industry_growth", careersUrl: "https://jobs.lever.co/halter" });
    expect(c[0].growthSignal).toContain("for Product Manager");
    expect(c[1]).toMatchObject({ name: "Xero", industry: "", inspiredBy: "job_posting", careersUrl: "" });
    expect(atsBoardPage({ provider: "greenhouse", boardId: "xero" })).toBe("https://boards.greenhouse.io/xero");
    expect(atsBoardPage({ provider: "teamtailor", boardId: "halter" })).toBe("https://halter.teamtailor.com/jobs");
  });
  it("switches the proposal off by hint or by environment", () => {
    expect(companiesPayload(profile, {}, countryOf).proposal).toBe("auto");
    expect(companiesPayload(profile, { proposal: "off" }, countryOf).proposal).toBe("off");
    const prev = process.env.COMPANIES_PROPOSAL;
    process.env.COMPANIES_PROPOSAL = "off";
    expect(companiesPayload(profile, {}, countryOf).proposal).toBe("off");
    expect(companiesPayload(profile, { proposal: "auto" }, countryOf).proposal).toBe("auto");
    if (prev === undefined) delete process.env.COMPANIES_PROPOSAL; else process.env.COMPANIES_PROPOSAL = prev;
  });
});
