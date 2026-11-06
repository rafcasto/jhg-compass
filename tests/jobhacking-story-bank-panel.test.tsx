import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import StoryBankPanel from "@/components/jobhacking/StoryBankPanel";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// The read view never mounts the editor; its module would pull Firebase in.
vi.mock("@/components/jobhacking/StoryBankEditor", () => ({ default: () => <p>editor</p> }));

// JobHacking → Artefacts → Story Bank — docs/UX_JOBHACKING.md §3d: rows, with an Edit.

const setup = {
  narrative: { proofPoints: [{ name: "Fortnightly release train", heroMetric: "Monthly to fortnightly across 9 teams" }] },
  stories: [
    { id: "S1", title: "Fortnightly release train", result: "Moved cadence from monthly to fortnightly.", provenance: "verified" },
    { id: "S2", title: "Incident halving", provenance: "estimate" },
  ],
  snapshots: [{ company: "Tracksuit", storyId: "S1", results: ["monthly", "fortnightly"] }, { company: "Partly", storyId: "S9" }],
} as CareerOpsSetupV2;

describe("StoryBankPanel", () => {
  it("shows proof points, stories with their snapshots, the unclaimed snapshot on its own, and one Edit button", () => {
    render(<StoryBankPanel uid="u1" source={setup} />);
    const proof = screen.getByRole("region", { name: /Proof points/ });
    expect(within(proof).getAllByRole("listitem")).toHaveLength(1);
    const stories = screen.getByRole("region", { name: /Stories/ });
    const rows = within(stories).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Fortnightly release train");
    expect(rows[0]).toHaveTextContent("Tracksuit");
    expect(rows[0]).toHaveTextContent("monthly → fortnightly");
    expect(within(stories).getAllByText("Verified").length).toBeGreaterThan(0);
    const snaps = screen.getByRole("region", { name: /Snapshots/ });
    expect(within(snaps).getByText("Partly")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit story bank" })).toHaveLength(1);
    expect(screen.queryByText("editor")).toBeNull();
  });

  it("opens the editor on Edit", () => {
    render(<StoryBankPanel uid="u1" source={setup} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit story bank" }));
    expect(screen.getByText("editor")).toBeInTheDocument();
  });

  it("offers Add stories and Upload artefacts when the bank is empty", () => {
    render(<StoryBankPanel uid="u1" source={{}} />);
    expect(screen.getByText("No stories yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Upload artefacts/ })).toHaveAttribute("href", "/jobhacking/settings");
    fireEvent.click(screen.getByRole("button", { name: /Add stories/ }));
    expect(screen.getByText("editor")).toBeInTheDocument();
  });
});
