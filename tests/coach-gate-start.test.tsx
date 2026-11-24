import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GateStart from "@/components/coach/GateStart";
import CoachRail from "@/components/coach/CoachRail";
import { coachStates, findCoach } from "@/lib/engine/coach/keys";

// The gate's panel body (decision 2026-11-25): why, the warning, Start anyway as a secondary — and the rail's
// one next step at 6 of 6.

describe("GateStart", () => {
  it("says why, offers Start anyway as a secondary with the warning under it", async () => {
    const onStart = vi.fn();
    const coach = findCoach("targetCompanies")!;
    render(<GateStart coach={coach} missing={[findCoach("narrative")!, findCoach("trueNorth")!]} onStart={onStart} />);
    expect(screen.getByText("Target companies starts after Narrative and True North — your coach needs what they write first.")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Start anyway" });
    expect(btn).toHaveClass("btn-secondary");
    expect(btn).not.toHaveClass("btn-primary");
    expect(screen.getByText("Target companies works best after Narrative and True North — it'll ask you for what it needs.")).toBeInTheDocument();
    await userEvent.setup().click(btn);
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe("CoachRail at 6 of 6", () => {
  const all = coachStates({ narrative: { status: "complete" }, trueNorth: { status: "complete" }, targetCompanies: { status: "complete" }, storyBank: { status: "complete" }, masterCv: { status: "complete" }, linkedin: { status: "complete" } });
  it("says the job search is on and links to it — only once the portal is the member's", () => {
    render(<CoachRail states={all} portal="jobhacking" jobSearch />);
    expect(screen.getByText("6 of 6 complete")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Job Search ›" })).toHaveAttribute("href", "/job-search/sourcing");
  });
  it("says nothing of it without the portal, or before the sixth", () => {
    const { unmount } = render(<CoachRail states={all} portal="jobhacking" />);
    expect(screen.queryByRole("link", { name: "Open Job Search ›" })).toBeNull();
    unmount();
    render(<CoachRail states={coachStates({ narrative: { status: "complete" } })} portal="jobhacking" jobSearch />);
    expect(screen.queryByRole("link", { name: "Open Job Search ›" })).toBeNull();
  });
});
