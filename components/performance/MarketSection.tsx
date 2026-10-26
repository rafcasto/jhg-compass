import type { ReactNode } from "react";
import type { Activity } from "@/lib/types";
import type { Market } from "@/lib/categories";
import { fillTemplate } from "@/lib/content";

// One job-market section — banner + rows — shared by the Performance tab and
// onboarding step 3 ("Set daily targets"). Both screens build their sections from
// marketSections() so the order, the tints and the responsive row grid are decided
// once, here, and can't drift between the two.
//
// Layout: the rows sit in `.market-rows` (app/globals.css) — one column on a phone
// and inside the admin's 390px preview, two columns once the surrounding
// `.market-screen` is ≥ 860px wide. That is a container query on the screen, not the
// viewport, so a phone preview on a desktop admin page still renders the phone layout.

export type MarketTint = "blue" | "mist";

/** Display order on both screens: the visible market (the short list) first, the hidden market below. */
export const MARKET_ORDER: readonly Market[] = ["visible", "hidden"];

/** The hidden market keeps the emphasised blue-grey tint wherever it sits; the visible market is neutral mist. */
export const MARKET_TINT: Record<Market, MarketTint> = { hidden: "blue", visible: "mist" };

export interface MarketSectionModel {
  market: Market;
  cats: Activity[];
  emoji: string;
  main: string;
  subtitle: string;
  tint: MarketTint;
}

/** The two market sections, in display order, with their admin-authored copy resolved. */
export function marketSections({ t, hidden, visible, effortSplit }: {
  t: (key: string) => string;
  hidden: Activity[];
  visible: Activity[];
  effortSplit: { hidden: number; visible: number };
}): MarketSectionModel[] {
  const by: Record<Market, MarketSectionModel> = {
    hidden: {
      market: "hidden", cats: hidden, tint: MARKET_TINT.hidden,
      emoji: t("perf.hiddenEmoji"), main: t("perf.hiddenTitle"),
      subtitle: fillTemplate(t("perf.effortNote"), { pct: effortSplit.hidden }),
    },
    visible: {
      market: "visible", cats: visible, tint: MARKET_TINT.visible,
      emoji: t("perf.visibleEmoji"), main: t("perf.visibleTitle"),
      subtitle: fillTemplate(t("perf.effortNote"), { pct: effortSplit.visible }),
    },
  };
  return MARKET_ORDER.map((m) => by[m]);
}

export function MarketBanner({ emoji, main, subtitle, tint }: { emoji: string; main: string; subtitle: string; tint: MarketTint }) {
  return (
    <div className={`flex items-center gap-3 rounded-md p-4 ${tint === "blue" ? "bg-jh-blue-grey" : "bg-jh-mist"}`}>
      {/* Emoji is admin-authored content; the circle gives it a consistent footprint next to the Lucide set. */}
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 text-xl leading-none">{emoji}</span>
      <div className="min-w-0">
        <div className="font-display text-base font-bold leading-tight text-jh-ink">{main}</div>
        <div className="mt-0.5 text-[13px] text-jh-body">{subtitle}</div>
      </div>
    </div>
  );
}

/** Banner + a responsive grid of rows. Children are the rows themselves (one element per activity). */
export function MarketSection({ section, children }: { section: MarketSectionModel; children: ReactNode }) {
  const { emoji, main, subtitle, tint } = section;
  return (
    <section>
      <MarketBanner emoji={emoji} main={main} subtitle={subtitle} tint={tint} />
      <div className="market-rows">{children}</div>
    </section>
  );
}
