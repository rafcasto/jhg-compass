import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PerformanceScreen from "@/components/performance/PerformanceScreen";
import { MARKET_ORDER, MARKET_TINT, marketSections } from "@/components/performance/MarketSection";
import { DEFAULT_CONTENT, weeklyTargetsFrom } from "@/lib/content";

const t = (k: string) => DEFAULT_CONTENT.text[k] ?? "";
const hidden = DEFAULT_CONTENT.activities.filter((a) => a.market === "hidden");
const visible = DEFAULT_CONTENT.activities.filter((a) => a.market === "visible");

// The market sections are shared by the Performance tab and onboarding step 3 —
// one order, one tint per market, one row grid (decision 2026-10-26: visible first).
describe("MarketSection (shared by Performance and onboarding)", () => {
  it("lists the visible market first and keeps the emphasised tint on the hidden market", () => {
    expect(MARKET_ORDER).toEqual(["visible", "hidden"]);
    expect(MARKET_TINT).toEqual({ hidden: "blue", visible: "mist" });
    const sections = marketSections({ t, hidden, visible, effortSplit: DEFAULT_CONTENT.effortSplit });
    expect(sections.map((s) => s.market)).toEqual(["visible", "hidden"]);
    expect(sections[0].main).toBe(t("perf.visibleTitle"));
    expect(sections[0].subtitle).toContain(String(DEFAULT_CONTENT.effortSplit.visible));
    expect(sections[1].cats).toBe(hidden);
  });

  it("Performance renders the visible banner above the hidden one, rows inside the responsive grid, no fixed column", () => {
    const { container } = render(<PerformanceScreen t={t} hidden={hidden} visible={visible} effortSplit={DEFAULT_CONTENT.effortSplit}
      weeklyTargets={weeklyTargetsFrom(DEFAULT_CONTENT)} userTargets={{}} logs={[]} />);
    const v = screen.getByText(t("perf.visibleTitle"));
    const h = screen.getByText(t("perf.hiddenTitle"));
    expect(v.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const grids = container.querySelectorAll(".market-rows");
    expect(grids).toHaveLength(2);
    expect(grids[0].children).toHaveLength(visible.length);
    expect(grids[1].children).toHaveLength(hidden.length);
    expect(container.firstElementChild).toHaveClass("market-screen");
    expect(container.firstElementChild!.className).not.toMatch(/max-w-/);
  });
});
