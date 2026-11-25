import { describe, it, expect } from "vitest";
import { deriveTrueNorth, derivePay, derivePlace, notesBlock } from "@/lib/engine/coach/derive-true-north";
import { coachChecks } from "@/lib/engine/coach/checks";
import type { ProfileFile } from "@/lib/careerops/profile-file";
import type { JhgTrueNorth } from "@/lib/careerops/types";

// The North Star by code: the prompt's "Derived" rules run on every True North write, so T1 · T2 · T4 · T5 · T6 pass by
// construction and the model never writes goal · policy · personalization · watchlist · notes.

const boundaries = {
  currency: "NZD", salaryLower: "140,000", salaryUpper: "170,000", salaryFloor: "130,000",
  authorizedIn: ["New Zealand"], needsSponsorship: "N", visaStatus: "NZ citizen",
  willWorkIn: "Auckland", exclude: "Hamilton", remote: "yes", localHybrid: "3 days", relocate: "no", remoteTravel: "a week a quarter",
  hardNos: ["on-call weekends"], cultureMustHaves: ["clear decision rights"], deprioritizeIfAbsent: "Y", softDislikes: ["open plan"],
  noticePeriodDays: 28, excludeLevels: ["Junior"], neverApply: ["Acme"], negotiationLines: ["My range is 140 to 170"],
};
const tn: JhgTrueNorth = {
  boundaries,
  titles: { target: ["Delivery Lead"], analog: ["Head of Delivery"], exclude: ["Scrum Master"] },
  clusters: [
    { name: "Ship on time", titles: ["Delivery Lead", "Head of Delivery"], axes: ["agile delivery", "release management"], buys: "Predictable releases", level: "Senior", fit: "primary" },
    { name: "Fix the process", titles: ["Programme Manager"], axes: ["stakeholder management"], buys: "Order", level: "Lead", fit: "secondary" },
  ],
  industries: [{ name: "Logistics software", subSectors: [{ name: "Fleet SaaS", growthSignal: "+18% 2026", source: "https://x.y/z", outlook: "sunrise", confirmed: "Y" }] }],
  companyType: "scaleup",
};

describe("deriveTrueNorth", () => {
  it("derives nothing from nothing, and only what has inputs", () => {
    expect(deriveTrueNorth(undefined, undefined)).toEqual({});
    expect(deriveTrueNorth({}, {})).toEqual({});
    expect(derivePay({ currency: "NZD" })).toEqual({});
    expect(derivePlace({})).toEqual({});
    expect(notesBlock({})).toBe("");
    const pay = deriveTrueNorth({ boundaries: { currency: "NZD", salaryLower: "1", salaryUpper: "2", salaryFloor: "1" } }, undefined);
    expect(pay.goal).toEqual({ salary: "NZD 1–2" });
    expect(pay.watchlist).toBeUndefined();
    expect(pay.notes).toBeUndefined();
  });

  it("writes the whole North Star by the prompt's rules", () => {
    const d = deriveTrueNorth(tn, { location: "Auckland, New Zealand" });
    expect(d.goal).toEqual({ salary: "NZD 140,000–170,000", role: "Senior Delivery Lead", seniority: "Senior", subsector: "Fleet SaaS", companyType: "scaleup", city: "Auckland, New Zealand" });
    expect(d.policy).toEqual({ minimumSalary: "NZD 130,000", locationFlexibility: "Remote: yes; Local hybrid: 3 days; Relocate: no", visaStatus: "NZ citizen", authorizedIn: ["New Zealand"], needsSponsorship: false });
    expect(d.personalization).toEqual({
      compTargets: "Target NZD 140,000–170,000; floor NZD 130,000.",
      locationPolicy: ["Will work in: Auckland", "Exclude: Hamilton", "Remote: yes", "Local hybrid: 3 days", "Relocate: no", "Travel for a remote role elsewhere: a week a quarter"],
      negotiationScripts: ["My range is 140 to 170"],
      targetRoles: [{ archetype: "Delivery Lead", axes: "agile delivery, release management; Ship on time", buys: "Predictable releases" }, { archetype: "Programme Manager", axes: "stakeholder management; Fix the process", buys: "Order" }],
    });
    expect(d.watchlist).toEqual({ positive: ["Delivery Lead"], negative: ["Scrum Master", "Junior"] });
    expect(d.notes?.split("\n")).toEqual([
      "Hard no's (do not apply): on-call weekends",
      "Culture must-haves: clear decision rights; deprioritise when absent: Y",
      "Soft dislikes (lower, not a no): open plan",
      "Notice period: 28 days",
      "Never apply: Acme",
    ]);
  });

  it("keeps the caps and a cluster without a level", () => {
    const d = deriveTrueNorth({ clusters: [{ name: "X".repeat(300), titles: ["T".repeat(100)], axes: ["a".repeat(300)], buys: "b".repeat(300), fit: "primary" }] }, undefined);
    expect(d.goal).toEqual({ role: "T".repeat(100) });
    expect(d.personalization!.targetRoles).toEqual([{ archetype: "T".repeat(80), axes: expect.stringMatching(/^a{200}$/), buys: "b".repeat(200) }]);
  });

  it("makes the True North checks that read the derived keys pass by construction", () => {
    const d = deriveTrueNorth(tn, { location: "Auckland, New Zealand" });
    const postings = Array.from({ length: 15 }, (_, i) => ({ title: "Delivery Lead", url: `https://jobs.x/${i}` }));
    const p: ProfileFile = { version: 1, goal: d.goal, policy: d.policy, personalization: d.personalization, watchlist: { companies: [], ...d.watchlist! }, notes: d.notes, jhg: { trueNorth: { ...tn, postings } } };
    expect(coachChecks("trueNorth", p).filter((c) => !c.pass).map((c) => c.id)).toEqual([]);
  });
});
