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

  it("expanded, the scale is read once: the legend is open above the grid, the name is never cut, done reads at a glance", async () => {
    const user = userEvent.setup();
    const long = "Test strategy and planning for regulated multi-vendor programmes";
    render(<ScoreMatrix kind="skills" items={[long, "SQL"]} onSubmit={() => undefined} wide />);
    // The anchors are on the page, not only inside the lists — and the dock's fold is gone.
    expect(screen.getByText(/1 Beginner · 2 Can do it with help/)).toBeInTheDocument();
    expect(screen.queryByText("What the numbers mean")).toBeNull();
    expect(screen.getByText(/Tab moves across; type 1–5 to score/)).toBeInTheDocument();
    // The name wraps; nothing truncates it.
    const name = screen.getByText(long);
    expect(name).not.toHaveClass("truncate");
    // Empty reads mute; filled reads ink; a complete row's total goes ink and semibold.
    const rows = screen.getAllByRole("listitem");
    const good = screen.getByRole("combobox", { name: `Good at it — ${long}` });
    expect(good).toHaveClass("text-jh-mute");
    expect(within(rows[0]).getByText("— / 20")).toHaveClass("text-jh-mute");
    await user.selectOptions(good, "4");
    expect(good).toHaveClass("text-jh-ink");
    await user.selectOptions(screen.getByRole("combobox", { name: `Love it — ${long}` }), "5");
    await user.selectOptions(screen.getByRole("combobox", { name: `Can prove it — ${long}` }), "3");
    await user.selectOptions(screen.getByRole("combobox", { name: `Market pays — ${long}` }), "2");
    expect(within(rows[0]).getByText("14 / 20")).toHaveClass("font-semibold", "text-jh-ink");
    expect(within(rows[1]).getByText("— / 20")).toHaveClass("text-jh-mute");
  });

  it("docked, the name is never cut either and the legend stays folded", () => {
    const long = "Test strategy and planning for regulated multi-vendor programmes";
    render(<ScoreMatrix kind="skills" items={[long, "SQL", "Go"]} onSubmit={() => undefined} />);
    expect(screen.getByText(long)).not.toHaveClass("truncate");
    expect(screen.getByText("What the numbers mean")).toBeInTheDocument();
    expect(screen.queryByText(/Tab moves across/)).toBeNull();
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

// With evidence (docs/UX_COACH_COMPANY_SCORING.md §4): Growth and Access arrive filled with the portal's reasons under the
// name; Interest and Proof are the member's; a changed suggestion goes out as an override; the connections file is asked for
// in the header while none is on file.
import type { CompanyEvidence } from "@/lib/engine/coach/evidence";

describe("ScoreMatrix with evidence", () => {
  const ev = (over: Partial<CompanyEvidence> = {}): CompanyEvidence => ({
    growth: { suggested: 5, why: ["hiring 2 roles for you now — Senior Product Manager (Seek, 2026-11-12)", "Series B NZD 20m (Sep 2026) ›"] },
    access: { suggested: 5, contacts: [{ name: "Jane Doe", position: "Head of Product", connectedOn: "2024" }], more: 2 },
    interest: { suggested: 4, line: "Auckland · scaleup — the type you aim at" },
    proof: { suggested: 4, phrases: ["own the roadmap"], matches: ["Roadmap ownership"], line: "" },
    ...over,
  });
  const quiet = ev({ growth: { suggested: 1, why: ["nothing on file"] }, access: { suggested: 1, contacts: [], more: 0 }, proof: { suggested: 2, phrases: [], matches: [], line: "no postings read — a guess unless you know their problem" } });

  it("pre-fills what the evidence suggests, shows the reasons under the name, counts the rest as the member's, sends overrides", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ScoreMatrix kind="companies" items={["Halter", "Xero"]} evidence={[ev(), quiet]} suggested={[[5, null, 5, null], [1, null, 1, null]]} connections={{ total: 312, matched: 14 }} onSubmit={onSubmit} />);
    expect(screen.getByText(/312 LinkedIn connections \(14 companies have one\)/)).toBeInTheDocument();
    expect((screen.getByRole("combobox", { name: "Market signal — Halter" }) as HTMLSelectElement).value).toBe("5");
    expect((screen.getByRole("combobox", { name: "Access — Halter" }) as HTMLSelectElement).value).toBe("5");
    expect((screen.getByRole("combobox", { name: "Fit — Halter" }) as HTMLSelectElement).value).toBe("");
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
    expect(screen.getByText("Roadmap ownership")).toBeInTheDocument();
    expect(screen.getByText(/no postings read — a guess/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Connections.csv" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 of 2 scored");
    await user.selectOptions(screen.getByRole("combobox", { name: "Fit — Halter" }), "4");
    await user.selectOptions(screen.getByRole("combobox", { name: "Proficiency — Halter" }), "3");
    await user.selectOptions(screen.getByRole("combobox", { name: "Access — Halter" }), "4");
    await user.selectOptions(screen.getByRole("combobox", { name: "Fit — Xero" }), "2");
    await user.selectOptions(screen.getByRole("combobox", { name: "Proficiency — Xero" }), "1");
    expect(screen.getByRole("status")).toHaveTextContent("2 of 2 scored");
    await user.click(screen.getByRole("button", { name: "Send scores" }));
    expect(onSubmit).toHaveBeenCalledWith([{ item: "Halter", values: [5, 4, 4, 3], overrides: [{ axis: "access", from: 5 }] }, { item: "Xero", values: [1, 2, 1, 1] }]);
  });

  it("asks for Connections.csv in the header while none is on file", () => {
    const onConnections = vi.fn();
    render(<ScoreMatrix kind="companies" items={["Halter"]} evidence={[quiet]} suggested={[[1, null, 1, null]]} connections={null} onSubmit={() => undefined} onConnections={onConnections} />);
    expect(screen.getByText(/Access is a guess until you add your LinkedIn connections/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Connections.csv" })).toBeInTheDocument();
    expect(screen.getByText(/your coach sees counts, not names/)).toBeInTheDocument();
  });

  it("shows a changed suggestion in the scored table with the portal's number beside it", () => {
    const rows = rankRows([{ item: "Halter", values: [5, 4, 4, 3], overrides: [{ axis: "access", from: 5 }] }, { item: "Xero", values: [1, 2, 1, 1] }], RUBRICS.companies);
    render(<ScoredRows kind="companies" rows={rows} />);
    expect(screen.getByText("1 suggestion changed — the portal's number in brackets.")).toBeInTheDocument();
    expect(screen.getByTitle("was 5")).toHaveTextContent("4 (5)");
  });
});
