import { describe, it, expect } from "vitest";
import { coachChecks, failedChecks, rankCompanies, readinessLine } from "@/lib/engine/coach/checks";
import { toolResultOf } from "@/lib/engine/coach/turn";
import type { ProfileFile } from "@/lib/careerops/profile-file";
import type { JhgCompany } from "@/lib/careerops/types";

// Code checks, the model converses (docs/COACH_ASSESSMENT_2026-11-16.md §1.3): the hand-over checks against
// the stored profile, in the prompt's words; totals and ranks in code; readiness in one sentence.

const ids = (checks: ReturnType<typeof coachChecks>) => failedChecks(checks).map((c) => c.id);

describe("Narrative checks", () => {
  const good: ProfileFile = {
    version: 1,
    contact: { portfolio: "https://ana.dev" },
    narrative: { headline: "I help product teams ship on time through ruthless prioritisation", superpowers: ["a", "b", "c"] },
    personalization: { exitNarrative: "From ops to product." },
    jhg: { identity: { fullName: "Ana", email: "ana@x.io", city: "Wellington", country: "NZ", timezone: "Pacific/Auckland", preferredChannel: "email" }, narrative: { leadSkills: ["x", "y", "z"], bridgeStoryOneLine: "Ops to product." } },
  };
  it("passes a complete Narrative and names each failure in the check's words", () => {
    expect(ids(coachChecks("narrative", good))).toEqual([]);
    const bad = coachChecks("narrative", { ...good, narrative: { headline: "Two sentences. Here.", superpowers: ["a"] }, contact: { portfolio: "ana.dev" }, jhg: { ...good.jhg, identity: { ...good.jhg!.identity, timezone: "NZST" } } });
    expect(ids(bad)).toEqual(["N1", "N2", "N3", "N5"]);
    expect(bad.find((c) => c.id === "N2")!.fix).toBe("Drop the final full stop");
    expect(bad.find((c) => c.id === "N3")!.fix).toBe("1 superpower — need 3 to 5");
    expect(bad.find((c) => c.id === "N1")!.fix).toContain("Area/City");
  });
});

describe("True North checks", () => {
  const postings = Array.from({ length: 15 }, (_, i) => ({ title: "Product Manager", url: `https://jobs.example/${i}` }));
  const good: ProfileFile = {
    version: 1,
    goal: { role: "Senior Product Manager", seniority: "Senior", subsector: "Climate SaaS", salary: "NZD 150,000–180,000" },
    personalization: { targetRoles: [{ archetype: "Product Manager", axes: "a; Builder", buys: "b" }] },
    watchlist: { companies: [], positive: ["Product Manager"], negative: ["Head of Product", "Director"] },
    jhg: { trueNorth: {
      boundaries: { currency: "NZD", salaryLower: "150,000", salaryUpper: "180,000", salaryFloor: "140,000", excludeLevels: ["Director"] },
      postings, titles: { target: ["Product Manager"], exclude: ["Head of Product"] },
      clusters: [{ name: "Builder", titles: ["Product Manager"], level: "Senior", fit: "primary" }],
      industries: [{ name: "Climate", subSectors: [{ name: "Climate SaaS", growthSignal: "+30% 2025", source: "https://src.example/r", outlook: "sunrise", confirmed: "Y" }] }],
    } },
  };
  it("passes a complete True North", () => { expect(ids(coachChecks("trueNorth", good))).toEqual([]); });
  it("catches the derived keys, the floor, thin postings and an unsourced sub-sector", () => {
    const bad = coachChecks("trueNorth", {
      ...good,
      goal: { ...good.goal, role: "Product Manager", salary: "150k" },
      watchlist: { companies: [], positive: [], negative: [] },
      jhg: { trueNorth: { ...good.jhg!.trueNorth, postings: postings.slice(0, 12), boundaries: { ...good.jhg!.trueNorth!.boundaries, salaryFloor: "160,000" },
        industries: [{ name: "Climate", subSectors: [{ name: "Climate SaaS", outlook: "sunrise", confirmed: "" }] }] } },
    });
    expect(ids(bad)).toEqual(["T1", "T2", "T3", "T5", "T6"]);
    expect(bad.find((c) => c.id === "T3")!.fix).toContain("12 postings");
    expect(bad.find((c) => c.id === "T2")!.fix).toBe("Floor is above the lower end");
  });
});

describe("Target companies — ranks in code, checks in code", () => {
  const company = (name: string, g: number, i: number, a: number, p: number, extra: Partial<JhgCompany> = {}): JhgCompany => ({
    name, companyType: "scaleup", inspiredBy: "industry_growth", subSector: "Climate SaaS", outlook: "sunrise", growthSource: "https://src.example/g", careersUrl: `https://${name.toLowerCase()}.example/jobs`, careersUrlStatus: "opened_by_coach", scores: { growth: g, interest: i, access: a, proof: p }, ...extra,
  });
  it("totals and ranks by total, then interest, then proof; the unscored follow unranked", () => {
    const ranked = rankCompanies([company("A", 3, 3, 3, 3), company("B", 5, 5, 5, 5), company("C", 4, 4, 2, 2), company("D", 4, 2, 4, 2), { name: "E" }]);
    expect(ranked.map((c) => [c.name, c.rank, c.scores?.total])).toEqual([["B", 1, 20], ["C", 2, 12], ["A", 3, 12], ["D", 4, 12], ["E", undefined, undefined]]);
  });
  it("runs C1–C7 on the forty", () => {
    const forty = rankCompanies(Array.from({ length: 40 }, (_, i) => company(`Co${i}`, 5 - (i % 5), 5 - ((i >> 1) % 5), 3, 3)));
    const byRank = [...forty].sort((a, b) => a.rank! - b.rank!);
    const top10 = byRank.slice(0, 10).map((c) => ({ rank: c.rank, name: c.name, careersUrlStatus: "confirmed", careersUrl: c.careersUrl }));
    const now = Date.parse("2026-11-16T00:00:00Z");
    const good: ProfileFile = {
      version: 1,
      watchlist: { companies: top10.map((t) => ({ name: t.name, careersUrl: t.careersUrl! })), positive: [], negative: [] },
      companyLists: { all: { sunrise: forty.map((c) => ({ name: c.name })) }, top10: { sunrise: top10.map((t) => ({ name: t.name })) }, top3: { sunrise: top10.slice(0, 3).map((t) => ({ name: t.name })) } },
      jhg: { trueNorth: { boundaries: { neverApply: ["Evil Corp"] }, industries: [{ name: "Climate", subSectors: [{ name: "Climate SaaS", outlook: "sunrise" }] }] },
        targetCompanies: { companies: forty, top10, top3: top10.slice(0, 3).map((t) => ({ name: t.name, whyNow: "x", firstMove: "y", byDate: "2026-11-20" })) } },
    };
    expect(ids(coachChecks("targetCompanies", good, now))).toEqual([]);
    const bad = coachChecks("targetCompanies", {
      ...good,
      jhg: { ...good.jhg, targetCompanies: { ...good.jhg!.targetCompanies, companies: [...forty.slice(0, 39), { ...forty[39], name: "Evil Corp", outlook: "sunset", growthSource: "evil.example" }], top3: [{ name: "Nobody", byDate: "2027-01-01" }] } },
    }, now);
    expect(ids(bad)).toEqual(["C2", "C3", "C5", "C7"]);
    expect(bad.find((c) => c.id === "C7")!.fix).toBe("On the never-apply list: Evil Corp");
    expect(ids(coachChecks("targetCompanies", { ...good, watchlist: { companies: [], positive: [], negative: [] } }, now))).toEqual(["C6"]);
    expect(ids(coachChecks("targetCompanies", { ...good, jhg: { ...good.jhg, targetCompanies: { ...good.jhg!.targetCompanies, companies: forty.slice(0, 30) } } }, now))).toContain("C1");
  });
});

describe("Story Bank, Master CV and LinkedIn checks", () => {
  const facts = Array.from({ length: 8 }, (_, i) => ({ id: `S${i + 1}`, title: `Story ${i + 1}`, sourceStatus: i === 7 ? "user_cannot_confirm" : "verified" }));
  const stories = facts.slice(0, 7).map((f) => ({ id: f.id, title: f.title }));
  const cv = ["# CV -- Ana", "**Headline:** Senior Product Manager | SaaS | Climate", "**Email:** ana@x.io", "**LinkedIn:** https://linkedin.com/in/ana", "## Professional Summary", "x", "## Work Experience", "### Acme -- Wellington", "**PM**", "## Education", "y", "## Skills", "z"].join("\n");
  const base: ProfileFile = {
    version: 1, cv,
    contact: { title: "Senior Product Manager", linkedin: "https://linkedin.com/in/ana" },
    stories, narrative: { proofPoints: stories.map((s) => ({ name: s.title, heroMetric: "+30%" })) },
    personalization: { adaptiveFraming: [{ role: "Builder", emphasize: "e", proof: "cv.md — Story 1" }], crossCuttingAdvantage: "c" },
    linkedin: { headline: "PM", about: "a", experience: [{ title: "PM", company: "Acme", skills: ["Roadmaps"] }], skills: ["Roadmaps"], featured: [{ kind: "link", title: "t", url: "https://ana.dev" }] },
    jhg: { identity: { email: "ana@x.io" }, trueNorth: { clusters: [{ name: "Builder" }] }, artefacts: { storyFacts: facts, lockedSections: ["## Education"] } },
  };
  it("pass when the artefacts agree", () => {
    expect(ids(coachChecks("storyBank", base))).toEqual([]);
    expect(ids(coachChecks("masterCv", base))).toEqual([]);
    expect(ids(coachChecks("linkedin", base))).toEqual([]);
  });
  it("catch an unconfirmed story used as a claim, wherever it is", () => {
    const leak = { ...base, stories: [...stories, { id: "S8", title: "Story 8" }], cv: cv + "\nStory 8 shipped", linkedin: { ...base.linkedin, about: "Story 8" } };
    expect(ids(coachChecks("storyBank", leak))).toEqual(["S2"]);
    expect(ids(coachChecks("masterCv", leak))).toEqual(["M4"]);
    expect(ids(coachChecks("linkedin", leak))).toEqual(["L4"]);
  });
  it("catch the CV's order and contact lines, and LinkedIn's limits and role count", () => {
    expect(ids(coachChecks("masterCv", { ...base, cv: cv.replace("## Education\ny\n", "") + "\n## Education\ny", contact: { title: "PM" } }))).toEqual(["M2", "M3"]);
    expect(ids(coachChecks("linkedin", { ...base, linkedin: { ...base.linkedin, headline: "x".repeat(221), experience: [] } }))).toEqual(["L1", "L2"]);
  });
});

describe("readiness and the tool result", () => {
  it("says what CareerOps still needs", () => {
    expect(readinessLine({ version: 1 }).line).toBe("CareerOps can run once your Master CV, your True North goal and a Top-10 careers page are in.");
    expect(readinessLine({ version: 1, cv: "# CV", goal: { role: "PM" } }).line).toBe("CareerOps can run once a Top-10 careers page is in.");
    expect(readinessLine({ version: 1, cv: "# CV", goal: { role: "PM" }, watchlist: { companies: [{ name: "A", careersUrl: "https://a.example/jobs" }], positive: [], negative: [] } })).toEqual({ ready: true, line: "CareerOps can run from here." });
  });
  it("carries the failed checks, the stored progress and the readiness line", () => {
    const r = toolResultOf(["Headline"], "narrative:\n  headline: x", [], { failedChecks: [{ id: "N3", label: "3–5 superpowers", fix: "1 superpower — need 3 to 5" }], progress: "in_progress" });
    expect(r.progress).toBe("in_progress");
    expect((r.checks as { failed: unknown[]; note: string }).failed).toEqual([{ id: "N3", check: "3–5 superpowers", fix: "1 superpower — need 3 to 5" }]);
    expect((r.checks as { note: string }).note).toContain("Not marked complete");
    const ok = toolResultOf(["Headline"], "x", [], { failedChecks: [], progress: "complete", readiness: "CareerOps can run from here." });
    expect(ok.checks).toBe("all passed");
    expect(ok.readiness).toBe("CareerOps can run from here.");
    expect(toolResultOf(["Headline"], "x")).toEqual({ ok: true, updated: ["Headline"], profile: "x" });
  });
});
