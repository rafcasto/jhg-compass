"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { fillTemplate } from "@/lib/content";
import type { Activity, ActivityLog } from "@/lib/types";
import {
  type Period, rangeYmd, shift, periodLabel, scaleTarget, toWeekly, inRange, ymd,
} from "@/lib/period";
import { resolveWeeklyTarget } from "@/lib/targets";
import PageHeader from "@/components/shell/PageHeader";
import Segmented from "@/components/shell/Segmented";

const PERIODS: Period[] = ["day", "week", "month"];

// The Performance tab, minus the data plumbing. The page (app/(app)/performance)
// feeds it live Firestore data; Admin → CMS → Performance feeds it draft copy and
// sample data so what the editor previews is the real screen, not a mock.
//
// Styling is brand tokens only (tailwind.config.ts) — no local colour table — so
// the tab can't drift from Compass / Progress. Colour rules (red budget):
//   • ink while a period is in progress, green once the target is met,
//   • red only when the period has CLOSED below target (a genuine negative state),
//   • one red button on screen at most: "Edit targets" while editing.
export interface PerformanceScreenProps {
  /** Editable-string lookup (config/content.text). */
  t: (key: string) => string;
  hidden: Activity[];
  visible: Activity[];
  effortSplit: { hidden: number; visible: number };
  /** Admin default weekly targets, by activity id. */
  weeklyTargets: Record<string, number>;
  /** The member's own overrides, by activity id. */
  userTargets: Record<string, number>;
  logs: ActivityLog[];
  onLog?: (categoryId: string, loggedOn: string, period: Period) => void | Promise<void>;
  onUnlog?: (latest: ActivityLog, period: Period) => void | Promise<void>;
  onSetWeeklyTarget?: (categoryId: string, weekly: number, meta: { period: Period; value: number }) => void | Promise<void>;
  /** Fix "today" — used by previews/tests so the header date is stable. */
  now?: Date;
}

export default function PerformanceScreen({
  t, hidden, visible, effortSplit, weeklyTargets, userTargets, logs,
  onLog, onUnlog, onSetWeeklyTarget, now,
}: PerformanceScreenProps) {
  const [period, setPeriod] = useState<Period>("day");
  const [anchor, setAnchor] = useState(() => now ?? new Date());
  const [editAll, setEditAll] = useState(false);
  const [editRows, setEditRows] = useState<Record<string, boolean>>({});

  const range = rangeYmd(period, anchor);
  // Source of truth for target resolution — shared with onboarding (lib/targets.ts).
  const weeklyTarget = (id: string) => resolveWeeklyTarget(id, userTargets, weeklyTargets);
  const periodTarget = (id: string) => scaleTarget(weeklyTarget(id), period, anchor);

  const actuals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const l of logs) if (inRange(l.loggedOn, range)) acc[l.categoryId] = (acc[l.categoryId] ?? 0) + (l.count ?? 1);
    return acc;
  }, [logs, range]);

  const todayKey = ymd(now ?? new Date());
  const logOn = period === "day" ? range.start : inRange(todayKey, range) ? todayKey : range.end;
  // A period that has fully elapsed: "below target" is now a result, not a status.
  const closed = range.end < todayKey;

  async function add(catId: string) { await onLog?.(catId, logOn, period); }
  async function remove(catId: string) {
    const latest = logs
      .filter((l) => l.categoryId === catId && inRange(l.loggedOn, range))
      .sort((a, b) => (b.loggedOn > a.loggedOn ? 1 : -1))[0];
    if (!latest) return;
    await onUnlog?.(latest, period);
  }
  // Edit the goal for the CURRENT period; stored as one weekly base so day/week/month all reflect it.
  async function setGoal(catId: string, enteredForPeriod: number) {
    const weekly = toWeekly(Math.max(0, enteredForPeriod), period, anchor);
    await onSetWeeklyTarget?.(catId, weekly, { period, value: enteredForPeriod });
  }

  function toggleEditAll() {
    setEditAll((prev) => { if (prev) setEditRows({}); return !prev; });
  }
  const startEdit = (id: string) => setEditRows((r) => ({ ...r, [id]: true }));
  const finishRow = (id: string) => setEditRows((r) => { const n = { ...r }; delete n[id]; return n; });

  const rowProps = {
    editAll, editRows, closed, periodTarget, actuals, add, remove, setGoal, startEdit, finishRow,
    actualLabel: t("perf.actual"), targetLabel: t("perf.target"),
    setGoalLabel: t("perf.setGoal"), setTargetHint: t("perf.setTargetHint"),
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-4">
        <PageHeader
          eyebrow={t("perf.eyebrow")}
          title={t("perf.title")}
          actions={
            <button type="button" onClick={toggleEditAll} aria-pressed={editAll}
              className={`${editAll ? "btn-primary" : "btn-secondary"} btn-sm`}>
              {editAll ? t("perf.done") : t("perf.editTargets")}
            </button>
          }
        />

        <Segmented fill label="Period" value={period} onChange={setPeriod}
          items={PERIODS.map((p) => ({ key: p, label: p[0].toUpperCase() + p.slice(1) }))} />

        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={() => setAnchor(shift(period, anchor, -1))} aria-label="Previous" className="icon-btn">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </button>
          <span className="min-w-[10rem] text-center font-display text-base font-semibold text-jh-ink">{periodLabel(period, anchor)}</span>
          <button type="button" onClick={() => setAnchor(shift(period, anchor, 1))} aria-label="Next" className="icon-btn">
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>

      {/* Hidden job market — the bulk of success (top) */}
      <section>
        <Banner emoji={t("perf.hiddenEmoji")} main={t("perf.hiddenTitle")}
          subtitle={fillTemplate(t("perf.effortNote"), { pct: effortSplit.hidden })} tint="blue" />
        <Rows cats={hidden} {...rowProps} />
      </section>

      {/* Visible job market (bottom) — neutral tint: nothing is wrong with it, it's just the smaller share. */}
      <section>
        <Banner emoji={t("perf.visibleEmoji")} main={t("perf.visibleTitle")}
          subtitle={fillTemplate(t("perf.effortNote"), { pct: effortSplit.visible })} tint="mist" />
        <Rows cats={visible} {...rowProps} />
      </section>

      <p className="text-center text-[13px] text-jh-mute">{t("perf.footer")}</p>
    </div>
  );
}

function Banner({ emoji, main, subtitle, tint }: { emoji: string; main: string; subtitle: string; tint: "blue" | "mist" }) {
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

interface RowProps {
  cats: Activity[];
  editAll: boolean;
  editRows: Record<string, boolean>;
  closed: boolean;
  periodTarget: (id: string) => number;
  actuals: Record<string, number>;
  add: (id: string) => void;
  remove: (id: string) => void;
  setGoal: (id: string, v: number) => void;
  startEdit: (id: string) => void;
  finishRow: (id: string) => void;
  actualLabel: string;
  targetLabel: string;
  setGoalLabel: string;
  setTargetHint: string;
}

function Rows({ cats, editAll, editRows, closed, periodTarget, actuals, add, remove, setGoal, startEdit, finishRow, actualLabel, targetLabel, setGoalLabel, setTargetHint }: RowProps) {
  return (
    <div>
      {cats.map((c) => {
        const a = actuals[c.id] ?? 0;
        const t = periodTarget(c.id);
        const hasGoal = t > 0;
        const done = hasGoal && a >= t;
        const missed = hasGoal && closed && !done;
        const editing = editAll || !!editRows[c.id];
        const perRowEdit = !editAll && !!editRows[c.id];

        const actualCls = done ? "text-rb-green-dark" : missed ? "text-jh-red" : "text-jh-ink";
        const targetText = hasGoal || editing ? String(t) : "—";
        const decDisabled = editing ? t <= 0 : a <= 0;
        const onDec = () => (editing ? setGoal(c.id, t - 1) : remove(c.id));
        const onInc = () => (editing ? setGoal(c.id, t + 1) : add(c.id));

        return (
          <div key={c.id} className="flex items-start gap-4 border-b border-jh-line py-4">
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-semibold leading-snug text-jh-ink">{c.label}</div>

              {hasGoal && !editing && <div className="mt-3"><Bar a={a} t={t} done={done} missed={missed} /></div>}

              {!hasGoal && !editing && (
                <button type="button" onClick={() => startEdit(c.id)}
                  className="mt-2 inline-flex items-center gap-1 rounded-pill bg-jh-mist px-3 py-1.5 font-display text-xs font-semibold text-jh-ink transition-colors duration-200 ease-out hover:bg-jh-blue-grey">
                  <Plus className="h-3.5 w-3.5" aria-hidden /> {setGoalLabel}
                </button>
              )}

              {editing && <div className="mt-2 text-xs text-jh-mute">{setTargetHint}</div>}
            </div>

            <div className="w-40 flex-none">
              {/* Actual leads (24/700); target is context (16/500 mute). */}
              <div className="grid items-end" style={{ gridTemplateColumns: "1fr 16px 1fr" }}>
                <Label>{actualLabel}</Label>
                <div />
                <Label>{targetLabel}</Label>
                <div className={`mt-1 text-center font-display text-2xl font-bold leading-none ${actualCls}`}>{a}</div>
                <div aria-hidden className="mt-1 text-center font-display text-lg font-light leading-none text-jh-mute-2">/</div>
                <div className={`mt-1 text-center font-display text-base font-medium leading-none ${hasGoal || editing ? "text-jh-mute" : "text-jh-mute-2"}`}>{targetText}</div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                {perRowEdit && (
                  <button type="button" onClick={() => finishRow(c.id)} className="btn-ghost btn-sm">Done</button>
                )}
                <button type="button" onClick={onDec} disabled={decDisabled}
                  aria-label={`${editing ? "Lower target" : "Remove one"}: ${c.label}`}
                  className="grid h-10 w-10 place-items-center rounded-pill border border-jh-line-2 bg-white text-jh-mute transition-colors duration-200 ease-out hover:border-jh-ink hover:text-jh-ink disabled:opacity-40 disabled:hover:border-jh-line-2 disabled:hover:text-jh-mute">
                  <Minus className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                </button>
                <button type="button" onClick={onInc}
                  aria-label={`${editing ? "Raise target" : "Log one"}: ${c.label}`}
                  className={`grid h-10 w-10 place-items-center rounded-pill border bg-white transition-colors duration-200 ease-out
                    ${done && !editing
                      ? "border-rb-green-dark text-rb-green-dark hover:bg-rb-green-dark hover:text-white"
                      : "border-jh-ink text-jh-ink hover:bg-jh-ink hover:text-white"}`}>
                  <Plus className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
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
