import { describe, it, expect } from "vitest";
import { proofPoints, provenanceLabel, snapshotFigures, stories, storyBankCounts, storyBankSummary, storyRows } from "@/lib/jobhacking/story-bank";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// JobHacking → Artefacts → Story Bank — docs/UX_JOBHACKING.md §3d. Reads the
// Packer's narrative.proofPoints · stories · snapshots as they are; invents nothing.

const setup = {
  narrative: { proofPoints: [{ name: "Fortnightly release train", heroMetric: "Monthly to fortnightly across 9 teams" }, { name: "  " }, { name: "Incident halving" }] },
  stories: [
    { id: "S1", title: "Fortnightly release train", result: "Moved cadence from monthly to fortnightly.", provenance: "verified" },
    { id: "S2", title: "Incident halving", provenance: "estimate" },
    { title: "" },
    { title: "Tenant migration" },
  ],
  snapshots: [
    { company: "Tracksuit", storyId: "S1", title: "Fortnightly release train", results: ["monthly", "fortnightly"] },
    { company: "Halter", storyId: "S1", results: ["9 teams"] },
    { company: "Partly", storyId: "S9", results: [] },
    { company: "", storyId: "S2" },
  ],
} as CareerOpsSetupV2;

describe("story bank", () => {
  it("keeps only the rows the Packer filled in — a name, a title, a company", () => {
    expect(proofPoints(setup).map((p) => p.name)).toEqual(["Fortnightly release train", "Incident halving"]);
    expect(stories(setup).map((s) => s.title)).toEqual(["Fortnightly release train", "Incident halving", "Tenant migration"]);
    expect(storyBankCounts(setup)).toEqual({ proofPoints: 2, stories: 3, snapshots: 3, total: 8 });
  });

  it("summarises what the file carries and nothing else", () => {
    expect(storyBankSummary(setup)).toBe("3 stories · 2 proof points · 3 snapshots");
    expect(storyBankSummary({ stories: [{ title: "One" }] })).toBe("1 story");
    expect(storyBankSummary({ narrative: { proofPoints: [{ name: "P" }] }, snapshots: [{ company: "A" }] })).toBe("1 proof point · 1 snapshot");
    expect(storyBankSummary(null)).toBe("");
    expect(storyBankCounts(undefined).total).toBe(0);
  });

  it("files each snapshot under the story its storyId names, and keeps the ones no story claims", () => {
    const { stories: rows, unlinked } = storyRows(setup);
    expect(rows.map((r) => r.story.title)).toEqual(["Fortnightly release train", "Incident halving", "Tenant migration"]);
    expect(rows[0].snapshots.map((s) => s.company)).toEqual(["Tracksuit", "Halter"]);
    expect(rows[1].snapshots).toEqual([]);
    expect(rows[2].snapshots).toEqual([]);
    expect(unlinked.map((s) => s.company)).toEqual(["Partly"]);
  });

  it("reads the provenance word as written, capitalised, and joins the figures in order", () => {
    expect(provenanceLabel("verified")).toBe("Verified");
    expect(provenanceLabel("estimate")).toBe("Estimate");
    expect(provenanceLabel("from a 2023 board pack")).toBe("From a 2023 board pack");
    expect(provenanceLabel("")).toBe("");
    expect(provenanceLabel(undefined)).toBe("");
    expect(snapshotFigures({ company: "Tracksuit", results: ["monthly", " fortnightly ", ""] })).toBe("monthly → fortnightly");
    expect(snapshotFigures({ company: "Partly" })).toBe("");
  });
});
