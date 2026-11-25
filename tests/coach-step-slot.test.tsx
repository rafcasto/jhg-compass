import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StepSlot from "@/components/coach/StepSlot";
import StepTranscript from "@/components/coach/StepTranscript";
import { findStep } from "@/lib/engine/coach/script";
import { TRUE_NORTH_SCRIPT } from "@/lib/engine/coach/script/true-north";
import type { ProfileFile } from "@/lib/careerops/profile-file";

vi.mock("@/lib/firestore/db", () => ({ paths: { engineJob: (uid: string, id: string) => `users/${uid}/engineJobs/${id}` }, useLiveDoc: () => ({ data: null, loading: false }) }));
vi.mock("@/lib/firebase/client", () => ({ auth: { currentUser: { getIdToken: async () => "tok" } } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

// The step in the slot (docs/UX_SCRIPTED_COACH.md §2–§3): one bold question, labels that recede, one red that waits until the
// answer holds, the skip only where the prompt allows it; the transcript as the record of decisions with Change ›.

const S = TRUE_NORTH_SCRIPT;
const empty: ProfileFile = { version: 1 };

describe("StepSlot", () => {
  it("asks the pay step: the aside once, four fields, Continue until the figures hold", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<StepSlot step={findStep(S, "pay")!} profile={empty} aside="Before we aim, we set the fence." onSubmit={onSubmit} />);
    expect(screen.getByText("Before we aim, we set the fence.")).toBeInTheDocument();
    expect(screen.getByText("What's your target pay, per year?")).toHaveClass("font-semibold");
    for (const l of ["Currency", "Lower", "Upper", "Floor"]) expect(screen.getByText(l)).toHaveClass("label");
    const go = screen.getByRole("button", { name: "Continue" });
    expect(go).toHaveClass("btn-primary");
    expect(go).toBeDisabled();
    expect(screen.queryByText("I don't know yet")).toBeNull(); // pay is not skippable
    await user.selectOptions(screen.getByRole("combobox"), "NZD");
    await user.type(screen.getByLabelText("Lower"), "140,000");
    await user.type(screen.getByLabelText("Upper"), "170,000");
    await user.type(screen.getByLabelText("Floor"), "150,000");
    expect(screen.getByRole("alert")).toHaveTextContent("The floor is above the lower end");
    expect(go).toBeDisabled();
    await user.clear(screen.getByLabelText("Floor"));
    await user.type(screen.getByLabelText("Floor"), "130,000");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(go).toBeEnabled();
    await user.click(go);
    expect(onSubmit).toHaveBeenCalledWith({ currency: "NZD", salaryLower: "140,000", salaryUpper: "170,000", salaryFloor: "130,000" });
  });

  it("offers I don't know yet on a skippable step, Back when there is one, and reads a stored answer back", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn(), onBack = vi.fn();
    const stored: ProfileFile = { version: 1, jhg: { trueNorth: { boundaries: { cultureMustHaves: ["clear decision rights"], deprioritizeIfAbsent: "Y" } } } };
    render(<StepSlot step={findStep(S, "culture")!} profile={stored} reopened onSubmit={() => undefined} onSkip={onSkip} onBack={onBack} />);
    expect(screen.getByLabelText("Must-haves")).toHaveValue("clear decision rights");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(); // reopened: the primary says Save
    await user.click(screen.getByRole("button", { name: "I don't know yet" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("buckets the repeated titles one row each, and refuses a list with no exclude", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const postings = [{ title: "Delivery Lead" }, { title: "Delivery Lead" }, { title: "Head of Delivery" }, { title: "Head of Delivery" }, { title: "Scrum Master" }, { title: "Scrum Master" }];
    render(<StepSlot step={findStep(S, "titles")!} profile={{ version: 1, jhg: { trueNorth: { postings } } }} onSubmit={onSubmit} />);
    const rows = screen.getAllByRole("group", { name: /: Titles$/ });
    expect(rows.map((g) => g.getAttribute("aria-label"))).toEqual(["Delivery Lead: Titles", "Head of Delivery: Titles", "Scrum Master: Titles"]);
    await user.click(within(rows[0]).getByRole("button", { name: "Target" }));
    await user.click(within(rows[1]).getByRole("button", { name: "Analog" }));
    await user.click(within(rows[2]).getByRole("button", { name: "Target" }));
    expect(screen.getByRole("alert")).toHaveTextContent("At least one title to exclude");
    await user.click(within(rows[2]).getByRole("button", { name: "Exclude" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledWith({ titles: { "Delivery Lead": "target", "Head of Delivery": "analog", "Scrum Master": "exclude" } });
  });

  it("a job step's primary says what it starts, and needs no answer", () => {
    render(<StepSlot step={findStep(S, "boards")!} profile={empty} onSubmit={() => undefined} />);
    expect(screen.getByRole("button", { name: "Read the postings" })).toBeEnabled();
  });
});

describe("StepTranscript", () => {
  it("shows every answered step as the member's block with the write line, a View › and Change ›", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const profile: ProfileFile = { version: 1, jhg: { trueNorth: { boundaries: { currency: "NZD", salaryLower: "140,000", salaryUpper: "170,000", salaryFloor: "130,000" } } } };
    render(<StepTranscript script={S} profile={profile} ctx={{ jobs: [] }} portal="jobhacking" jobHref="/jobhacking/true-north" onChange={onChange} />);
    expect(screen.getByText("NZD 140,000–170,000 · floor 130,000")).toBeInTheDocument();
    expect(screen.getByText("Updated Salary range")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View ›" })).toHaveAttribute("href", "/jobhacking/true-north?section=salary");
    await user.click(screen.getByRole("button", { name: "Change ›" }));
    expect(onChange).toHaveBeenCalledWith(findStep(S, "pay"));
    expect(screen.getAllByText("You")).toHaveLength(1); // rights is not answered yet
  });
});
