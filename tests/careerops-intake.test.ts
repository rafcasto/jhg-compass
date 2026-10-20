import { describe, it, expect } from "vitest";
import {
  cvReadiness,
  effectiveGoal,
  hasGoalRole,
  otherGoalSource,
  resolveGoalSource,
  DEFAULT_GOAL_SOURCE,
  intakeComplete,
  intakeProgress,
  intakeSteps,
  isTextCvFile,
  nextIntakeStep,
  INTAKE_HREF,
} from "@/lib/careerops/intake";
import { INTAKE_HREF as NAV_INTAKE_HREF } from "@/lib/careerops/portal-nav";

const full = { hasCv: true, goalRole: "Product Owner", companies: 2, answers: 5 };

describe("CareerOps intake — CV readiness", () => {
  it("counts words and never reports a score on an empty CV", () => {
    const r = cvReadiness("");
    expect(r.words).toBe(0);
    expect(r.scoreable).toBe(false);
    expect(r.hint).toMatch(/very short/i);
  });

  it("is advisory: a thin CV gets a hint, not a hard failure", () => {
    const r = cvReadiness("Jane Smith. Product Owner in Auckland. Looking for work.");
    expect(r.scoreable).toBe(false);
    expect(r.hint).toBeTruthy();
    // The hint always tells them they can save anyway — intake must never gate.
    expect(r.hint).toMatch(/still save/i);
  });

  it("recognises an Experience heading", () => {
    const md = `# Jane Smith\n\n## Experience\n` + "led a squad delivering things ".repeat(30);
    const r = cvReadiness(md);
    expect(r.hasExperience).toBe(true);
    expect(r.scoreable).toBe(true);
    expect(r.hint).toBeUndefined();
  });

  it("recognises a tenure date range even with no headings", () => {
    const md = "Acme — Product Owner 2021–2025. " + "shipped the thing ".repeat(50);
    expect(cvReadiness(md).hasExperience).toBe(true);
    expect(cvReadiness("Acme — Product Owner 2021 - present").hasExperience).toBe(true);
  });

  it("recognises a Skills heading", () => {
    const md = "# Jane\n\n## Skills\n" + "jira sql figma ".repeat(40);
    const r = cvReadiness(md);
    expect(r.hasSkills).toBe(true);
    expect(r.scoreable).toBe(true);
  });

  it("accepts a long CV with no headings we know", () => {
    const r = cvReadiness("word ".repeat(220));
    expect(r.hasExperience).toBe(false);
    expect(r.hasSkills).toBe(false);
    expect(r.scoreable).toBe(true);
  });

  it("holds the 80-word floor: a short CV with a heading is still thin", () => {
    expect(cvReadiness("## Experience\n" + "word ".repeat(60)).scoreable).toBe(false);
    expect(cvReadiness("## Experience\n" + "word ".repeat(90)).scoreable).toBe(true);
  });
});

describe("CareerOps intake — readable files", () => {
  it("takes text and markdown, case-insensitively", () => {
    expect(isTextCvFile("cv.md")).toBe(true);
    expect(isTextCvFile("CV.MARKDOWN")).toBe(true);
    expect(isTextCvFile("resume.txt")).toBe(true);
  });
  it("rejects what the browser can't turn into text", () => {
    expect(isTextCvFile("cv.pdf")).toBe(false);
    expect(isTextCvFile("cv.docx")).toBe(false);
    expect(isTextCvFile("cv")).toBe(false);
    expect(isTextCvFile("cv.md.pdf")).toBe(false);
  });
});

describe("CareerOps intake — the checklist", () => {
  it("asks for the CV first, then the North Star, then the watchlist", () => {
    expect(intakeSteps(full).map((s) => s.key)).toEqual(["cv", "northstar", "watchlist", "answers"]);
  });

  it("treats standard answers as optional and the first three as required", () => {
    const steps = intakeSteps(full);
    expect(steps.filter((s) => !s.optional).map((s) => s.key)).toEqual(["cv", "northstar", "watchlist"]);
  });

  it("marks each step from its own signal", () => {
    const steps = intakeSteps({ hasCv: true, goalRole: null, companies: 0, answers: 0 });
    expect(steps.map((s) => s.done)).toEqual([true, false, false, false]);
  });

  it("does not accept a blank North Star role", () => {
    expect(intakeSteps({ ...full, goalRole: "   " })[1].done).toBe(false);
    expect(intakeSteps({ ...full, goalRole: undefined })[1].done).toBe(false);
  });

  it("names the target role back to the member once it is set", () => {
    expect(intakeSteps(full)[1].detail).toContain("Product Owner");
    expect(intakeSteps({ ...full, goalRole: null })[1].detail).toMatch(/role, industry, geography/i);
  });

  it("sends each step where it can actually be done", () => {
    const by = Object.fromEntries(intakeSteps(full).map((s) => [s.key, s.href]));
    expect(by.cv).toBe(INTAKE_HREF);
    expect(by.northstar).toBe("/compass");       // the North Star lives on the Compass tab
    expect(by.watchlist).toBe("/careerops/setup");
    expect(by.answers).toBe("/careerops/setup");
  });

  it("counts progress over the required steps only, so an optional one can't stall it", () => {
    expect(intakeProgress(intakeSteps(full))).toEqual({ done: 3, total: 3, pct: 100 });
    expect(intakeProgress(intakeSteps({ ...full, answers: 0 }))).toEqual({ done: 3, total: 3, pct: 100 });
    expect(intakeProgress(intakeSteps({ hasCv: true, goalRole: null, companies: 0, answers: 0 }))).toEqual({ done: 1, total: 3, pct: 33 });
    expect(intakeProgress(intakeSteps({ hasCv: false, goalRole: null, companies: 0, answers: 0 }))).toEqual({ done: 0, total: 3, pct: 0 });
  });

  it("is complete once the required steps are done, optional or not", () => {
    expect(intakeComplete(intakeSteps(full))).toBe(true);
    expect(intakeComplete(intakeSteps({ ...full, answers: 0 }))).toBe(true);
    expect(intakeComplete(intakeSteps({ ...full, companies: 0 }))).toBe(false);
  });

  it("points at the next required step, falling back to the optional one", () => {
    expect(nextIntakeStep(intakeSteps({ hasCv: false, goalRole: "PO", companies: 1, answers: 1 }))?.key).toBe("cv");
    expect(nextIntakeStep(intakeSteps({ ...full, companies: 0 }))?.key).toBe("watchlist");
    expect(nextIntakeStep(intakeSteps({ ...full, answers: 0 }))?.key).toBe("answers");
    expect(nextIntakeStep(intakeSteps(full))).toBeNull();
  });
});

describe("CareerOps intake — routing", () => {
  it("is one route, exported from both modules", () => {
    expect(INTAKE_HREF).toBe("/careerops/intake");
    expect(NAV_INTAKE_HREF).toBe(INTAKE_HREF);
  });
});

describe("CareerOps intake — which North Star is in effect", () => {
  const compass = { role: "Programme Manager", city: "Wellington" };
  const intake = { role: "Senior Product Owner", subsector: "climate-tech", city: "Auckland" };

  it("defaults to Compass, and only an explicit \"intake\" changes that", () => {
    expect(DEFAULT_GOAL_SOURCE).toBe("compass");
    expect(resolveGoalSource(undefined)).toBe("compass");
    expect(resolveGoalSource(null)).toBe("compass");
    expect(resolveGoalSource("compass")).toBe("compass");
    expect(resolveGoalSource("Intake")).toBe("compass"); // not a loose match
    expect(resolveGoalSource("")).toBe("compass");
    expect(resolveGoalSource("intake")).toBe("intake");
  });

  it("leaves a member who predates the choice on their Compass goal", () => {
    const r = effectiveGoal({ source: undefined, compassGoal: compass, intakeGoal: undefined });
    expect(r).toEqual({ source: "compass", goal: compass, overriding: false, fellBack: false });
  });

  it("lets intake override Compass once it names a role", () => {
    const r = effectiveGoal({ source: "intake", compassGoal: compass, intakeGoal: intake });
    expect(r.source).toBe("intake");
    expect(r.goal).toEqual(intake);
    expect(r.overriding).toBe(true);
    expect(r.fellBack).toBe(false);
  });

  it("does not strand the agents when intake is chosen but blank", () => {
    for (const blank of [undefined, null, {}, { role: "" }, { role: "   " }, { city: "Auckland" }]) {
      const r = effectiveGoal({ source: "intake", compassGoal: compass, intakeGoal: blank });
      expect(r.source).toBe("compass");
      expect(r.goal).toEqual(compass);
      expect(r.overriding).toBe(false);
      expect(r.fellBack).toBe(true);
    }
  });

  it("switching back to Compass restores it untouched — neither goal is destroyed", () => {
    const back = effectiveGoal({ source: "compass", compassGoal: compass, intakeGoal: intake });
    expect(back.goal).toEqual(compass);
    expect(back.overriding).toBe(false);
    // and forward again, with the intake goal still intact
    expect(effectiveGoal({ source: "intake", compassGoal: compass, intakeGoal: intake }).goal).toEqual(intake);
  });

  it("never hands back null, so callers can read .role safely", () => {
    expect(effectiveGoal({ source: "compass", compassGoal: null, intakeGoal: null }).goal).toEqual({});
    expect(effectiveGoal({ source: "intake", compassGoal: undefined, intakeGoal: undefined }).goal).toEqual({});
  });

  it("knows a goal is only usable once it names a role", () => {
    expect(hasGoalRole({ role: "PO" })).toBe(true);
    expect(hasGoalRole({ role: " " })).toBe(false);
    expect(hasGoalRole({ city: "Auckland" })).toBe(false);
    expect(hasGoalRole(null)).toBe(false);
  });

  it("offers the other source for the switch control", () => {
    expect(otherGoalSource("compass")).toBe("intake");
    expect(otherGoalSource("intake")).toBe("compass");
  });
});

describe("CareerOps intake — the checklist follows the source in effect", () => {
  it("sends them to the Compass tab when Compass owns the goal", () => {
    const step = intakeSteps({ hasCv: true, goalRole: "Programme Manager", goalSource: "compass", companies: 1, answers: 0 })[1];
    expect(step.href).toBe("/compass");
    expect(step.detail).toMatch(/Change it any time on the Compass tab/);
  });

  it("sends them back to intake when intake owns the goal, and says it overrides", () => {
    const step = intakeSteps({ hasCv: true, goalRole: "Senior Product Owner", goalSource: "intake", companies: 1, answers: 0 })[1];
    expect(step.href).toBe(INTAKE_HREF);
    expect(step.detail).toMatch(/overrides your Compass goal/);
    expect(step.detail).toContain("Senior Product Owner");
  });

  it("counts the step done from the effective role, whatever the source", () => {
    expect(intakeSteps({ hasCv: true, goalRole: "PO", goalSource: "intake", companies: 1, answers: 0 })[1].done).toBe(true);
    expect(intakeSteps({ hasCv: true, goalRole: null, goalSource: "intake", companies: 1, answers: 0 })[1].done).toBe(false);
  });
});
