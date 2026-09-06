import { describe, it, expect } from "vitest";
import { resolveWeeklyTarget, withTargetEdits } from "@/lib/targets";
import { mergeContent, weeklyTargetsFrom, DEFAULT_ACTIVITIES } from "@/lib/content";
import { DEFAULT_WEEKLY_TARGETS } from "@/lib/categories";

describe("resolveWeeklyTarget — the one rule shared by Performance and onboarding", () => {
  const defaults = { outreach_cold: 8, thank_you: 3 };

  it("user override wins over the admin default", () => {
    expect(resolveWeeklyTarget("outreach_cold", { outreach_cold: 20 }, defaults)).toBe(20);
  });
  it("an explicit user 0 is respected (not treated as unset)", () => {
    expect(resolveWeeklyTarget("outreach_cold", { outreach_cold: 0 }, defaults)).toBe(0);
  });
  it("falls back to the admin default when the user has not set one", () => {
    expect(resolveWeeklyTarget("outreach_cold", {}, defaults)).toBe(8);
  });
  it("falls back to 0 when neither exists (e.g. a brand-new admin activity)", () => {
    expect(resolveWeeklyTarget("new_activity", {}, defaults)).toBe(0);
  });
});

describe("withTargetEdits", () => {
  it("layers edits over existing overrides without touching other rows", () => {
    expect(withTargetEdits({ a: 1, b: 2 }, { b: 5, c: 7 })).toEqual({ a: 1, b: 5, c: 7 });
  });
  it("never copies admin defaults in — only what was passed", () => {
    expect(withTargetEdits({}, { b: 5 })).toEqual({ b: 5 });
  });
});

describe("admin defaults flow from config/content into weeklyTargets", () => {
  it("uses the code defaults when nothing is stored", () => {
    expect(weeklyTargetsFrom(mergeContent(null))).toEqual(DEFAULT_WEEKLY_TARGETS);
  });
  it("reflects admin-edited defaultWeekly values (the onboarding bug)", () => {
    const stored = {
      activities: DEFAULT_ACTIVITIES.map((a) => (a.id === "outreach_cold" ? { ...a, defaultWeekly: 21 } : a)),
    };
    const wk = weeklyTargetsFrom(mergeContent(stored));
    expect(wk.outreach_cold).toBe(21);
    expect(wk.thank_you).toBe(DEFAULT_WEEKLY_TARGETS.thank_you);
    // and the shared resolver hands that straight to the UI for an untouched user
    expect(resolveWeeklyTarget("outreach_cold", {}, wk)).toBe(21);
  });
});
