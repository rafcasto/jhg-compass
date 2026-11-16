import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScoreMatrix, { ScoredRows } from "@/components/coach/ScoreMatrix";
import Composer from "@/components/coach/Composer";
import { RUBRICS, rankRows } from "@/lib/engine/coach/rubrics";

// The scoring matrix in the transcript (docs/UX_COACH_AGENTIC.md §9–§10): one select per axis per row with the
// rubric's anchors inside, a mute context line where the row has one, a live total, Send scores locked until
// every row is scored; the scored table as the member's turn with the rubric's cut.

describe("ScoreMatrix", () => {
  it("renders four selects a row with the five anchors, totals live, and sends once everything is scored", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ScoreMatrix kind="skills" items={["Python", "SQL", "Negotiation"]} onSubmit={onSubmit} />);
    expect(screen.getByText("Score your skills · 1–5")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(12);
    const good = screen.getByRole("combobox", { name: "Good at it — Python" });
    expect(within(good).getAllByRole("option").map((o) => o.textContent)).toEqual(["Good", "1 · Beginner", "2 · Can do it with help", "3 · Solid, unsupervised", "4 · Others ask me for it", "5 · Among the best I know"]);
    const send = screen.getByRole("button", { name: "Send scores" });
    expect(send).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("0 of 3 scored");

    for (const skill of ["Python", "SQL", "Negotiation"]) {
      await user.selectOptions(screen.getByRole("combobox", { name: `Good at it — ${skill}` }), "4");
      await user.selectOptions(screen.getByRole("combobox", { name: `Love it — ${skill}` }), "5");
      await user.selectOptions(screen.getByRole("combobox", { name: `Can prove it — ${skill}` }), skill === "Negotiation" ? "2" : "5");
      await user.selectOptions(screen.getByRole("combobox", { name: `Market pays — ${skill}` }), "3");
    }
    expect(screen.getByRole("status")).toHaveTextContent("3 of 3 scored");
    expect(screen.getAllByText("17 / 20")).toHaveLength(2); // Python, SQL
    expect(screen.getByText("14 / 20")).toBeInTheDocument(); // Negotiation
    expect(send).toBeEnabled();
    await user.click(send);
    expect(onSubmit).toHaveBeenCalledWith([
      { item: "Python", values: [4, 5, 5, 3] },
      { item: "SQL", values: [4, 5, 5, 3] },
      { item: "Negotiation", values: [4, 5, 2, 3] },
    ]);
  });

  it("renders the companies rubric with its own anchors and a mute line under each company", () => {
    render(<ScoreMatrix kind="companies" items={["Xero", "Halter"]} meta={["Accounting SaaS · +18% FY25", ""]} onSubmit={() => undefined} />);
    expect(screen.getByText("Score your companies · 1–5")).toBeInTheDocument();
    const access = screen.getByRole("combobox", { name: "Access — Xero" });
    expect(within(access).getAllByRole("option")[5]).toHaveTextContent("5 · Someone I can message today");
    expect(screen.getByText("Accounting SaaS · +18% FY25")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("expanded, a row is one line — name, four selects, total — and the header names the total column", () => {
    render(<ScoreMatrix kind="companies" items={["Xero", "Halter"]} meta={["Accounting SaaS", ""]} onSubmit={() => undefined} wide />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-wide-row");
    expect(within(rows[0]).getAllByRole("combobox")).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Xero");
    expect(rows[0]).toHaveTextContent("Accounting SaaS");
    expect(rows[0]).toHaveTextContent("— / 20");
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand for more room ›" })).toBeNull();
  });

  it("docked, offers to expand — once, in the intro line, mute — and not when nothing can expand", async () => {
    const onExpand = vi.fn();
    const { rerender } = render(<ScoreMatrix kind="skills" items={["a", "b", "c"]} onSubmit={() => undefined} onExpand={onExpand} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Expand for more room ›" }));
    expect(onExpand).toHaveBeenCalledTimes(1);
    rerender(<ScoreMatrix kind="skills" items={["a", "b", "c"]} onSubmit={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Expand for more room ›" })).toBeNull();
  });

  it("locks while the coach is writing", () => {
    render(<ScoreMatrix kind="skills" items={["a", "b", "c"]} onSubmit={() => undefined} disabled />);
    for (const s of screen.getAllByRole("combobox")) expect(s).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send scores" })).toBeDisabled();
  });

  it("shows the scored table ranked, with the four numbers and the total, and marks the rubric's cut", () => {
    const rows = rankRows(Array.from({ length: 8 }, (_, i) => ({ item: `s${i}`, values: [5 - (i % 5), 3, 4, 2] })), RUBRICS.skills);
    render(<ScoredRows kind="skills" rows={rows} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(items[0]).toHaveTextContent("1");
    expect(items[0]).toHaveTextContent("s0");
    expect(items[0]).toHaveTextContent("5 · 3 · 4 · 2");
    expect(items[0]).toHaveTextContent("14");
    expect(items[6].className).toContain("border-t");
    expect(screen.getByText(/the top 6 go to the playoff/)).toBeInTheDocument();
  });

  it("marks the cut at ten for companies", () => {
    const rows = rankRows(Array.from({ length: 12 }, (_, i) => ({ item: `c${i}`, values: [5 - (i % 5), 3, 4, 2] })), RUBRICS.companies);
    render(<ScoredRows kind="companies" rows={rows} />);
    const items = screen.getAllByRole("listitem");
    expect(items[10].className).toContain("border-t");
    expect(items[6].className).not.toContain("border-t");
    expect(screen.getByText(/ranks 1–10 become your Top 10/)).toBeInTheDocument();
  });

  it("the composer's Send steps down to secondary while a matrix waits", () => {
    const { rerender } = render(<Composer onSend={() => undefined} tone="secondary" />);
    expect(screen.getByRole("button", { name: "Send" })).toHaveClass("btn-secondary");
    rerender(<Composer onSend={() => undefined} />);
    expect(screen.getByRole("button", { name: "Send" })).toHaveClass("btn-primary");
  });
});
