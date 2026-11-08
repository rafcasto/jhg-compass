import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mergeProfile, parseProfileFile, profileFromSetup, profileToSetupPatch } from "@/lib/careerops/profile-file";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import { SHARE_PAGES, isSharePage, isShareToken, shareAuthor, shareDate, shareDocument, shareEmpty, shareHref, shareSections, shareUrl, type ShareBlock } from "@/lib/jobhacking/share";
import { jhSectionsFor } from "@/lib/jobhacking/sections";
import type { Profile } from "@/lib/types";

// Share a JobHacking page as a read-only document — docs/UX_SHARE.md. Four
// pages, one link each; the document carries every section of the page the
// portal shows, less Contact details, and leaves out a section with nothing
// in it. Built from the same registry and the same fields as the page.

const read = (name: string) => readFileSync(path.resolve(__dirname, `../public/${name}.example.yml`), "utf8");
const FILES = ["narrative", "true-north", "target-companies", "artefacts"] as const;

/** The four Packer samples unpacked, as Settings does it — the fullest profile there is. */
function unpackAll(): CareerOpsSetupV2 {
  let setup: Partial<CareerOpsSetupV2> = {};
  for (const n of FILES) {
    const parsed = parseProfileFile(read(n), `${n}.example.yml`).profile;
    const current = profileFromSetup({ profile: null, setup: setup as CareerOpsSetupV2 });
    const patch = profileToSetupPatch(mergeProfile(current, parsed));
    setup = { ...setup, ...patch.setup, ...(patch.goal ? { goalSource: "intake", intakeGoal: patch.goal } : {}) };
  }
  return setup as CareerOpsSetupV2;
}

const profile = { email: "ana@example.com", firstName: "Ana", lastName: "Ferreira" } as Profile;
const full = unpackAll();
const signals = { setup: full, profile };

const kinds = (blocks: ShareBlock[]) => blocks.map((b) => b.kind);
const labels = (blocks: ShareBlock[]) => blocks.map((b) => ("label" in b ? b.label : undefined));
const flat = (v: unknown): string => JSON.stringify(v);

describe("the pages and the link", () => {
  it("shares the four JobHacking menu pages, in menu order, and nothing else", () => {
    // One link per page with a header of its own (2026-11-09): the hub is not one; an Artefacts link minted before still renders.
    expect(SHARE_PAGES).toEqual(["narrative", "true-north", "companies", "story-bank", "master-cv", "linkedin"]);
    expect(isSharePage("artefacts")).toBe(false);
    expect(shareDocument("artefacts", signals).sections.map((s) => s.key)).toEqual(["story-bank", "master-cv", "linkedin-profile"]);
    expect(shareDocument("story-bank", signals).sections.map((s) => s.key)).toEqual(["story-bank"]);
    expect(shareDocument("linkedin", signals).title).toBe("LinkedIn profile");
    expect(isSharePage("agents")).toBe(false);
    expect(isSharePage("true-north")).toBe(true);
    expect(isSharePage(undefined)).toBe(false);
  });

  it("accepts only a 32-hex token and builds the link on the origin the member is on", () => {
    const token = "4f1c9a2e4f1c9a2e4f1c9a2e4f1c9a2e";
    expect(isShareToken(token)).toBe(true);
    expect(isShareToken("../users")).toBe(false);
    expect(isShareToken(token.slice(1))).toBe(false);
    expect(shareHref(token)).toBe(`/share/${token}`);
    expect(shareUrl("https://compass.example/", token)).toBe(`https://compass.example/share/${token}`);
  });

  it("writes the date for a reader, not a machine", () => {
    expect(shareDate(Date.UTC(2026, 10, 7, 12))).toBe("7 Nov 2026");
  });

  it("names the author from the account, never from the file", () => {
    expect(shareAuthor(profile)).toBe("Ana Ferreira");
    expect(shareAuthor({ email: "x@example.com" } as Profile)).toBe("");
    expect(shareDocument("narrative", signals).author).toBe("Ana Ferreira");
  });
});

describe("what a page's document carries", () => {
  it("is the JobHacking portal's own sections for the page, less Contact details", () => {
    for (const page of SHARE_PAGES) {
      const portal = jhSectionsFor(page, { portal: "jobhacking" }).map((s) => s.key);
      expect(shareSections(page).map((s) => s.key)).toEqual(portal.filter((k) => k !== "contact"));
    }
    expect(shareSections("narrative").map((s) => s.key)).toEqual(["headline", "story", "competencies"]);
    expect(shareSections("true-north").map((s) => s.key)).not.toContain("work-rights");
  });

  it("never puts the account's phone or email in a document — only the CV's own header carries them", () => {
    for (const page of SHARE_PAGES) {
      const doc = shareDocument(page, signals);
      // The Master CV is the member's own document, written to be sent: its header stays as written.
      const outsideCv = flat({ ...doc, sections: doc.sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.kind !== "markdown") })) });
      expect(outsideCv).not.toContain("+64 21 555 0199");
      expect(outsideCv).not.toContain("ana@example.com");
      expect(doc.sections.map((s) => s.key)).not.toContain("contact");
    }
  });

  it("leaves out a section with nothing in it, and knows when the whole page is empty", () => {
    const thin = { setup: { contact: { title: "Delivery Lead" } } as CareerOpsSetupV2, profile };
    expect(shareDocument("narrative", thin).sections.map((s) => s.key)).toEqual(["headline"]);
    expect(shareEmpty("narrative", thin)).toBe(false);
    expect(shareEmpty("artefacts", thin)).toBe(true);
    expect(shareEmpty("companies", { setup: null, profile: null })).toBe(true);
    expect(shareDocument("true-north", thin).lead).toBeUndefined();
  });
});

describe("Narrative", () => {
  const doc = shareDocument("narrative", signals);
  it("reads headline, bridge story and competencies with the workbook beside each", () => {
    expect(doc.title).toBe("Narrative");
    const by = Object.fromEntries(doc.sections.map((s) => [s.key, s.blocks]));
    expect(kinds(by.headline)).toEqual(["text", "text"]);
    expect(labels(by.headline)).toEqual([undefined, "Positioning line"]);
    expect(by.story[0]).toMatchObject({ kind: "text", text: expect.stringMatching(/^I was the operations analyst/) });
    expect(labels(by.story)).toEqual([undefined, "In one line"]);
    expect(labels(by.competencies)).toEqual([undefined, "Superpowers", "Lead skills"]);
    expect(by.competencies[1]).toMatchObject({ kind: "list", items: ["Release management", "Incident management", "Programme delivery"] });
  });
});

describe("True North", () => {
  const doc = shareDocument("true-north", signals);
  const by = Object.fromEntries(doc.sections.map((s) => [s.key, s.blocks]));
  it("opens with the one statement and carries every section in the page's order", () => {
    expect(doc.lead).toMatch(/^In 60 days, I'm working as Senior Delivery Lead, in Freight dispatch software\./);
    expect(doc.sections.map((s) => s.key)).toEqual(["industry", "roles", "seniority", "salary", "location", "company-type", "boundaries"]);
  });
  it("puts the member's own values first and the file's facts after, never doubled", () => {
    const salary = by.salary[0];
    expect(salary.kind).toBe("facts");
    if (salary.kind !== "facts") return;
    expect(salary.facts[0]).toEqual({ label: "Range", value: "NZD 150,000–175,000" });
    expect(salary.facts.filter((f) => f.label === "Range")).toHaveLength(1);
    expect(labels(by.salary)).toContain("Negotiation scripts");
    expect(labels(by.location)).toContain("Rules");
  });
  it("reads the roles with archetypes, framing, titles, clusters and postings", () => {
    expect(by.roles[0]).toMatchObject({ kind: "text", text: "Senior Delivery Lead" });
    expect(labels(by.roles)).toContain("Archetypes");
    expect(labels(by.roles)).toContain("Target titles");
    expect(labels(by.roles)).toContain("Postings read");
    const postings = by.roles.find((b) => b.kind === "entries" && b.label === "Postings read");
    expect(postings && postings.kind === "entries" ? postings.entries.length : 0).toBe(15);
  });
  it("reads the boundaries as the file's lists and the notice period", () => {
    expect(labels(by.boundaries)).toContain("Hard no's — do not apply");
    expect(flat(by.boundaries)).toContain("28 days");
  });
});

describe("Target companies", () => {
  const doc = shareDocument("companies", signals);
  const by = Object.fromEntries(doc.sections.map((s) => [s.key, s.blocks]));
  it("carries the three ranked lists as sunrise / sunset groups of ranked rows, then the watchlist", () => {
    expect(doc.sections.map((s) => s.key)).toEqual(["top3", "top10", "top40", "companies"]);
    const top3 = by.top3[0];
    expect(top3.kind).toBe("entries");
    if (top3.kind !== "entries") return;
    expect(top3.label).toBe("Sunrise — growing");
    expect(top3.entries).toHaveLength(3);
    expect(top3.entries[0].index).toBe("1");
    expect(top3.entries[0].facts?.map((f) => f.label)).toContain("Why now");
  });
  it("reads the watchlist rows and both keyword lists", () => {
    expect(labels(by.companies)).toEqual(["Careers pages watched", "Titles to include", "Titles to exclude"]);
    const rows = by.companies[0];
    expect(rows.kind === "entries" ? rows.entries.length : 0).toBe(10);
  });
});

describe("Artefacts", () => {
  const doc = shareDocument("artefacts", signals);
  const by = Object.fromEntries(doc.sections.map((s) => [s.key, s.blocks]));
  it("carries the story bank as proof points and stories with their snapshots under them", () => {
    expect(labels(by["story-bank"])).toContain("Proof points");
    const stories = by["story-bank"].find((b) => b.kind === "entries" && b.label === "Stories");
    expect(stories?.kind).toBe("entries");
    if (!stories || stories.kind !== "entries") return;
    expect(stories.entries[0].facts?.map((f) => f.label)).toContain("Situation");
    expect(stories.entries.some((e) => e.children?.length)).toBe(true);
  });
  it("carries the master CV as markdown with the house rules, and the LinkedIn profile section by section", () => {
    expect(kinds(by["master-cv"])[0]).toBe("markdown");
    expect(labels(by["master-cv"])).toContain("CV house rules");
    expect(labels(by["linkedin-profile"])).toEqual(["Headline", "About", "Experience", "Featured", "Skills", "Education", "Licenses & certifications"]);
  });
});
