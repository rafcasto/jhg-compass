import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseProfileFile } from "@/lib/careerops/profile-file";
import {
  boundaryLists, companyFacts, cvRuleLists, identityFacts, isoDate, languageLines, locationFacts, salaryFacts, scoresLine, storyFact, storyFactFacts, top10Facts, top3Facts, workbookSummary,
} from "@/lib/jobhacking/workbook";
import { cleanStoryBank, snapshotDetail, storyStar } from "@/lib/jobhacking/story-bank";

// The workbook (profile.yml `jhg`) as the JobHacking pages read it — every
// helper reads a key the four Packer samples carry; none invents one.

const read = (name: string) => parseProfileFile(readFileSync(path.resolve(__dirname, `../public/${name}.example.yml`), "utf8"), `${name}.yml`).profile;

describe("workbook helpers", () => {
  it("summarises which blocks are present and renders ISO dates", () => {
    expect(workbookSummary(read("narrative").jhg)).toBe("identity · narrative");
    expect(workbookSummary(read("target-companies").jhg)).toBe("identity · target companies");
    expect(workbookSummary(undefined)).toBe("");
    expect(isoDate("2026-11-06")).toBe("6 Nov 2026");
    expect(isoDate("end of 2027")).toBe("end of 2027");
  });

  it("identity facts leave out what the contact editor already shows", () => {
    const f = identityFacts(read("narrative").jhg);
    expect(f.map((x) => x.label)).toEqual(["Location", "Time zone", "Preferred channel", "Other emails", "Contact note", "Output language"]);
    expect(f.find((x) => x.label === "Other emails")!.value).toBe("ana@freightdesk.example");
  });

  it("true north — salary, location and boundary lists", () => {
    const b = read("true-north").jhg!.trueNorth!.boundaries;
    expect(salaryFacts(b)).toEqual([{ label: "Range", value: "NZD 150,000 – 175,000" }, { label: "Floor", value: "NZD 140,000" }]);
    expect(locationFacts(b).map((x) => `${x.label}: ${x.value}`)).toEqual([
      "Will work in: Wellington; remote across New Zealand or Australia", "Exclude: roles requiring relocation to the United States", "Remote: Y, NZ or AU time zones",
      "Local hybrid: Y, up to 2 days on site in Wellington, no change to floor", "Relocate: No", "Travel for a remote role: 1 week a quarter in Sydney or Melbourne",
      "Work rights: New Zealand citizen; Australian work rights under the Trans-Tasman arrangement", "Authorised in: New Zealand, Australia", "Needs sponsorship: No",
    ]);
    expect(boundaryLists(b).map((l) => `${l.label} (${l.items.length})`)).toEqual([
      "Hard no's — do not apply (3)", "Culture must-haves — deprioritise when absent (3)", "Soft dislikes — lower, not a no (3)", "Levels to exclude (3)", "Never apply (2)",
    ]);
  });

  it("target companies — scores on a line, and the facts written for each list, matched by name", () => {
    const p = read("target-companies");
    const kauri = p.companyLists!.top3!.sunrise![0];
    expect(scoresLine(kauri.scores)).toBe("19 · G5 I5 A4 P5");
    expect(top3Facts(kauri, p.jhg).map((f) => f.label)).toEqual(["Why now", "First move", "By"]);
    expect(top3Facts(kauri, p.jhg)[2].value).toBe("4 Nov 2026");
    expect(top10Facts(kauri, p.jhg).find((f) => f.label === "Hiring authority")!.value).toBe("CTO");
    expect(top10Facts(kauri, p.jhg).find((f) => f.label === "Say it loud")!.value).toBe("Yes");
    const totara = p.companyLists!.all!.sunrise![3];
    expect(companyFacts(totara, p.jhg).find((f) => f.label === "Known contact")!.value).toBe("Hemi Walker (former Ledgerline colleague)");
    expect(companyFacts(totara, p.jhg).find((f) => f.label === "Growth signal")!.url).toBe("https://news.example/totara-payments-growth-2026");
    expect(companyFacts(totara, p.jhg).find((f) => f.label === "Found via")!.value).toBe("Job posting");
    expect(top3Facts({ name: "Nobody" }, p.jhg)).toEqual([]);
  });

  it("artefacts — STAR lines, snapshot detail, the fact behind a story, CV rules and languages", () => {
    const p = read("artefacts");
    expect(storyStar(p.stories![0]).map((l) => l.label)).toEqual(["Situation", "Task", "Action", "Reflection"]);
    expect(snapshotDetail(p.snapshots![0]).map((d) => d.label)).toEqual(["Context", "Challenge", "Role", "What I did", "Why it matters here", "Key decisions"]);
    expect(snapshotDetail(p.snapshots![1]).map((d) => d.label)).not.toContain("Key decisions");
    const fact = storyFact(p.jhg, p.stories![6]);
    expect(fact?.id).toBe("S7");
    expect(storyFactFacts(fact).map((f) => `${f.label}: ${f.value}`)).toEqual([
      "Where: Ledgerline · Delivery Manager", "Lead skill: Cross-team coordination", "Numbers: about 30% · 12% · 6 months",
      "Source: Estimate — Slack thread with the CTO; the 30% is my own count from Jira exports",
    ]);
    expect(storyFactFacts(storyFact(p.jhg, { title: "Weekly reporting automation" }))[3].value).toMatch(/^Can't confirm/);
    expect(cvRuleLists(p.jhg).map((l) => l.label)).toEqual(["CV house rules", "Locked sections — never rewritten"]);
    expect(languageLines(p.jhg)).toEqual(["te reo Māori — beginner → conversational by end of 2027 (New Zealand)"]);
  });

  it("the story bank editor carries the Packer's fields through a save", () => {
    const p = read("artefacts");
    const clean = cleanStoryBank({ proofPoints: p.narrative!.proofPoints!, stories: p.stories!, snapshots: p.snapshots! });
    expect(clean.narrative.proofPoints[0].url).toBe("https://ana-ferreira.example/release-cadence-playbook");
    expect(clean.stories[0].situation).toBe("a 110-engineer logistics SaaS doubling in size");
    expect(clean.stories[0].reflection).toMatch(/^Measure the outcome/);
    expect(clean.snapshots[0].activities).toHaveLength(3);
    expect(clean.snapshots[0].keyDecisions).toHaveLength(1);
  });
});
