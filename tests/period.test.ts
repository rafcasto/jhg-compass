import { describe, it, expect } from "vitest";
import { scaleTarget, toWeekly, displayTarget, isWorkday, WORKDAYS_PER_WEEK } from "@/lib/period";

const jan = new Date(2026, 0, 15); // 31-day month
const feb = new Date(2026, 1, 15); // 28-day month

describe("weekly <-> period target conversion (5-workday week)", () => {
  it("a week is 5 workdays", () => {
    expect(WORKDAYS_PER_WEEK).toBe(5);
  });

  it("day: weekly / 5, rounded", () => {
    expect(scaleTarget(5, "day", jan)).toBe(1);
    expect(scaleTarget(8, "day", jan)).toBe(2);   // was 1 under a 7-day split
    expect(scaleTarget(3, "day", jan)).toBe(1);   // was 0 under a 7-day split
    expect(scaleTarget(2, "day", jan)).toBe(0);
    expect(scaleTarget(20, "day", jan)).toBe(4);
  });

  it("day: entered * 5 back to weekly", () => {
    expect(toWeekly(1, "day", jan)).toBe(5);
    expect(toWeekly(4, "day", jan)).toBe(20);
    expect(toWeekly(-3, "day", jan)).toBe(0);
  });

  it("week: identity", () => {
    expect(scaleTarget(8, "week", jan)).toBe(8);
    expect(toWeekly(8, "week", jan)).toBe(8);
  });

  it("month: still calendar-based (weeks in the month)", () => {
    expect(scaleTarget(7, "month", jan)).toBe(31);
    expect(scaleTarget(7, "month", feb)).toBe(28);
    expect(toWeekly(31, "month", jan)).toBe(7);
  });

  it("day round-trips for whole daily values", () => {
    for (const d of [0, 1, 2, 3, 10]) expect(scaleTarget(toWeekly(d, "day", jan), "day", jan)).toBe(d);
  });
});

describe("displayTarget — what the TARGET cell shows (never 0 for a row that has one)", () => {
  const wed = new Date(2026, 0, 14);
  const sat = new Date(2026, 0, 17);

  it("week: the stored figure, not derived", () => {
    expect(displayTarget(5, "week", wed)).toEqual({ value: 5, unit: "week", derived: false });
  });
  it("day, workday, ≥ 5 / wk: the daily share, derived", () => {
    expect(displayTarget(5, "day", wed)).toEqual({ value: 1, unit: "day", derived: true });
    expect(displayTarget(8, "day", wed)).toEqual({ value: 2, unit: "day", derived: true });
  });
  it("day, < 5 / wk: the weekly figure with its unit (was 0)", () => {
    expect(displayTarget(1, "day", wed)).toEqual({ value: 1, unit: "week", derived: false });
    expect(displayTarget(2, "day", wed)).toEqual({ value: 2, unit: "week", derived: false });
    expect(displayTarget(3, "day", wed)).toEqual({ value: 3, unit: "week", derived: false });
  });
  it("day, weekend: no daily share — the weekly figure", () => {
    expect(displayTarget(8, "day", sat)).toEqual({ value: 8, unit: "week", derived: false });
    expect(isWorkday(sat)).toBe(false);
    expect(isWorkday(wed)).toBe(true);
  });
  it("month: calendar-scaled, derived", () => {
    expect(displayTarget(7, "month", jan)).toEqual({ value: 31, unit: "month", derived: true });
  });
  it("no target stays 0", () => {
    expect(displayTarget(0, "day", wed).value).toBe(0);
  });
});
