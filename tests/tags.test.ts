import { describe, it, expect } from "vitest";
import { EVENT_DEFAULTS, EVENT_KEYS, PIRATE_STAGES, isEventStage } from "@/lib/tags";

describe("event registry (AAARRR)", () => {
  it("covers the six pirate-metrics stages in funnel order", () => {
    expect(PIRATE_STAGES.map((s) => s.key)).toEqual(["awareness", "acquisition", "activation", "retention", "revenue", "referral"]);
  });
  it("every default event sits in a known stage", () => {
    for (const k of EVENT_KEYS) expect(isEventStage(EVENT_DEFAULTS[k].stage)).toBe(true);
  });
  it("rejects legacy / unknown stage strings", () => {
    expect(isEventStage("acquisition")).toBe(true);
    expect(isEventStage("onboarding")).toBe(false);
    expect(isEventStage(null)).toBe(false);
  });
  it("quiz completion is acquisition and registration is activation", () => {
    expect(EVENT_DEFAULTS.QUIZ_COMPLETE.stage).toBe("acquisition");
    expect(EVENT_DEFAULTS.REGISTRATION.stage).toBe("activation");
  });
});
