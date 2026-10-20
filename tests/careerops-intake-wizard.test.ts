import { describe, it, expect } from "vitest";
import {
  DEFAULT_STEP,
  WIZARD_STEPS,
  findWizardStep,
  firstUnfinishedStep,
  nextWizardStep,
  parseWizardStep,
  prevWizardStep,
  wizardProgress,
  wizardStates,
  wizardStepIndex,
  type WizardSignals,
} from "@/lib/careerops/intake-wizard";

const empty: WizardSignals = { hasCv: false, goalRole: null, companies: 0 };
const full: WizardSignals = {
  hasCv: true,
  goalRole: "Senior Product Owner",
  companies: 2,
  contact: { title: "t", phone: "p", linkedin: "l", github: "g", portfolio: "x" },
  policy: { minimumSalary: "1", visaStatus: "v" },
  personalization: {
    targetRoles: [{ archetype: "A" }], adaptiveFraming: [{ role: "r", emphasize: "e" }],
    exitNarrative: "x", crossCuttingAdvantage: "y", portfolio: { url: "https://x.dev" },
    compTargets: "c", negotiationScripts: ["s"], locationPolicy: ["l"],
  },
};

describe("intake wizard — the tabs", () => {
  it("has six, CV first and review last", () => {
    expect(WIZARD_STEPS.map((s) => s.key)).toEqual(["cv", "northstar", "watchlist", "contact", "targeting", "review"]);
  });

  it("marks the three the portal cannot work without", () => {
    expect(WIZARD_STEPS.filter((s) => s.required).map((s) => s.key)).toEqual(["cv", "northstar", "watchlist"]);
  });

  it("gives every tab a short label and a longer panel title", () => {
    for (const s of WIZARD_STEPS) {
      expect(s.label.length).toBeLessThanOrEqual(12); // six share a row
      expect(s.title.length).toBeGreaterThan(s.label.length);
    }
  });
});

describe("intake wizard — reading the step out of the URL", () => {
  it("takes a known step", () => {
    expect(parseWizardStep("targeting")).toBe("targeting");
    expect(parseWizardStep("review")).toBe("review");
  });

  it("falls back to the first step for anything else", () => {
    for (const raw of [null, undefined, "", "nope", "CV", "../etc/passwd", "__proto__"]) {
      expect(parseWizardStep(raw)).toBe(DEFAULT_STEP);
    }
    expect(DEFAULT_STEP).toBe("cv");
  });

  it("looks a step up by key", () => {
    expect(findWizardStep("contact")?.title).toMatch(/Contact details/);
    expect(findWizardStep("nope")).toBeUndefined();
    expect(wizardStepIndex("watchlist")).toBe(2);
  });
});

describe("intake wizard — moving between tabs", () => {
  it("walks forward and back", () => {
    expect(nextWizardStep("cv")).toBe("northstar");
    expect(prevWizardStep("northstar")).toBe("cv");
    expect(nextWizardStep("targeting")).toBe("review");
  });

  it("stops at both ends rather than wrapping", () => {
    expect(prevWizardStep("cv")).toBeNull();
    expect(nextWizardStep("review")).toBeNull();
  });

  it("can walk the whole way with next, visiting every tab once", () => {
    const seen: string[] = [DEFAULT_STEP];
    let cur = nextWizardStep(DEFAULT_STEP);
    while (cur) { seen.push(cur); cur = nextWizardStep(cur); }
    expect(seen).toEqual(WIZARD_STEPS.map((s) => s.key));
  });
});

describe("intake wizard — per-tab state", () => {
  it("is empty across the board for a brand-new member, except review", () => {
    const s = wizardStates(empty);
    expect(s).toEqual({ cv: "empty", northstar: "empty", watchlist: "empty", contact: "empty", targeting: "empty", review: "done" });
  });

  it("is done across the board once everything is filled in", () => {
    const s = wizardStates(full);
    expect(Object.values(s).every((v) => v === "done")).toBe(true);
  });

  it("does not accept a blank North Star role", () => {
    expect(wizardStates({ ...empty, goalRole: "   " }).northstar).toBe("empty");
  });

  it("calls a half-filled optional tab partial, not done", () => {
    expect(wizardStates({ ...empty, contact: { phone: "p" } }).contact).toBe("partial");
    expect(wizardStates({ ...empty, personalization: { exitNarrative: "x" } }).targeting).toBe("partial");
    // …and only "done" at the full set
    expect(wizardStates({ ...empty, personalization: { ...full.personalization } }).targeting).toBe("done");
  });

  it("counts contact and logistics together, since they share a tab", () => {
    expect(wizardStates({ ...empty, contact: { phone: "p", linkedin: "l" }, policy: { minimumSalary: "1" } }).contact).toBe("partial");
    expect(wizardStates({ ...empty, contact: { phone: "p", linkedin: "l", github: "g" }, policy: { minimumSalary: "1", visaStatus: "v" } }).contact).toBe("done");
  });

  it("ignores blanks and empty lists when counting", () => {
    expect(wizardStates({ ...empty, contact: { phone: "", linkedin: undefined }, policy: { authorizedIn: [] } }).contact).toBe("empty");
  });
});

describe("intake wizard — progress", () => {
  it("counts the required tabs only, so an optional one cannot stall it", () => {
    expect(wizardProgress(wizardStates(full))).toEqual({ done: 3, total: 3, pct: 100 });
    expect(wizardProgress(wizardStates({ ...full, contact: null, personalization: null }))).toEqual({ done: 3, total: 3, pct: 100 });
    expect(wizardProgress(wizardStates(empty))).toEqual({ done: 0, total: 3, pct: 0 });
    expect(wizardProgress(wizardStates({ ...empty, hasCv: true }))).toEqual({ done: 1, total: 3, pct: 33 });
  });

  it("points at the first required tab that still needs something", () => {
    expect(firstUnfinishedStep(wizardStates(empty))).toBe("cv");
    expect(firstUnfinishedStep(wizardStates({ ...empty, hasCv: true }))).toBe("northstar");
    expect(firstUnfinishedStep(wizardStates({ ...full, companies: 0 }))).toBe("watchlist");
    expect(firstUnfinishedStep(wizardStates(full))).toBeNull();
  });

  it("does not send them to an optional tab, however empty it is", () => {
    expect(firstUnfinishedStep(wizardStates({ ...empty, hasCv: true, goalRole: "PO", companies: 1 }))).toBeNull();
  });
});
