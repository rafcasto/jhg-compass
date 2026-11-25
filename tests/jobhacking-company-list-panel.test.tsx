import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import CompanyListPanel from "@/components/jobhacking/CompanyListPanel";
import type { CompanyList } from "@/lib/careerops/types";

// JobHacking → Target companies → Top 3 / Top 10 / Top 40 — docs/UX_JOBHACKING.md §3b.
// Shaped like the Priya sample: one row model, the Top 3 and the Top 40 alike.

const top3: CompanyList = {
  sunrise: [
    { rank: 1, name: "Wattle HR Cloud", industry: "HR tech", subSector: "Payroll compliance software", companyType: "scaleup", careersUrl: "https://boards.example/wattle-hr-cloud", careersUrlStatus: "confirmed" },
    { rank: 2, name: "Coolabah Health Software", industry: "Health tech", subSector: "Clinic scheduling", companyType: "established", careersUrl: "https://boards.example/coolabah", careersUrlStatus: "confirmed" },
    { rank: 4, name: "Ironbark Logistics SaaS", industry: "HR tech", subSector: "Payroll compliance software", companyType: "established", careersUrlStatus: "none" },
  ],
  sunset: [],
};

const all: CompanyList = {
  sunrise: [
    { rank: 1, name: "Wattle HR Cloud", industry: "HR tech", subSector: "Payroll compliance software", companyType: "scaleup", careersUrl: "https://boards.example/wattle-hr-cloud", careersUrlStatus: "confirmed" },
    { rank: 7, name: "Grevillea Clinic Systems", industry: "HR tech", subSector: "Payroll compliance software", companyType: "scaleup", careersUrlStatus: "none" },
    { rank: 12, name: "Gumtree Software 12", industry: "Fintech", subSector: "Embedded payments", companyType: "established", careersUrl: "https://careers.example/gumtree-12", careersUrlStatus: "opened_by_coach" },
  ],
  sunset: [{ rank: 16, name: "Gumtree Software 16", industry: "HR tech", subSector: "On-premise HR suites", companyType: "established", careersUrl: "https://careers.example/gumtree-16", careersUrlStatus: "opened_by_coach" }],
  unclassified: [{ rank: 13, name: "Gumtree Software 13", industry: "HR tech", subSector: "Benefits brokerage software", companyType: "scaleup" }],
};

describe("CompanyListPanel — Top 3", () => {
  it("is the same ranked rows as the longer lists: rank, name, industry line, type and one careers link", () => {
    render(<CompanyListPanel listKey="top3" list={top3} />);
    const group = screen.getByRole("region", { name: /Sunrise/ });
    const rows = within(group).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("1.Wattle HR Cloud");
    expect(rows[0]).toHaveTextContent("HR tech · Payroll compliance software");
    expect(rows[0]).toHaveTextContent("Scale-up");
    expect(within(rows[0]).getByRole("link", { name: "Wattle HR Cloud careers page — opens in a new tab" })).toHaveAttribute("href", "https://boards.example/wattle-hr-cloud");
    // Rank order is the file's rank, not its position: 1 · 2 · 4.
    expect(rows[2]).toHaveTextContent("4.Ironbark Logistics SaaS");
    // No careers page: said in words, no link, nothing red.
    expect(within(rows[2]).queryByRole("link")).toBeNull();
    expect(rows[2]).toHaveTextContent("No careers page yet");
    // The empty sunset list renders no group.
    expect(screen.queryByRole("region", { name: /Sunset/ })).toBeNull();
    // Three rows: the facet line says what the group is made of.
    expect(group).toHaveTextContent("Industries");
    expect(group).toHaveTextContent("HR tech 2 · Health tech 1");
    expect(group).toHaveTextContent("Established 2 · Scale-up 1");
  });
});

describe("CompanyListPanel — Top 40", () => {
  it("groups sunrise → sunset → not yet classified, in rank order, one icon link per careers page", () => {
    render(<CompanyListPanel listKey="all" list={all} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Sunrise3", "Sunset1", "Not yet classified1"]);
    const sunrise = screen.getByRole("region", { name: /Sunrise/ });
    const rows = within(sunrise).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Wattle HR Cloud"), expect.stringContaining("Grevillea Clinic Systems"), expect.stringContaining("Gumtree Software 12"),
    ]);
    expect(rows[0]).toHaveTextContent("1.Wattle HR Cloud");
    expect(within(rows[0]).getByRole("link", { name: "Wattle HR Cloud careers page — opens in a new tab" })).toHaveAttribute("target", "_blank");
    // Found by the coach, not yet confirmed: said in the accessible name, not in colour.
    expect(within(rows[2]).getByRole("link", { name: "Gumtree Software 12 careers page (found by your coach, not yet confirmed) — opens in a new tab" })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole("link")).toBeNull();
    expect(rows[1]).toHaveTextContent("No careers page yet");
    // Facets for the sunrise group.
    expect(sunrise).toHaveTextContent("HR tech 2 · Fintech 1");
    expect(sunrise).toHaveTextContent("Scale-up 2 · Established 1");
    // One-row groups skip the facet line.
    expect(screen.getByRole("region", { name: /Sunset/ })).not.toHaveTextContent("Industries");
  });

  it("explains where the lists come from when there are none, with one way in", () => {
    render(<CompanyListPanel listKey="top10" list={undefined} />);
    expect(screen.getByText("No Top 10 yet")).toBeInTheDocument();
    expect(screen.getByText(/comes out of the Top 40 with your coach/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Upload target companies/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).toBeNull();
  });
});

// Page-first Top 40 (decision 2026-11-17): Source my 40 on the empty state, a Remove on each row, the portal's evidence under it.
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { evidenceFacts } from "@/lib/jobhacking/workbook";

describe("CompanyListPanel — page-first Top 40", () => {
  it("offers Source my 40 on the empty Top 40 and nothing else", async () => {
    const onSource = vi.fn();
    render(<CompanyListPanel listKey="all" list={undefined} onSource={onSource} />);
    expect(screen.getByText("No Top 40 yet")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Source my 40" }));
    expect(onSource).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: /Upload target companies/ })).not.toBeInTheDocument();
  });
  it("puts a Remove on each row and the evidence under it", async () => {
    const onRemove = vi.fn();
    const evidence = { "Wattle HR Cloud": { growth: { suggested: 5 as const, why: ["hiring 2 roles for you now — Product Manager (Seek, 2026-11-12)", "Series B ›"] }, access: { suggested: 5 as const, contacts: [{ name: "Jane Doe", position: "Head of Product", connectedOn: "" }], more: 1 }, interest: { suggested: 4 as const, line: "Auckland · scaleup — the type you aim at" }, proof: { suggested: 3 as const, phrases: ["own the roadmap"], matches: [], line: "" } } };
    render(<CompanyListPanel listKey="all" list={all} evidence={evidence} onRemove={onRemove} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove Wattle HR Cloud from your Top 40" }));
    expect(onRemove).toHaveBeenCalledWith("Wattle HR Cloud");
    expect(screen.getByText("hiring 2 roles for you now — Product Manager (Seek, 2026-11-12)")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe, Head of Product · +1 more")).toBeInTheDocument();
    expect(screen.getByText(/Remove a company with ×/)).toBeInTheDocument();
    expect(evidenceFacts(evidence["Wattle HR Cloud"]).map((f) => f.label)).toEqual(["Hiring", "You know", "Fit", "They ask for"]);
    expect(evidenceFacts(null)).toEqual([]);
  });
});
