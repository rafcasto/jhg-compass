import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SkillMatrix, { ScoredSkills } from "@/components/coach/SkillMatrix";
import Composer from "@/components/coach/Composer";
import { scoreSkills } from "@/lib/engine/coach/skills";

// The skills matrix in the transcript (docs/UX_COACH_AGENTIC.md §9): one select per axis per skill with the
// anchors inside, a live total, Send scores locked until every skill is scored; the scored table as the member's turn.

describe("SkillMatrix", () => {
  it("renders four selects a skill with the five anchors, totals live, and sends once everything is scored", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SkillMatrix skills={["Python", "SQL", "Negotiation"]} onSubmit={onSubmit} />);
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
      { skill: "Python", good: 4, love: 5, proof: 5, pays: 3 },
      { skill: "SQL", good: 4, love: 5, proof: 5, pays: 3 },
      { skill: "Negotiation", good: 4, love: 5, proof: 2, pays: 3 },
    ]);
  });

  it("locks while the coach is writing", () => {
    render(<SkillMatrix skills={["a", "b", "c"]} onSubmit={() => undefined} disabled />);
    for (const s of screen.getAllByRole("combobox")) expect(s).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send scores" })).toBeDisabled();
  });

  it("shows the scored table ranked, with the four numbers and the total, and marks the cut after six", () => {
    const scored = scoreSkills(Array.from({ length: 8 }, (_, i) => ({ skill: `s${i}`, good: 5 - (i % 5), love: 3, proof: 4, pays: 2 })));
    render(<ScoredSkills scores={scored} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(items[0]).toHaveTextContent("1");
    expect(items[0]).toHaveTextContent("s0");
    expect(items[0]).toHaveTextContent("5 · 3 · 4 · 2");
    expect(items[0]).toHaveTextContent("14");
    expect(items[6].className).toContain("border-t");
    expect(screen.getByText(/the top 6 go to the playoff/)).toBeInTheDocument();
  });

  it("the composer's Send steps down to secondary while the matrix waits", () => {
    const { rerender } = render(<Composer onSend={() => undefined} tone="secondary" />);
    expect(screen.getByRole("button", { name: "Send" })).toHaveClass("btn-secondary");
    rerender(<Composer onSend={() => undefined} />);
    expect(screen.getByRole("button", { name: "Send" })).toHaveClass("btn-primary");
  });
});
