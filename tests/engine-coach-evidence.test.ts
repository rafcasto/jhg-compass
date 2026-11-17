import { describe, it, expect } from "vitest";
import { CONNECTIONS_CHUNK, chunkConnections, companyMatches, companyTokens, isConnectionsCsv, isConnectionsFileName, matchConnections, parseConnections, splitCsvLine, type Connection } from "@/lib/engine/coach/connections";
import { accessSuggestion, archetypeTitlesOf, daysBetween, evidenceFor, growthSuggestion, interestContext, proofContext, signalDate, suggestedValues, titleMatches, trueNorthPostingsAt } from "@/lib/engine/coach/evidence";
import { RUBRICS, parseRows, rankRows } from "@/lib/engine/coach/rubrics";
import { overrideFlags, withOverrides } from "@/lib/engine/coach/companies";

// Coach 3's assisted matrix (docs/UX_COACH_COMPANY_SCORING.md): the connections export parsed and matched by code, Growth and
// Access suggested against the rubric's anchors from stored facts, Interest and Proof given context, overrides recorded.

const CSV = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Jane,Doe,https://www.linkedin.com/in/janedoe,jane@example.com,Halter,Head of Product,12 Mar 2024
Tom,Lee,https://www.linkedin.com/in/tomlee,,Halter Ltd,Software Engineer,02 Feb 2021
"Smith, Jr.",Bob,https://www.linkedin.com/in/bob,,"Fisher & Paykel Healthcare",Product Manager,01 Jan 2020
,,https://www.linkedin.com/in/nobody,,Xero,Nobody,01 Jan 2020
Ana,Ruiz,https://www.linkedin.com/in/ana,,Xero,Senior Product Manager,05 May 2023
`;

describe("the connections export", () => {
  it("is recognised by its header after LinkedIn's note lines, and only a .csv", () => {
    expect(isConnectionsFileName("Connections.csv")).toBe(true);
    expect(isConnectionsFileName("cv.pdf")).toBe(false);
    expect(isConnectionsCsv(CSV)).toBe(true);
    expect(isConnectionsCsv("name,age\nBob,3")).toBe(false);
  });
  it("parses rows with quotes, drops the email column and rows without a name", () => {
    expect(splitCsvLine('"Smith, Jr.",Bob,"a ""quoted"" cell",x')).toEqual(["Smith, Jr.", "Bob", 'a "quoted" cell', "x"]);
    const rows = parseConnections(CSV);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ name: "Jane Doe", url: "https://www.linkedin.com/in/janedoe", company: "Halter", position: "Head of Product", connectedOn: "12 Mar 2024" });
    expect(rows[2].name).toBe("Smith, Jr. Bob");
    expect(JSON.stringify(rows)).not.toContain("jane@example.com");
    expect(chunkConnections(Array.from({ length: 1201 }, (_, i) => rows[i % 4]))).toHaveLength(3);
    expect(CONNECTIONS_CHUNK).toBe(500);
  });
  it("matches a company by name tokens — suffixes and country words ignored, one short word never enough", () => {
    expect(companyTokens("Fisher & Paykel Healthcare Ltd")).toEqual(["fisher", "paykel", "healthcare"]);
    expect(companyMatches("Halter", "Halter Ltd")).toBe(true);
    expect(companyMatches("Xero", "Xero Limited NZ")).toBe(true);
    expect(companyMatches("Fisher & Paykel Healthcare", "Fisher and Paykel Healthcare Ltd")).toBe(true);
    expect(companyMatches("Halter", "Halter Marine Group")).toBe(false);
    expect(companyMatches("Spark", "Spark New Zealand")).toBe(true);
    expect(companyMatches("Spark", "Sparkle Ltd")).toBe(false);
    expect(companyMatches("Air New Zealand", "Air NZ")).toBe(true);
    expect(companyMatches("", "Xero")).toBe(false);
    const by = matchConnections(parseConnections(CSV), ["Halter", "Xero", "Tracksuit"]);
    expect(by.get("Halter")?.map((c) => c.name)).toEqual(["Jane Doe", "Tom Lee"]);
    expect(by.get("Xero")?.map((c) => c.name)).toEqual(["Ana Ruiz"]);
    expect(by.has("Tracksuit")).toBe(false);
  });
});

const today = "2026-11-17";
const titles = ["Senior Product Manager", "Product Lead", "Head of Product"];

describe("growth, suggested from facts", () => {
  it("reads the date a signal names", () => {
    expect(signalDate("Series B NZD 20m (2026-09)")).toBe("2026-09-01");
    expect(signalDate("Raised NZD 20m — BusinessDesk, Sep 2026")).toBe("2026-09-01");
    expect(signalDate("FY26 revenue +11%")).toBe("2026-06-30");
    expect(signalDate("Opened Sydney office in 2025")).toBe("2025-01-01");
    expect(signalDate("Growing fast")).toBeNull();
    expect(daysBetween("2026-09-01", today)).toBe(77);
  });
  it("matches a posting title to the archetype on a meaningful word, seniority words aside", () => {
    expect(titleMatches("Senior Product Manager", titles)).toBe(true);
    expect(titleMatches("Product Owner", titles)).toBe(true);
    expect(titleMatches("Senior Accountant", titles)).toBe(false);
    expect(titleMatches("Lead", titles)).toBe(false);
  });
  it("suggests 5 for hiring now + a dated event this quarter, 4 for one of them, 3 for a signal this year, 2 for undated, 1 for nothing", () => {
    const hiring = [{ title: "Senior Product Manager", postedAt: "2026-11-12", source: "Seek" }, { title: "Product Lead", postedAt: "2026-11-01", source: "Adzuna" }, { title: "Accountant", postedAt: "2026-11-10", source: "Adzuna" }];
    const five = growthSuggestion({ growthSignal: "Series B NZD 20m (Sep 2026)", growthSource: "https://n/x" }, hiring, titles, today);
    expect(five.suggested).toBe(5);
    expect(five.why).toEqual(["hiring 2 roles for you now — Senior Product Manager, Product Lead (Seek, 2026-11-12)", "Series B NZD 20m (Sep 2026) ›"]);
    expect(growthSuggestion({ growthSignal: "", growthSource: "" }, hiring, titles, today).suggested).toBe(4);
    expect(growthSuggestion({ growthSignal: "Opened a Sydney site (Oct 2026)", growthSource: "https://n/y" }, [], titles, today).suggested).toBe(4);
    expect(growthSuggestion({ growthSignal: "FY26 result +11% (Aug 2026)" }, [], titles, today).suggested).toBe(3);
    expect(growthSuggestion({ growthSignal: "FY26 result +11% (Aug 2026)" }, [{ title: "Accountant", postedAt: "2026-11-10", source: "Adzuna" }], titles, today)).toMatchObject({ suggested: 3, why: ["hiring 1 role now, none for your titles", "FY26 result +11% (Aug 2026)"] });
    expect(growthSuggestion({ growthSignal: "Growing fast" }, [], titles, today).suggested).toBe(2);
    expect(growthSuggestion({ growthSignal: "Raised in 2023" }, [], titles, today).suggested).toBe(2);
    expect(growthSuggestion({}, [], titles, today)).toEqual({ suggested: 1, why: ["nothing on file"] });
    // A posting older than 30 days is not "now".
    expect(growthSuggestion({}, [{ title: "Product Manager", postedAt: "2026-08-01", source: "Adzuna" }], titles, today).suggested).toBe(1);
  });
});

describe("access, suggested from the connections", () => {
  const c = (name: string, position: string): Connection => ({ name, url: "", company: "Halter", position, connectedOn: "2024" });
  it("names a first-degree connection → 5, authority roles first, the rest counted", () => {
    const a = accessSuggestion([c("Tom Lee", "Software Engineer"), c("Jane Doe", "Head of Product"), c("Ana", "Designer"), c("Bo", "Analyst")], 2, titles);
    expect(a.suggested).toBe(5);
    expect(a.contacts.map((x) => x.name)).toEqual(["Jane Doe", "Tom Lee", "Ana"]);
    expect(a.more).toBe(1);
  });
  it("a posting now is a route → 3; nothing → 1 — 4 and 2 are the member's", () => {
    expect(accessSuggestion([], 1, titles)).toEqual({ suggested: 3, contacts: [], more: 0 });
    expect(accessSuggestion([], 0, titles)).toEqual({ suggested: 1, contacts: [], more: 0 });
  });
});

describe("interest and proof — context, no number", () => {
  const boundaries = { willWorkIn: "Auckland, Wellington", exclude: "Sydney", remote: "Y", neverApply: ["Acme Corp"] };
  it("says how the company sits against the boundaries", () => {
    expect(interestContext({ name: "Halter", location: "Auckland, New Zealand", companyType: "scaleup" }, boundaries, "scaleup")).toBe("Auckland, New Zealand · scaleup — the type you aim at");
    expect(interestContext({ name: "Canva", location: "Sydney, Australia", companyType: "established" }, boundaries, "scaleup")).toBe("Sydney, Australia — on your exclude list; remote: yes · established");
    expect(interestContext({ name: "Xero", location: "Christchurch" }, boundaries, "")).toBe("Christchurch — not in Will work in; remote: yes");
    expect(interestContext({ name: "Acme Corp Ltd", location: "Auckland" }, boundaries, "")).toBe("Auckland · on your never-join list");
    expect(interestContext({ name: "X" }, undefined, "")).toBe("no boundary on file speaks to this one");
  });
  it("quotes what they post for beside the competency that fits", () => {
    const p = proofContext(["own the product roadmap", "lead discovery with customers", "own the product roadmap", "x"], ["Product discovery", "Stakeholder alignment", "Roadmap ownership"]);
    expect(p.phrases).toEqual(["own the product roadmap", "lead discovery with customers", "x"]);
    expect(p.matches).toEqual(["Product discovery", "Roadmap ownership"]);
    expect(p.line).toBe('they post for "own the product roadmap", "lead discovery with customers", "x" — you have Product discovery, Roadmap ownership');
    expect(proofContext([], ["A"]).line).toBe("no postings read — a guess unless you know their problem");
    expect(proofContext(["ship fast"], ["Accounting"]).line).toContain("none of your competencies in their words");
  });
});

describe("the evidence for a row", () => {
  it("pre-fills growth and access, leaves interest and proof to the member", () => {
    const e = evidenceFor({
      company: { name: "Halter", location: "Auckland", companyType: "scaleup", growthSignal: "Series B NZD 20m (Sep 2026)", growthSource: "https://n/x" },
      postings: [{ title: "Senior Product Manager", postedAt: "2026-11-12", source: "Seek", phrases: ["own the roadmap"] }],
      contacts: [{ name: "Jane Doe", url: "", company: "Halter", position: "Head of Product", connectedOn: "2024" }],
      archetypeTitles: titles, competencies: ["Roadmap ownership"], boundaries: { willWorkIn: "Auckland" }, wantedType: "scaleup", today,
    });
    expect(suggestedValues(e)).toEqual([5, null, 5, null]);
    expect(e.interest.line).toBe("Auckland · scaleup — the type you aim at");
    expect(e.proof.matches).toEqual(["Roadmap ownership"]);
    expect(archetypeTitlesOf({ clusters: [{ titles: ["Product Lead", "PM"], fit: "primary" }, { titles: ["Other"], fit: "secondary" }], titles: { target: ["PM", "Head of Product"] } })).toEqual(["Product Lead", "PM", "Head of Product"]);
    expect(trueNorthPostingsAt([{ title: "PM", company: "Halter Ltd", verified: "2026-11-01", phrases: ["a"] }, { title: "X", company: "Xero" }], "Halter", companyMatches)).toEqual([{ title: "PM", postedAt: "2026-11-01", source: "your postings", phrases: ["a"] }]);
  });
});

describe("overrides", () => {
  const r = RUBRICS.companies;
  it("ride the row the member sends, validated against the axes, and flag up and down for the coach", () => {
    const parsed = parseRows([
      { item: "Halter", values: [3, 5, 5, 4], overrides: [{ axis: "growth", from: 5 }, { axis: "nope", from: 2 }, { axis: "access", from: 9 }] },
      { item: "Xero", values: [3, 2, 4, 2], overrides: [{ axis: "access", from: 1 }] },
      { item: "Canva", values: [2, 2, 1, 1] },
    ], ["Halter", "Xero", "Canva"], r);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0].overrides).toEqual([{ axis: "growth", from: 5 }]);
    expect(parsed.rows[2].overrides).toBeUndefined();
    const flags = overrideFlags(parsed.rows);
    expect(flags.map((f) => f.id)).toEqual(["override_up", "override_down"]);
    expect(flags[0].line).toContain("Xero — Access 1 → 4");
    expect(flags[1].line).toContain("Halter — Growth 5 → 3");
    const scored = withOverrides(rankRows(parsed.rows.map(({ item, values }) => ({ item, values })), r), parsed.rows);
    expect(scored.find((s) => s.item === "Xero")?.overrides).toEqual([{ axis: "access", from: 1 }]);
    expect(scored.find((s) => s.item === "Canva")?.overrides).toBeUndefined();
  });
});
