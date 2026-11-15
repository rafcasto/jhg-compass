import { describe, it, expect } from "vitest";
import { coachProgressLine, coachRailItems, coachRailRows } from "@/lib/engine/coach/rail";
import { coachStates } from "@/lib/engine/coach/keys";
import { flashKeysFor } from "@/components/coach/store";

// The rail of six (docs/UX_COACH_AGENTIC.md §5) and the live-write highlight (§6).

describe("the rail of six", () => {
  it("lists the six coaches under the menu's two headings, with the menu's words, linking to each page on the portal", () => {
    const items = coachRailItems("jobhacking");
    expect(items.map((i) => i.key)).toEqual(["narrative", "trueNorth", "targetCompanies", "storyBank", "masterCv", "linkedin"]);
    expect(items.map((i) => i.group?.label)).toEqual(["JobHacker Compass", "JobHacker Compass", "JobHacker Compass", "Artefacts", "Artefacts", "Artefacts"]);
    expect(items[5].label).toBe("LN");
    expect(items[1].href).toBe("/jobhacking/true-north");
    expect(coachRailItems("compass")[2].href).toBe("/settings/companies");
  });

  it("carries the state in the glyph and the gate in the summary — no fourth glyph for locked", () => {
    const states = coachStates({ narrative: { status: "complete" }, trueNorth: { status: "in_progress" } });
    const rows = coachRailRows(states);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.narrative).toMatchObject({ state: "done", summary: "Complete" });
    expect(by.narrative.count).toBeUndefined();
    expect(by.trueNorth).toMatchObject({ state: "partial", summary: "In progress · 2–3 hours", count: "2–3 hours" });
    expect(by.targetCompanies).toMatchObject({ state: "empty", summary: "After True North" });
    expect(by.targetCompanies.count).toBeUndefined();
    expect(by.storyBank.summary).toBe("After Target companies");
    expect(by.linkedin.summary).toBe("After Master CV");
    expect(coachProgressLine(states)).toBe("1 of 6 complete");
  });

  it("says on the Master CV row when CareerOps can run", () => {
    const all = coachStates({ narrative: { status: "complete" }, trueNorth: { status: "complete" }, targetCompanies: { status: "complete" }, storyBank: { status: "complete" } });
    expect(coachRailRows(all, { hasCv: false }).find((r) => r.key === "masterCv")).toMatchObject({ state: "empty", summary: "about 2 hours · CareerOps can run once your CV is in", count: "about 2 hours" });
    expect(coachRailRows(all, { hasCv: true }).find((r) => r.key === "masterCv")!.summary).toBe("about 2 hours · CareerOps can run from here");
    expect(coachProgressLine(coachStates(null))).toBe("0 of 6 complete");
  });
});

describe("the live-write highlight", () => {
  const sections = [{ key: "contact", label: "Contact details" }, { key: "headline", label: "Headline" }, { key: "story", label: "Bridge story" }] as const;
  it("lights the rows of this page the note names, keyed by the write's time", () => {
    const at = 1_000_000;
    expect(flashKeysFor({ labels: ["Headline", "Salary range"], at }, sections, at + 100)).toEqual({ keys: ["headline"], key: at });
    expect(flashKeysFor({ labels: ["Salary range"], at }, sections, at + 100)).toBeNull();
    expect(flashKeysFor(null, sections)).toBeNull();
  });
  it("does not replay a write older than two seconds on a page opened later", () => {
    expect(flashKeysFor({ labels: ["Headline"], at: 0 }, sections, 5000)).toBeNull();
  });
});
