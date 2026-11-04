import { describe, it, expect } from "vitest";
import { COMPANY_LISTS, TRENDS, companyListLabel, companyTypeLabel, facets, industryLine, listCompanies, listCount, listGroups, listSummary } from "@/lib/jobhacking/company-lists";
import type { CompanyList } from "@/lib/careerops/types";

// JobHacking → Target companies → Top 3 · Top 10 · Top 40: how one Packer list
// becomes the groups, facet lines and row text the page shows.

const list: CompanyList = {
  sunset: [{ rank: 16, name: "Gumtree 16", industry: "HR tech", subSector: "On-premise HR suites", companyType: "established" }],
  sunrise: [
    { rank: 3, name: "Banksia Payroll", industry: "Fintech", subSector: "Embedded payments", companyType: "scaleup" },
    { rank: 1, name: "Wattle HR Cloud", industry: "HR tech", subSector: "Payroll compliance software", companyType: "scaleup", careersUrl: "https://boards.example/wattle" },
    { name: "Unranked Co", industry: "HR tech" },
    { rank: 2, name: "Coolabah Health Software", industry: "Health tech", subSector: "Clinic scheduling", companyType: "established" },
  ],
  unclassified: [{ rank: 13, name: "Gumtree 13", industry: "HR tech", companyType: "scaleup" }],
};

describe("company lists — labels", () => {
  it("names the three lists; `all` is shown as Top 40", () => {
    expect(COMPANY_LISTS.map((l) => [l.key, l.label])).toEqual([["top3", "Top 3"], ["top10", "Top 10"], ["all", "Top 40"]]);
    expect(companyListLabel("all")).toBe("Top 40");
    expect(TRENDS.map((t) => t.key)).toEqual(["sunrise", "sunset", "unclassified"]);
  });

  it("reads the Packer's company-type tokens as words, and leaves an unknown one capitalised", () => {
    expect(companyTypeLabel("scaleup")).toBe("Scale-up");
    expect(companyTypeLabel("Established")).toBe("Established");
    expect(companyTypeLabel("government")).toBe("Government");
    expect(companyTypeLabel("co-operative")).toBe("Co-operative");
    expect(companyTypeLabel("")).toBe("");
    expect(companyTypeLabel(undefined)).toBe("");
  });
});

describe("company lists — groups", () => {
  it("orders the groups sunrise → sunset → unclassified, drops empty ones, and sorts each by rank with unranked rows last", () => {
    const groups = listGroups(list);
    expect(groups.map((g) => g.label)).toEqual(["Sunrise", "Sunset", "Not yet classified"]);
    expect(groups[0].companies.map((c) => c.name)).toEqual(["Wattle HR Cloud", "Coolabah Health Software", "Banksia Payroll", "Unranked Co"]);
    expect(listGroups({ sunrise: [], sunset: [{ rank: 1, name: "X" }] }).map((g) => g.key)).toEqual(["sunset"]);
    expect(listGroups(undefined)).toEqual([]);
  });

  it("counts across the groups", () => {
    expect(listCount(list)).toBe(6);
    expect(listCompanies(list).map((c) => c.name)[4]).toBe("Gumtree 16");
    expect(listCount(null)).toBe(0);
  });

  it("says what a group is made of — industries and company types, most common first, blanks left out", () => {
    const f = facets(listGroups(list)[0].companies);
    expect(f.industries).toEqual([{ name: "HR tech", n: 2 }, { name: "Fintech", n: 1 }, { name: "Health tech", n: 1 }]);
    expect(f.types).toEqual([{ name: "Scale-up", n: 2 }, { name: "Established", n: 1 }]);
    expect(facets([])).toEqual({ industries: [], types: [] });
  });

  it("writes a row's second line and the overview row's summary", () => {
    expect(industryLine({ name: "X", industry: "HR tech", subSector: "Payroll" })).toBe("HR tech · Payroll");
    expect(industryLine({ name: "X", subSector: "Payroll" })).toBe("Payroll");
    expect(industryLine({ name: "X" })).toBe("");
    expect(listSummary(list)).toBe("6 companies · 4 sunrise · 1 sunset · 1 not yet classified");
    expect(listSummary({ sunrise: [{ rank: 1, name: "A" }] })).toBe("1 company · all sunrise");
    expect(listSummary(undefined)).toBe("");
  });
});
