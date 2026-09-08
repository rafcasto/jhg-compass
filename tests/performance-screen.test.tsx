import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PerformanceScreen from "@/components/performance/PerformanceScreen";
import { DEFAULT_CONTENT, weeklyTargetsFrom } from "@/lib/content";
import { ymd } from "@/lib/period";

const t = (k: string) => DEFAULT_CONTENT.text[k] ?? "";
const hidden = DEFAULT_CONTENT.activities.filter((a) => a.market === "hidden");
const visible = DEFAULT_CONTENT.activities.filter((a) => a.market === "visible");

describe("PerformanceScreen (presentational)", () => {
  it("renders the admin-editable copy and every activity", () => {
    render(<PerformanceScreen t={t} hidden={hidden} visible={visible} effortSplit={DEFAULT_CONTENT.effortSplit}
      weeklyTargets={weeklyTargetsFrom(DEFAULT_CONTENT)} userTargets={{}} logs={[]} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t("perf.title"));
    expect(screen.getByText(t("perf.hiddenTitle"))).toBeInTheDocument();
    for (const a of [...hidden, ...visible]) expect(screen.getByText(a.label)).toBeInTheDocument();
  });

  it("delegates logging and target edits to the callbacks", async () => {
    const user = userEvent.setup();
    const onLog = vi.fn(); const onSetWeeklyTarget = vi.fn();
    const first = hidden[0];
    render(<PerformanceScreen t={t} hidden={[first]} visible={[]} effortSplit={DEFAULT_CONTENT.effortSplit}
      weeklyTargets={{ [first.id]: 5 }} userTargets={{}} logs={[]} onLog={onLog} onSetWeeklyTarget={onSetWeeklyTarget} />);
    // "+" logs one for today (day view)
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);
    expect(onLog).toHaveBeenCalledWith(first.id, ymd(new Date()), "day");
    // edit targets → "+" bumps the daily target and stores a weekly base
    await user.click(screen.getByRole("button", { name: t("perf.editTargets") }));
    const after = screen.getAllByRole("button");
    await user.click(after[after.length - 1]);
    expect(onSetWeeklyTarget).toHaveBeenCalled();
    expect(onSetWeeklyTarget.mock.calls[0][2]).toMatchObject({ period: "day" });
  });
});
