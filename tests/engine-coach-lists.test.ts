import { describe, it, expect } from "vitest";
import { deriveCompanyLists } from "@/lib/engine/coach/lists";
import type { JhgTargetCompanies } from "@/lib/careerops/types";

// The page's lists are derived by code from the coach's working material on every write (decision 2026-11-17): Part A's forty
// show on Top 40 as they land, the Top 10 and Top 3 once those keys exist. Nothing the model sends for companyLists survives.

const tc: JhgTargetCompanies = {
  companies: [
    { rank: 2, name: "Halter", industry: "Agritech", subSector: "Farm software", outlook: "sunrise", companyType: "scaleup", careersUrl: "https://jobs.lever.co/halter", careersUrlStatus: "opened_by_coach", scores: { growth: 5, interest: 4, access: 5, proof: 3, total: 17 } },
    { rank: 1, name: "Xero", industry: "Fintech", subSector: "Accounting software", outlook: "sunset", careersUrlStatus: "none", scores: { growth: 4, interest: 5, access: 5, proof: 4, total: 18 } },
    { name: "Tracksuit", industry: "Martech", outlook: "" },
  ],
};

describe("deriveCompanyLists", () => {
  it("builds the Top 40 from the companies as they stand — rank order, unranked rows after, split by outlook, careers page only when opened", () => {
    const lists = deriveCompanyLists(tc, undefined)!;
    expect(lists.all?.sunrise).toEqual([{ rank: 2, name: "Halter", industry: "Agritech", subSector: "Farm software", companyType: "scaleup", careersUrl: "https://jobs.lever.co/halter", careersUrlStatus: "opened_by_coach", scores: { growth: 5, interest: 4, access: 5, proof: 3, total: 17 } }]);
    expect(lists.all?.sunset).toEqual([{ rank: 1, name: "Xero", industry: "Fintech", subSector: "Accounting software", careersUrlStatus: "none", scores: { growth: 4, interest: 5, access: 5, proof: 4, total: 18 } }]);
    expect(lists.all?.unclassified).toEqual([{ rank: 3, name: "Tracksuit", industry: "Martech" }]);
    expect(lists.top10).toBeUndefined();
    expect(lists.top3).toBeUndefined();
  });
  it("adds the Top 10 once written — its ranks and careers pages over the company's row — and the Top 3 from it", () => {
    const withTop = { ...tc, top10: [{ rank: 1, name: "Xero", careersUrl: "https://www.xero.com/careers/", careersUrlStatus: "confirmed" }, { rank: 2, name: "Halter", careersUrlStatus: "none" }], top3: [{ name: "Halter", firstMove: "x" }] } as JhgTargetCompanies;
    const lists = deriveCompanyLists(withTop, undefined)!;
    expect(lists.top10?.sunset?.[0]).toMatchObject({ rank: 1, name: "Xero", careersUrl: "https://www.xero.com/careers/", careersUrlStatus: "confirmed", industry: "Fintech" });
    expect(lists.top10?.sunrise?.[0]).toMatchObject({ rank: 2, name: "Halter", careersUrlStatus: "none" });
    expect(lists.top10?.sunrise?.[0].careersUrl).toBeUndefined();
    expect(lists.top3?.sunrise).toEqual([expect.objectContaining({ rank: 2, name: "Halter" })]);
    expect(lists.top3?.sunset).toBeUndefined();
  });
  it("leaves the stored lists alone when there is nothing to derive, and keeps a stored Top 10 while only the companies change", () => {
    const current = { all: { sunrise: [{ rank: 1, name: "Old" }] }, top10: { sunrise: [{ rank: 1, name: "Old" }] } };
    expect(deriveCompanyLists(undefined, current)).toBe(current);
    expect(deriveCompanyLists({ companies: [] }, current)).toBe(current);
    const lists = deriveCompanyLists(tc, current)!;
    expect(lists.all?.sunrise?.[0].name).toBe("Halter");
    expect(lists.top10).toBe(current.top10);
  });
});
