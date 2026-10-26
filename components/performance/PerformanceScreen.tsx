"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import type { Activity, ActivityLog } from "@/lib/types";
import {
  type Period, rangeYmd, shift, periodLabel, displayTarget, isWorkday, inRange, ymd,
} from "@/lib/period";
import { resolveWeeklyTarget, type WeeklyTargets } from "@/lib/targets";
import PageHeader from "@/components/shell/PageHeader";
import Segmented from "@/components/shell/Segmented";
import { MarketSection, marketSections } from "@/components/performance/MarketSection";
import TargetsSheet from "@/components/performance/TargetsSheet";

const PERIODS: Period[] = ["day", "week", "month"];

// The Performance tab, minus the data plumbing. The page (app/(app)/performance)
// feeds it live Firestore data; Admin → CMS → Performance feeds it draft copy and
// sample data so what the editor previews is the real screen, not a mock.
//
// Targets are WEEKLY, logging is DAILY (docs/UX_PERFORMANCE_TARGETS.md):
//   • − / + on a row only ever log an actual. There is no edit mode.
//   • Targets are set in one place — the Targets sheet — opened by "Edit targets"
//     or by tapping a row's target figure (the number you want to change).
//   • Day and month targets are derived from the weekly base for display (shown
//     with a ~). A row whose weekly target is under 5 (or on a weekend) shows the
//     weekly figure with its unit and tracks the week, so no target ever reads "0".
//   • Week is the default period: it is the stored unit and nothing is rounded.
// Styling is brand tokens only (tailwind.config.ts). Each row is a CSS grid
// (.perf-row): stacked on a phone, one table-like line from 800px of screen width.
// Colour (red budget): ink while in progress, green once met, red only when the
// period has CLOSED below target; the one primary button is the sheet's Done.
export interface PerformanceScreenProps {
  /** Editable-string lookup (config/content.text). */
  t: (key: string) => string;
  hidden: Activity[];
  visible: Activity[];
  effortSplit: { hidden: number; visible: number };
  /** Admin default weekly targets, by activity id. */
  weeklyTargets: WeeklyTargets;
  /** The member's own overrides, by activity id. */
  userTargets: WeeklyTargets;
  logs: ActivityLog[];
  onLog?: (categoryId: string, loggedOn: string, period: Period) => void | Promise<void>;
  onUnlog?: (latest: ActivityLog, period: Period) => void | Promise<void>;
  /** Weekly rows to write (set) and overrides to drop (unset) when the Targets sheet closes with changes. */
  onSaveTargets?: (edits: { set: WeeklyTargets; unset: string[] }) => void | Promise<void>;
  /** Fix "today" — used by previews/tests so the header date is stable. */
  now?: Date;
}

export default function PerformanceScreen({
  t, hidden, visible, effortSplit, weeklyTargets, userTargets, logs,
  onLog, onUnlog, onSaveTargets, now,
}: PerformanceScreenProps) {
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(() => now ?? new Date());
  const [sheet, setSheet] = useState<{ focusId?: string } | null>(null);

  const range = rangeYmd(period, anchor);
  const weekRange = rangeYmd("week", anchor);
  const todayKey = ymd(now ?? new Date());

  // Source of truth for target resolution — shared with onboarding (lib/targets.ts).
  const weeklyTarget = (id: string) => resolveWeeklyTarget(id, userTargets, weeklyTargets);

  const sumIn = (r: { start: string; end: string }) => {
    const acc: Record<string, number> = {};
    for (const l of logs) if (inRange(l.loggedOn, r)) acc[l.categoryId] = (acc[l.categoryId] ?? 0) + (l.count ?? 1);
    return acc;
  };
  const actuals = useMemo(() => sumIn(range), [logs, range.start, range.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const actualsWeek = useMemo(() => sumIn(weekRange), [logs, weekRange.start, weekRange.end]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per row: the target to show and the window the ACTUAL counts over. A row that
  // falls back to its weekly figure in Day view counts the week so the two agree.
  function rowModel(id: string) {
    const disp = displayTarget(weeklyTarget(id), period, anchor);
    const weekly = period === "day" && disp.unit === "week";
    const r = weekly ? weekRange : range;
    const a = (weekly ? actualsWeek : actuals)[id] ?? 0;
    // A window that has fully elapsed: "below target" is a result, not a status.
    // A weekend day in Day view never closes short — it carries no daily share.
    const closed = r.end < todayKey && (period !== "day" || weekly || isWorkday(anchor));
    return { disp, a, closed, unitSuffix: weekly ? " / wk" : "" };
  }

  const logOn = period === "day" ? range.start : inRange(todayKey, range) ? todayKey : range.end;
  async function add(catId: string) { await onLog?.(catId, logOn, period); }
  async function remove(catId: string) {
    const latest = logs
      .filter((l) => l.categoryId === catId && inRange(l.loggedOn, range))
      .sort((a, b) => (b.loggedOn > a.loggedOn ? 1 : -1))[0];
    if (!latest) return;
    await onUnlog?.(latest, period);
  }

  const rowProps = {
    rowModel, add, remove, openTargets: (id?: string) => setSheet({ focusId: id }),
    actualLabel: t("perf.actual"), targetLabel: t("perf.target"), setGoalLabel: t("perf.setGoal"),
  };

  return (
    <div className="market-screen space-y-6">
      <div className="space-y-4">
        <PageHeader
          eyebrow={t("perf.eyebrow")}
          title={t("perf.title")}
          actions={
            <button type="button" onClick={() => setSheet({})} className="btn-secondary btn-sm">
              {t("perf.editTargets")}
            </button>
          }
        />

        <div className="perf-toolbar">
          <div className="perf-period">
            <Segmented fill label="Period" value={period} onChange={setPeriod}
              items={PERIODS.map((p) => ({ key: p, label: p[0].toUpperCase() + p.slice(1) }))} />
          </div>

          <div className="perf-nav">
            <button type="button" onClick={() => setAnchor(shift(period, anchor, -1))} aria-label="Previous" className="icon-btn">
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </button>
            <span className="min-w-[10rem] text-center font-display text-base font-semibold text-jh-ink">{periodLabel(period, anchor)}</span>
            <button type="button" onClick={() => setAnchor(shift(period, anchor, 1))} aria-label="Next" className="icon-btn">
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* Visible market first (the short list), hidden market below — order and tints from MarketSection. */}
      {marketSections({ t, hidden, visible, effortSplit }).map((section) => (
        <MarketSection key={section.market} section={section} head={<PerfHead actualLabel={rowProps.actualLabel} targetLabel={rowProps.targetLabel} />}>
          <Rows cats={section.cats} {...rowProps} />
        </MarketSection>
      ))}

      {sheet && (
        <TargetsSheet t={t} hidden={hidden} visible={visible} effortSplit={effortSplit}
          weeklyTargets={weeklyTargets} userTargets={userTargets} focusId={sheet.focusId}
          onClose={() => setSheet(null)} onSave={onSaveTargets} />
      )}
    </div>
  );
}

interface RowProps {
  cats: Activity[];
  rowModel: (id: string) => { disp: { value: number; derived: boolean }; a: number; closed: boolean; unitSuffix: string };
  add: (id: string) => void;
  remove: (id: string) => void;
  openTargets: (id?: string) => void;
  actualLabel: string;
  targetLabel: string;
  setGoalLabel: string;
}

// Column labels shown once per section on desktop (.perf-head is display:none on a
// phone, where each row carries its own). Decorative: the row cells keep their labels.
function PerfHead({ actualLabel, targetLabel }: { actualLabel: string; targetLabel: string }) {
  return (
    <div className="perf-head" aria-hidden>
      <div className="perf-head-nums"><Label>{actualLabel}</Label><div /><Label>{targetLabel}</Label></div>
    </div>
  );
}

// Rows are direct children of the section's `.market-rows`. Each row is one grid
// (.perf-row): areas label · bar · nums · actions, re-flowed by the container query.
function Rows({ cats, rowModel, add, remove, openTargets, actualLabel, targetLabel, setGoalLabel }: RowProps) {
  return (
    <>
      {cats.map((c) => {
        const { disp, a, closed, unitSuffix } = rowModel(c.id);
        const tv = disp.value;
        const hasGoal = tv > 0;
        const done = hasGoal && a >= tv;
        const missed = hasGoal && closed && !done;
        const actualCls = done ? "text-rb-green-dark" : missed ? "text-jh-red" : "text-jh-ink";
        const targetText = hasGoal ? `${disp.derived ? "~" : ""}${tv}${unitSuffix}` : "—";

        return (
          <div key={c.id} className="perf-row border-b border-jh-line">
            <div className="perf-row-label font-display text-base font-semibold leading-snug text-jh-ink">{c.label}</div>

            {/* Bar slot: the bullet bar, or the quiet "set a target" action for a row without one. */}
            <div className="perf-row-bar">
              {hasGoal && <Bar a={a} t={tv} done={done} missed={missed} />}
              {!hasGoal && (
                <button type="button" onClick={() => openTargets(c.id)}
                  className="perf-set-goal bg-jh-mist font-display text-xs font-semibold text-jh-ink hover:bg-jh-blue-grey">
                  <Plus className="h-3.5 w-3.5" aria-hidden /> {setGoalLabel}
                </button>
              )}
            </div>

            {/* Actual leads (24/700); target is context (16/500 mute) and is the way in to change it. */}
            <div className="perf-row-nums">
              <div className="perf-row-labels"><Label>{actualLabel}</Label><div /><Label>{targetLabel}</Label></div>
              <div className={`text-center font-display text-2xl font-bold leading-none ${actualCls}`}>{a}</div>
              <div aria-hidden className="text-center font-display text-lg font-light leading-none text-jh-mute-2">/</div>
              <button type="button" onClick={() => openTargets(c.id)} aria-label={`Change target: ${c.label}`}
                title={`${targetLabel} ${targetText}`}
                className={`-my-2 min-h-[40px] rounded-xs px-1 text-center font-display text-base font-medium leading-none transition-colors duration-200 ease-out hover:bg-jh-mist hover:text-jh-ink whitespace-nowrap ${hasGoal ? "text-jh-mute" : "text-jh-mute-2"}`}>
                {targetText}
              </button>
            </div>

            <div className="perf-row-actions">
              <button type="button" onClick={() => remove(c.id)} disabled={a <= 0}
                aria-label={`Remove one: ${c.label}`}
                className="grid h-10 w-10 place-items-center rounded-pill border border-jh-line-2 bg-white text-jh-mute transition-colors duration-200 ease-out hover:border-jh-ink hover:text-jh-ink disabled:opacity-40 disabled:hover:border-jh-line-2 disabled:hover:text-jh-mute">
                <Minus className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </button>
              <button type="button" onClick={() => add(c.id)}
                aria-label={`Log one: ${c.label}`}
                className={`grid h-10 w-10 place-items-center rounded-pill border bg-white transition-colors duration-200 ease-out
                  ${done
                    ? "border-rb-green-dark text-rb-green-dark hover:bg-rb-green-dark hover:text-white"
                    : "border-jh-ink text-jh-ink hover:bg-jh-ink hover:text-white"}`}>
                <Plus className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="section-label text-center">{children}</div>;
}

// Bullet bar: track + value fill + target tick. Fill is ink while in progress,
// green when met, red only once the period has closed short.
function Bar({ a, t, done, missed }: { a: number; t: number; done: boolean; missed: boolean }) {
  const maxScale = Math.max(Math.ceil(t * 1.6), a, 4);
  const fillPct = Math.min(a / maxScale, 1) * 100;
  const tickPct = Math.min(t / maxScale, 1) * 100;
  const fill = done ? "bg-rb-green-dark" : missed ? "bg-jh-red" : "bg-jh-ink";
  return (
    <div className="relative h-[22px]" role="img" aria-label={`${a} of ${t}`}>
      <div className="absolute inset-x-0 top-[5px] h-3 rounded-pill bg-jh-blue-grey" />
      <div className={`absolute left-0 top-[5px] h-3 rounded-pill ${fill}`}
        style={{ width: `${fillPct}%`, transition: "width .45s cubic-bezier(.2,.7,.2,1)" }} />
      <div className="absolute top-0 h-[22px] w-[3px] rounded-[2px] bg-jh-ink" style={{ left: `${tickPct}%`, transform: "translateX(-50%)" }} title={`Target ${t}`} />
    </div>
  );
}
