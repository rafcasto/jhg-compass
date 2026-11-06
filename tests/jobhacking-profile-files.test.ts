import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mergeProfile, parseProfileFile, profileFromSetup, profileToSetupPatch } from "@/lib/careerops/profile-file";
import { JH_FILES, detectJhFile, jhFilePage, jhFilePreview, jhFileStatuses, jhFilesProgress, shapeJhFile } from "@/lib/jobhacking/profile-files";
import { JH_FILE_EDIT, JH_SECTIONS, jhSectionSummaries } from "@/lib/jobhacking/sections";
import { FILE_SECTIONS } from "@/lib/profile-sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// The four Packer files as JobHacking → Settings sees them (decision 2026-11-07).

const read = (name: string) => readFileSync(path.resolve(__dirname, `../public/${name}.example.yml`), "utf8");

describe("the four slots", () => {
  it("are Narrative · True North · Target companies · Artefacts, one per page, named as the Packer names them", () => {
    expect(JH_FILES.map((f) => f.label)).toEqual(["Narrative", "True North", "Target companies", "Artefacts"]);
    expect(JH_FILES.map((f) => f.filename)).toEqual(["narrative.yml", "true-north.yml", "target-companies.yml", "artefacts.yml"]);
    expect(JH_FILES.map((f) => jhFilePage(f.key).key)).toEqual(["narrative", "true-north", "companies", "artefacts"]);
    for (const f of JH_FILES) for (const s of f.sections) expect(Object.keys(FILE_SECTIONS)).toContain(s);
  });

  it("every file section has a JobHacking door, or is deliberately without one", () => {
    expect(Object.keys(JH_FILE_EDIT).sort()).toEqual(Object.keys(FILE_SECTIONS).sort());
    expect(JH_FILE_EDIT.narrative).toBe("headline");
    expect(JH_FILE_EDIT.jhg).toBe("boundaries");
    expect(JH_SECTIONS.some((s) => s.key === "boundaries" && s.page === "true-north")).toBe(true);
  });
});

describe("detecting which file a drop is", () => {
  it("reads the file's own jhg.progress stamp first", () => {
    for (const [name, key] of [["narrative", "narrative"], ["true-north", "trueNorth"], ["target-companies", "targetCompanies"], ["artefacts", "artefacts"]] as const) {
      const p = parseProfileFile(read(name), "whatever.yml").profile;
      expect(detectJhFile(p, "whatever.yml")).toBe(key);
    }
  });

  it("falls back to the filename, and says null for a whole profile.yml", () => {
    expect(detectJhFile({ version: 1 } as never, "true-north.yml")).toBe("trueNorth");
    expect(detectJhFile({ version: 1 } as never, "Target Companies (2).yaml")).toBe("targetCompanies");
    expect(detectJhFile({ version: 1 } as never, "artifacts.yml")).toBe("artefacts");
    expect(detectJhFile({ version: 1 } as never, "profile.yml")).toBeNull();
    // Two stamps: the merged export — a whole profile again.
    expect(detectJhFile({ jhg: { progress: { narrative: {}, artefacts: {} } } }, "profile.yml")).toBeNull();
  });
});

describe("slot status", () => {
  it("is not uploaded until a record or a Packer stamp exists, then quotes both", () => {
    expect(jhFilesProgress(jhFileStatuses(null))).toEqual({ done: 0, total: 4 });
    const setup = {
      profileFiles: { narrative: { filename: "narrative.sample.yml", at: new Date(2026, 10, 7, 12).getTime() } },
      jhg: { progress: { narrative: { status: "complete", updated: "2026-11-06" }, trueNorth: { status: "complete", updated: "2026-11-06" } } },
    } as unknown as CareerOpsSetupV2;
    const s = jhFileStatuses(setup);
    expect(s.find((x) => x.key === "narrative")).toMatchObject({ uploaded: true, filename: "narrative.sample.yml", packer: "complete · 6 Nov 2026" });
    expect(s.find((x) => x.key === "narrative")!.uploadedOn).toMatch(/7 Nov 2026/);
    expect(s.find((x) => x.key === "trueNorth")).toMatchObject({ uploaded: true, packer: "complete · 6 Nov 2026" });
    expect(s.find((x) => x.key === "artefacts")).toMatchObject({ uploaded: false });
    expect(jhFilesProgress(s)).toEqual({ done: 2, total: 4 });
  });
});

describe("the Boundaries row and the superpowers on the Core competencies row", () => {
  it("reads the True North file's boundaries, and the Narrative file's superpowers when the prose is empty", () => {
    const setup = {
      narrative: { superpowers: ["Release management", "Incident management"] },
      jhg: { trueNorth: { boundaries: { hardNos: ["on-site 5 days", "gambling"], cultureMustHaves: ["blameless reviews"], neverApply: ["Kiwi Bet Online"], noticePeriodDays: 28 } } },
    } as unknown as CareerOpsSetupV2;
    const rows = jhSectionSummaries({ setup, profile: null });
    expect(rows.find((r) => r.key === "boundaries")).toMatchObject({ state: "done", summary: "2 hard no's · 1 must-have · 1 never apply · 28 days' notice" });
    expect(rows.find((r) => r.key === "competencies")).toMatchObject({ state: "partial", summary: "Release management, Incident management", count: "2" });
    expect(jhSectionSummaries({ setup: null, profile: null }).find((r) => r.key === "boundaries")).toMatchObject({ state: "empty", summary: "Not in your profile yet" });
  });
});

describe("what a file writes and what the preview says — the page's sections, nothing more, nothing less", () => {
  const file = (name: string) => parseProfileFile(read(name), `${name}.yml`).profile;
  const preview = (key: "narrative" | "trueNorth" | "targetCompanies" | "artefacts", name: string, before: Partial<CareerOpsSetupV2> = {}) => {
    const current = profileFromSetup({ profile: null, setup: before as CareerOpsSetupV2 });
    const shaped = shapeJhFile(key, file(name), current);
    const after = { ...before, ...profileToSetupPatch(mergeProfile(current, shaped)).setup };
    return { rows: jhFilePreview(key, shaped, before, after, null), after };
  };

  it("narrative.yml → Contact details · Headline · Bridge story · Core competencies, all added, and the fields are filled", () => {
    const { rows, after } = preview("narrative", "narrative");
    expect(rows.map((r) => [r.label, r.kind, r.headline])).toEqual([
      ["Contact details", "add", "adds"], ["Headline", "add", "adds"], ["Bridge story", "add", "adds"], ["Core competencies", "add", "adds"],
    ]);
    expect(rows.map((r) => r.href)).toEqual(["/jobhacking/narrative?section=contact", "/jobhacking/narrative?section=headline", "/jobhacking/narrative?section=story", "/jobhacking/narrative?section=competencies"]);
    expect(after.contact?.title).toMatch(/^I help SaaS scale-ups ship predictably/);
    expect(after.contact?.location).toBe("Wellington, New Zealand");
    expect(after.personalization?.crossCuttingAdvantage).toBe("Release management; Incident management; Programme delivery");
    expect(rows[1].detail).toMatch(/^I help SaaS scale-ups/);
    expect(rows[3].detail).toBe("Release management; Incident management; Programme delivery");
  });

  it("true-north.yml → the seven True North sections; target-companies.yml → Top 3 · Top 10 · Top 40 · Watchlist; artefacts.yml → Story Bank · Master CV · LinkedIn profile", () => {
    expect(preview("trueNorth", "true-north").rows.map((r) => `${r.label}:${r.kind}`)).toEqual([
      "Target industry:add", "Target roles:add", "Seniority:add", "Salary range:add", "Location:add", "Company type:add", "Boundaries:add",
    ]);
    expect(preview("targetCompanies", "target-companies").rows.map((r) => `${r.label}:${r.kind}`)).toEqual(["Top 3:add", "Top 10:add", "Top 40:add", "Watchlist:add"]);
    expect(preview("artefacts", "artefacts").rows.map((r) => `${r.label}:${r.kind}`)).toEqual(["Story Bank:add", "Master CV:add", "LinkedIn profile:add"]);
  });

  it("a section the file does not carry is said to be left alone; an identical re-upload is 'same as now'", () => {
    const { rows, after } = preview("narrative", "narrative");
    const again = preview("narrative", "narrative", after);
    expect(again.rows.every((r) => r.kind === "keep" && r.headline === "same as now")).toBe(true);
    const partialFile = { version: 1, contact: { phone: "+64 21 000" } };
    const partialAfter = { ...after, ...profileToSetupPatch(mergeProfile(profileFromSetup({ profile: null, setup: after as CareerOpsSetupV2 }), partialFile)).setup };
    const partial = jhFilePreview("narrative", partialFile, after, partialAfter, null);
    expect(partial.map((r) => r.headline)).toEqual(["replaces", "not in the file — left as it is", "not in the file — left as it is", "not in the file — left as it is"]);
    expect(rows).toHaveLength(4);
  });

  it("the page's own file wins: the Artefacts file fills Headline and Core competencies only while blank", () => {
    const narrativeFirst = preview("narrative", "narrative").after;
    const thenArtefacts = preview("artefacts", "artefacts", narrativeFirst).after;
    expect(thenArtefacts.contact?.title).toMatch(/^I help SaaS scale-ups/);
    expect(thenArtefacts.contact?.phone).toBe("+64 21 555 0199");
    expect(thenArtefacts.personalization?.crossCuttingAdvantage).toBe("Release management; Incident management; Programme delivery");
    expect(thenArtefacts.personalization?.adaptiveFraming).toHaveLength(3);
    const artefactsAlone = preview("artefacts", "artefacts").after;
    expect(artefactsAlone.contact?.title).toBe("Delivery Lead for SaaS teams scaling past product–market fit");
    expect(artefactsAlone.personalization?.crossCuttingAdvantage).toMatch(/^I measure delivery/);
  });
});
