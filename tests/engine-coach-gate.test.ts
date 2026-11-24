import { describe, it, expect } from "vitest";
import { allCoachesComplete, coachStates, findCoach, gateWords, missingBefore, skipGateWarning } from "@/lib/engine/coach/keys";
import { coachRailRows } from "@/lib/engine/coach/rail";
import { contextNote, gateSkippedNote } from "@/lib/engine/coach/turn";

// The gate is a default, not a wall (decision 2026-11-25, docs/UX_JOURNEY_JOBHACKING.md pain 9), and the
// hand-off at 6 of 6 is code's (Stage 8).

describe("the gate, skipped", () => {
  const c3 = findCoach("targetCompanies")!;

  it("names the gate's coaches as one phrase and carries the pedagogy in the warning", () => {
    const missing = missingBefore(c3, coachStates(null));
    expect(gateWords(missing)).toBe("Narrative and True North");
    expect(skipGateWarning(c3, missing)).toBe("Target companies works best after Narrative and True North — it'll ask you for what it needs.");
    expect(gateWords(missingBefore(c3, coachStates({ narrative: { status: "complete" } })))).toBe("True North");
  });

  it("tells the coach, as the operator, to ask for what the missing coaches would have written — never to send the member back", () => {
    const note = gateSkippedNote(["Narrative", "True North"]);
    expect(note).toContain("before Narrative and True North were complete");
    expect(note).toContain("do not send them back");
    expect(gateSkippedNote(["True North"])).toContain("True North was complete");
    expect(contextNote({ gateSkipped: ["True North"] })).toBe(gateSkippedNote(["True North"]));
    expect(contextNote({ gateSkipped: [] })).toBeNull();
  });

  it("reads a coach in progress as past its gate on the rail — In progress, not After …", () => {
    const rows = coachRailRows(coachStates({ targetCompanies: { status: "in_progress" } }));
    expect(rows.find((r) => r.key === "targetCompanies")).toMatchObject({ state: "partial", summary: "In progress · 3–4 hours" });
    expect(rows.find((r) => r.key === "storyBank")!.summary).toBe("After Target companies");
  });
});

describe("6 of 6", () => {
  it("is all six complete, no fewer", () => {
    const five = { narrative: { status: "complete" }, trueNorth: { status: "complete" }, targetCompanies: { status: "complete" }, storyBank: { status: "complete" }, masterCv: { status: "complete" } };
    expect(allCoachesComplete(coachStates(five))).toBe(false);
    expect(allCoachesComplete(coachStates({ ...five, linkedin: { status: "complete" } }))).toBe(true);
    expect(allCoachesComplete(coachStates({ ...five, linkedin: { status: "in_progress" } }))).toBe(false);
  });
});
