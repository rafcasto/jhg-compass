import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PerformanceScreen from "@/components/performance/PerformanceScreen";
import { DEFAULT_CONTENT, DEFAULT_TEXT, weeklyTargetsFrom } from "@/lib/content";
import { ymd } from "@/lib/period";

// The Targets sheet is built on tracker/Sheet, which reads its close/back labels from content.
vi.mock("@/lib/firestore/content", () => ({
  useContent: () => ({ t: (k: string) => DEFAULT_TEXT[k] ?? k, stages: [] }),
}));

const t = (k: string) => DEFAULT_CONTENT.text[k] ?? "";
const hidden = DEFAULT_CONTENT.activities.filter((a) => a.market === "hidden");
const visible = DEFAULT_CONTENT.activities.filter((a) => a.market === "visible");
const wed = new Date(2026, 0, 14); // Wed 14 Jan 2026
const sat = new Date(2026, 0, 17);

const base = { t, hidden, visible, effortSplit: DEFAULT_CONTENT.effortSplit, weeklyTargets: weeklyTargetsFrom(DEFAULT_CONTENT), userTargets: {}, logs: [] as any[] };

describe("PerformanceScreen (presentational)", () => {
  it("renders the admin-editable copy and every activity", () => {
    render(<PerformanceScreen {...base} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t("perf.title"));
    expect(screen.getByText(t("perf.hiddenTitle"))).toBeInTheDocument();
    for (const a of [...hidden, ...visible]) expect(screen.getByText(a.label)).toBeInTheDocument();
  });

  it("opens on Week — the stored unit — with the weekly figures as targets", () => {
    render(<PerformanceScreen {...base} now={wed} />);
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
    const first = hidden[0]; // research_industry 5 / wk
    expect(screen.getByRole("button", { name: `Change target: ${first.label}` })).toHaveTextContent("5");
  });

  it("+ / − only ever log; the row's target is the way in to change it", async () => {
    const user = userEvent.setup();
    const onLog = vi.fn(); const onSaveTargets = vi.fn();
    const first = hidden[0];
    render(<PerformanceScreen {...base} hidden={[first]} visible={[]} weeklyTargets={{ [first.id]: 5 }}
      onLog={onLog} onSaveTargets={onSaveTargets} now={wed} />);
    await user.click(screen.getByRole("button", { name: `Log one: ${first.label}` }));
    expect(onLog).toHaveBeenCalledWith(first.id, ymd(wed), "week");

    // Tap the target → sheet, weekly stepper, Done → one write with the weekly base.
    await user.click(screen.getByRole("button", { name: `Change target: ${first.label}` }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(t("perf.targetsTitle"))).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: `Raise weekly target: ${first.label}` }));
    await user.click(within(dialog).getByRole("button", { name: t("perf.done") }));
    expect(onSaveTargets).toHaveBeenCalledWith({ set: { [first.id]: 6 }, unset: [] });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Done without changes writes nothing; Edit targets opens the same sheet", async () => {
    const user = userEvent.setup();
    const onSaveTargets = vi.fn();
    render(<PerformanceScreen {...base} onSaveTargets={onSaveTargets} now={wed} />);
    await user.click(screen.getByRole("button", { name: t("perf.editTargets") }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("perf.done") }));
    expect(onSaveTargets).not.toHaveBeenCalled();
  });

  it("Day view never shows a 0 target: small weekly targets show as '/ wk' and track the week", async () => {
    const user = userEvent.setup();
    const cold = hidden.find((a) => a.id === "outreach_cold")!;      // 8 / wk → ~2 / day
    const jobInt = hidden.find((a) => a.id === "job_interview")!;    // 1 / wk → "1 / wk"
    const logs = [{ id: "l1", categoryId: jobInt.id, loggedOn: ymd(new Date(2026, 0, 12)), count: 1 }]; // Monday of that week
    render(<PerformanceScreen {...base} hidden={[cold, jobInt]} visible={[]} logs={logs} now={wed} />);
    await user.click(screen.getByRole("button", { name: "Day" }));
    expect(screen.getByRole("button", { name: `Change target: ${cold.label}` })).toHaveTextContent("~2");
    const jobRow = screen.getByText(jobInt.label).parentElement as HTMLElement;
    expect(within(jobRow).getByRole("button", { name: `Change target: ${jobInt.label}` })).toHaveTextContent("1 / wk");
    // the ACTUAL for that row counts the week so far (Monday's log), and is met → not red
    expect(within(jobRow).getByRole("img")).toHaveAttribute("aria-label", "1 of 1");
    expect(screen.queryByText(t("perf.setGoal"))).toBeNull();
  });

  it("a weekend day in Day view shows the weekly figure, not 0, and does not close short", async () => {
    const user = userEvent.setup();
    const first = hidden[0]; // 5 / wk
    render(<PerformanceScreen {...base} hidden={[first]} visible={[]} now={sat} />);
    await user.click(screen.getByRole("button", { name: "Day" }));
    expect(screen.getByRole("button", { name: `Change target: ${first.label}` })).toHaveTextContent("5 / wk");
  });
});
