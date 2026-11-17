import { describe, it, expect } from "vitest";
import { researchDue } from "@/lib/engine/coach/research-due";
import { contextNote } from "@/lib/engine/coach/turn";

// The operator names the step's job every turn until it has run — so a conversation that started before the job existed
// stops following its own precedent of searching in the turn.

const forty = Array.from({ length: 40 }, (_, i) => ({ name: `Co ${i}` }));

describe("researchDue", () => {
  it("names the companies job for Coach 3 while the 40 are not on the page and no job is running", () => {
    const d = researchDue("targetCompanies", { targetCompanies: { companies: [] } }, [], 1000);
    expect(d?.kind).toBe("companies");
    expect(d?.line).toContain('run_research with kind "companies"');
    expect(d?.line).toContain("do not repeat it");
    expect(researchDue("targetCompanies", { targetCompanies: { companies: forty.slice(0, 12) } }, [], 1000)?.line).toContain("12 companies are on the page; the rest come");
    expect(researchDue("targetCompanies", { targetCompanies: { companies: forty } }, [], 1000)).toBeNull();
    expect(researchDue("targetCompanies", undefined, [{ type: "companies", status: "running" }], 1000)).toBeNull();
    expect(researchDue("targetCompanies", undefined, [{ type: "companies", status: "queued" }], 1000)).toBeNull();
  });
  it("softens once the job ran in this conversation: additions go through run_research with names[]", () => {
    const d = researchDue("targetCompanies", { targetCompanies: { companies: forty.slice(0, 31) } }, [{ type: "companies", status: "done", createdAt: 2000, result: { count: 31, added: 31 } }], 1000);
    expect(d?.line).toContain("31 on the page now");
    expect(d?.line).toContain("names[]");
    // A job from an earlier conversation does not count as this one's.
    expect(researchDue("targetCompanies", { targetCompanies: { companies: [] } }, [{ type: "companies", status: "done", createdAt: 500 }], 1000)?.line).toContain("Part A is the portal's");
  });
  it("names the postings job for Coach 2 once Part A is written and the postings are missing", () => {
    expect(researchDue("trueNorth", { trueNorth: {} }, [], 1000)).toBeNull();
    const d = researchDue("trueNorth", { trueNorth: { boundaries: { currency: "NZD" } } }, [], 1000);
    expect(d?.kind).toBe("postings");
    expect(d?.line).toContain('run_research with kind "postings"');
    expect(researchDue("trueNorth", { trueNorth: { boundaries: { currency: "NZD" }, postings: Array.from({ length: 15 }, () => ({ title: "PM" })) } }, [], 1000)).toBeNull();
    expect(researchDue("trueNorth", { trueNorth: { boundaries: { currency: "NZD" }, postings: [{ title: "PM" }] } }, [{ type: "postings", status: "done", createdAt: 1500, result: { count: 1 } }], 1000)?.line).toContain("1 on the page now");
  });
  it("says nothing for the coaches without a job, and rides the operator note", () => {
    expect(researchDue("narrative", undefined, [], 0)).toBeNull();
    expect(researchDue("storyBank", undefined, [], 0)).toBeNull();
    expect(contextNote({ page: "companies", researchDue: "Part A is the portal's." })).toBe("The member is looking at Target companies.\n\nPart A is the portal's.");
    expect(contextNote({ page: null, researchDue: null })).toBeNull();
  });
});

// A job that added nothing (no key, no region, an API error) has not run the step: the nudge stays strong.
describe("researchDue — a job that produced nothing", () => {
  it("keeps naming the companies job after a run that added zero, softens only after one that added companies", () => {
    const zero = [{ type: "companies", status: "done", createdAt: 2000, result: { count: 3, added: 0 } }];
    expect(researchDue("targetCompanies", { targetCompanies: { companies: [{ name: "A" }, { name: "B" }, { name: "C" }] } }, zero, 1000)?.line).toContain("Part A is the portal's");
    const some = [{ type: "companies", status: "done", createdAt: 2000, result: { count: 31, added: 28 } }];
    expect(researchDue("targetCompanies", { targetCompanies: { companies: Array.from({ length: 31 }, (_, i) => ({ name: `C${i}` })) } }, some, 1000)?.line).toContain("31 on the page now");
    const noResult = [{ type: "companies", status: "done", createdAt: 2000 }];
    expect(researchDue("targetCompanies", { targetCompanies: { companies: [] } }, noResult, 1000)?.line).toContain("Part A is the portal's");
  });
});
