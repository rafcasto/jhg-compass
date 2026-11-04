import { describe, it, expect } from "vitest";
import { cleanStoryBank, nextStoryId, proofPoints, provenanceLabel, snapshotFigures, stories, storyBankCounts, storyBankDraft, storyBankSummary, storyRows } from "@/lib/jobhacking/story-bank";
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

describe("story bank — editing", () => {
  it("gives a new story the next free S<n>, filling a gap first and never reusing one", () => {
    expect(nextStoryId([])).toBe("S1");
    expect(nextStoryId([{ id: "S1", title: "a" }, { id: "S2", title: "b" }])).toBe("S3");
    expect(nextStoryId([{ id: "S1", title: "a" }, { id: "S3", title: "c" }])).toBe("S2");
    expect(nextStoryId([{ id: "S7", title: "a" }, { title: "no id" }])).toBe("S1");
  });

  it("opens the editor on copies of the stored lists, never the stored objects", () => {
    const d = storyBankDraft(setup);
    expect(d.stories).toHaveLength(4);
    expect(d.snapshots[0]).toEqual(setup.snapshots![0]);
    expect(d.snapshots[0]).not.toBe(setup.snapshots![0]);
    expect(d.snapshots[0].results).not.toBe(setup.snapshots![0].results);
    expect(storyBankDraft(null)).toEqual({ proofPoints: [], stories: [], snapshots: [] });
  });

  it("on save trims, drops rows missing their one required field, unlinks a snapshot from a story that is gone, and writes cleared lists empty", () => {
    const out = cleanStoryBank({
      proofPoints: [{ name: "  Release train ", heroMetric: " 9 teams " }, { name: " ", heroMetric: "orphan" }],
      stories: [{ id: "S1", title: " Release train ", result: "", provenance: " verified " }, { id: "S2", title: "" }],
      snapshots: [{ company: " Tracksuit ", storyId: "S1", title: "", results: [" monthly ", "", "fortnightly"] }, { company: "Halter", storyId: "S2", results: [] }, { company: "", storyId: "S1" }],
    });
    expect(out).toEqual({
      narrative: { proofPoints: [{ name: "Release train", heroMetric: "9 teams" }] },
      stories: [{ id: "S1", title: "Release train", provenance: "verified" }],
      snapshots: [{ company: "Tracksuit", storyId: "S1", results: ["monthly", "fortnightly"] }, { company: "Halter" }],
    });
    expect(cleanStoryBank({ proofPoints: [], stories: [], snapshots: [] })).toEqual({ narrative: { proofPoints: [] }, stories: [], snapshots: [] });
  });
});
