import { describe, it, expect } from "vitest";
import { addEntry, emptyMonth, readMonth, usageKey } from "@/lib/engine/usage";
import { monthKey, nextMonthStart } from "@/lib/engine/keys";
import { DEFAULT_ENGINE_CONFIG, quotaCheck, quotaLine } from "@/lib/engine/config";

const call = (key: string, usd: number, model = "claude-opus-5-5") => ({ kind: "coach" as const, key, model, usage: { input: 100, output: 50, cacheRead: 1000, cacheWrite: 0, searches: 0 }, estimatedUsd: usd });

describe("the monthly meter", () => {
  it("buckets by UTC month and knows when a month resets", () => {
    expect(monthKey(Date.UTC(2026, 10, 10))).toBe("2026-11");
    expect(nextMonthStart(Date.UTC(2026, 10, 10)).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(nextMonthStart(Date.UTC(2026, 11, 31)).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("adds a call to the month, to its coach or job, and to its model", () => {
    const m0 = emptyMonth("2026-11", 1);
    const m1 = addEntry(m0, call("narrative", 0.1), 2);
    const m2 = addEntry(m1, call("narrative", 0.2), 3);
    const m3 = addEntry(m2, { ...call("evaluate", 0.05, "claude-sonnet-5-5"), kind: "job" }, 4);
    expect(m3.turns).toBe(3);
    expect(m3.estimatedUsd).toBeCloseTo(0.35, 6);
    expect(m3.input).toBe(300);
    expect(m3.cacheRead).toBe(3000);
    expect(m3.by[usageKey("coach", "narrative")]).toMatchObject({ turns: 2, estimatedUsd: 0.3 });
    expect(m3.by[usageKey("job", "evaluate")]).toMatchObject({ turns: 1, estimatedUsd: 0.05 });
    expect(m3.byModel["claude-opus-5-5"].turns).toBe(2);
    expect(m3.byModel["claude-sonnet-5-5"].turns).toBe(1);
    expect(m3.updatedAt).toBe(4);
    expect(m0.turns).toBe(0); // never mutated
  });

  it("reads a partial or missing document as a whole month", () => {
    expect(readMonth(null, "2026-11")).toMatchObject({ month: "2026-11", turns: 0, estimatedUsd: 0, by: {}, byModel: {} });
    const r = readMonth({ turns: 2, estimatedUsd: 0.5, by: { "coach:narrative": { turns: 2, estimatedUsd: 0.5 } as never } }, "2026-11");
    expect(r.by["coach:narrative"]).toMatchObject({ turns: 2, estimatedUsd: 0.5, input: 0, searches: 0 });
  });
});

describe("the monthly limit", () => {
  const month = (turns: number, usd: number) => ({ ...emptyMonth("2026-11"), turns, estimatedUsd: usd });

  it("is off by default — 0 means no limit", () => {
    expect(quotaCheck(month(10_000, 999), DEFAULT_ENGINE_CONFIG)).toEqual({ over: false });
    expect(quotaCheck(null, DEFAULT_ENGINE_CONFIG)).toEqual({ over: false });
  });

  it("trips on the budget, then on the calls, and says when it resets", () => {
    const now = Date.UTC(2026, 10, 10);
    const q = quotaCheck(month(5, 20), { monthlyBudgetUsd: 20, monthlyTurnQuota: 0 }, now);
    expect(q).toMatchObject({ over: true, reason: "budget" });
    expect(quotaLine(q)).toBe("You've used this month's coaching time. It resets on 1 December.");
    expect(quotaCheck(month(5, 19.99), { monthlyBudgetUsd: 20, monthlyTurnQuota: 0 }, now)).toEqual({ over: false });
    expect(quotaCheck(month(300, 1), { monthlyBudgetUsd: 0, monthlyTurnQuota: 300 }, now)).toMatchObject({ over: true, reason: "turns" });
    expect(quotaLine({ over: false })).toBeNull();
  });
});
