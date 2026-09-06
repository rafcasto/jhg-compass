import { describe, it, expect } from "vitest";
import { scaleTarget, toWeekly, WORKDAYS_PER_WEEK } from "@/lib/period";

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
