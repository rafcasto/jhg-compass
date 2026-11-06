import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The editor writes to Firestore; the read view is what is under test.
vi.mock("@/components/jobhacking/StoryBankEditor", () => ({ default: () => <p>editor</p> }));
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseProfileFile } from "@/lib/careerops/profile-file";
import CompanyListPanel from "@/components/jobhacking/CompanyListPanel";
import StoryBankPanel from "@/components/jobhacking/StoryBankPanel";
import { BoundariesPanel, TrueNorthFacts } from "@/components/jobhacking/WorkbookPanels";

// The four files' working data on the pages — docs/UX_JOBHACKING.md §4b.

const read = (name: string) => parseProfileFile(readFileSync(path.resolve(__dirname, `../public/${name}.example.yml`), "utf8"), `${name}.yml`).profile;

describe("Boundaries", () => {
  it("renders the True North file's lists as pills and the notice period, and points at Settings when empty", () => {
    render(<BoundariesPanel jhg={read("true-north").jhg} />);
    expect(screen.getByText("Hard no's — do not apply")).toBeInTheDocument();
    expect(screen.getByText("hands-on coding roles")).toBeInTheDocument();
    expect(screen.getByText("Kiwi Bet Online")).toBeInTheDocument();
    expect(screen.getByText("28 days")).toBeInTheDocument();
    render(<BoundariesPanel jhg={undefined} />);
    expect(screen.getByRole("link", { name: /Upload True North/ })).toHaveAttribute("href", "/jobhacking/settings");
  });

  it("Target roles shows titles, clusters and the postings with a link each", () => {
    render(<TrueNorthFacts section="roles" jhg={read("true-north").jhg} />);
    expect(screen.getByText("Analog titles — same job, another name")).toBeInTheDocument();
    expect(screen.getByText("Delivery reliability under growth")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /opens in a new tab/ })).toHaveLength(15);
  });
});

describe("Target companies with the workbook", () => {
  it("Top 3 rows carry why now / first move / by date, and scores on the second line", () => {
    const p = read("target-companies");
    render(<CompanyListPanel listKey="top3" list={p.companyLists?.top3} jhg={p.jhg} />);
    expect(screen.getByText("Why now")).toBeInTheDocument();
    expect(screen.getByText(/Series B closed/)).toBeInTheDocument();
    expect(screen.getAllByText("19 · G5 I5 A4 P5")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /Tōtara Payments careers page — opens/ })).toHaveAttribute("href", "https://boards.example/totara-payments");
  });

  it("Top 40 lists the coach's challenges and names a corrected careers page", () => {
    const p = read("target-companies");
    render(<CompanyListPanel listKey="all" list={p.companyLists?.all} jhg={p.jhg} />);
    expect(screen.getByText("Challenged by your coach")).toBeInTheDocument();
    expect(screen.getByText("brand worship")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Southerly Energy Software careers page \(corrected by your coach\)/ })).toBeInTheDocument();
  });
});

describe("Story Bank with STAR-R and story facts", () => {
  it("shows situation · task · action · reflection, the fact behind the story, and the snapshot detail", () => {
    const p = read("artefacts");
    render(<StoryBankPanel uid="u1" source={{ narrative: p.narrative, stories: p.stories, snapshots: p.snapshots }} jhg={p.jhg} />);
    expect(screen.getAllByText("Situation")).toHaveLength(9);
    expect(screen.getByText("a 110-engineer logistics SaaS doubling in size")).toBeInTheDocument();
    expect(screen.getByText("Release dashboard, Q2 2023", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Mapped every team's release steps")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fortnightly release train — where it is shown/ })).toHaveAttribute("href", "https://ana-ferreira.example/release-cadence-playbook");
  });
});
