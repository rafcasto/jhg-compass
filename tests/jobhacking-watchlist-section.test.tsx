import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { careersHost, companyLookup, watchlistRows } from "@/lib/jobhacking/company-lists";
import WatchlistSection from "@/components/jobhacking/WatchlistSection";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// The read view never mounts the editor; its module would pull Firebase in.
vi.mock("@/components/careerops/WatchlistPanel", () => ({ default: () => <p>editor</p> }));

// JobHacking → Target companies → Watchlist — docs/UX_JOBHACKING.md §3c: the
// watchlist read through the same row as the ranked lists, with an Edit.

const setup = {
  portals: {
    companies: [
      { name: "Wattle HR Cloud", careersUrl: "https://boards.example/wattle-hr-cloud" },
      { name: "Grevillea Clinic Systems", careersUrl: "" },
      { name: "Kangaroo Cash Loans", careersUrl: "https://www.kangaroo.example/jobs" },
      { name: " ", careersUrl: "https://blank.example" },
    ],
    positive: ["Customer Success Manager", "Renewals Manager"],
    negative: ["intern"],
  },
  companyLists: {
    all: {
      sunrise: [
        { rank: 1, name: "Wattle HR Cloud", industry: "HR tech", subSector: "Payroll compliance software", companyType: "scaleup", careersUrl: "https://boards.example/wattle-hr-cloud", careersUrlStatus: "confirmed" },
        { rank: 7, name: "grevillea clinic  systems", industry: "HR tech", subSector: "Payroll compliance software", companyType: "scaleup", careersUrlStatus: "none" },
      ],
    },
  },
} as CareerOpsSetupV2;

describe("watchlist rows", () => {
  it("borrows industry · sub-sector and type from the ranked lists by name (case and spacing aside), never inventing them", () => {
    const rows = watchlistRows(setup.portals!.companies, setup.companyLists);
    expect(rows.map((r) => r.c.rank)).toEqual([1, 2, 3]); // the blank name is dropped
    expect(rows[0]).toEqual({ c: { rank: 1, name: "Wattle HR Cloud", industry: "HR tech", subSector: "Payroll compliance software", companyType: "scaleup", careersUrl: "https://boards.example/wattle-hr-cloud" }, secondLine: "HR tech · Payroll compliance software", ranked: true });
    expect(rows[1].ranked).toBe(true);
    expect(rows[1].c.careersUrl).toBeUndefined();
    // Not on the coach's lists: the careers host is the second line, no type.
    expect(rows[2]).toMatchObject({ c: { rank: 3, name: "Kangaroo Cash Loans", careersUrl: "https://www.kangaroo.example/jobs" }, secondLine: "kangaroo.example", ranked: false });
    expect(rows[2].c.industry).toBeUndefined();
    expect(watchlistRows(undefined, undefined)).toEqual([]);
  });

  it("looks companies up across the three lists, the widest winning", () => {
    const m = companyLookup({ top3: { sunrise: [{ rank: 1, name: "A", industry: "from top3" }] }, all: { sunrise: [{ rank: 1, name: "a", industry: "from all" }] } });
    expect(m.get("a")?.industry).toBe("from all");
    expect(careersHost("https://www.xero.com/careers/")).toBe("xero.com");
    expect(careersHost("jobs.lever.co/xero")).toBe("jobs.lever.co");
    expect(careersHost("")).toBe("");
  });
});

describe("WatchlistSection — read view", () => {
  it("shows the companies as the same rows, the keywords as pills, and one Edit button", () => {
    render(<WatchlistSection uid="u1" setup={setup} goalRole="Customer Success Manager" />);
    const companies = screen.getByRole("region", { name: /Companies/ });
    const rows = within(companies).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("1.Wattle HR Cloud");
    expect(rows[0]).toHaveTextContent("HR tech · Payroll compliance software");
    expect(rows[0]).toHaveTextContent("Scale-up");
    expect(within(rows[0]).getByRole("link", { name: "Wattle HR Cloud careers page — opens in a new tab" })).toHaveAttribute("target", "_blank");
    expect(rows[1]).toHaveTextContent("No careers page yet");
    expect(rows[2]).toHaveTextContent("kangaroo.example");
    expect(within(screen.getByRole("region", { name: /Titles to include/ })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Customer Success Manager", "Renewals Manager"]);
    expect(within(screen.getByRole("region", { name: /Titles to exclude/ })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["intern"]);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Edit watchlist/ })).toBeInTheDocument();
  });

  it("offers to add companies when there are none", () => {
    render(<WatchlistSection uid="u1" setup={{ portals: { companies: [], positive: [], negative: [] } } as unknown as CareerOpsSetupV2} />);
    expect(screen.getByText("No companies on your watchlist yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add companies/ })).toBeInTheDocument();
    expect(screen.queryByRole("region")).toBeNull();
  });
});
