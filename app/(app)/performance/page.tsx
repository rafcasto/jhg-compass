"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  paths, createDoc, updateRecord, deleteRecord, setDoc, useLiveCollection, useLiveDoc,
} from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import { fillTemplate } from "@/lib/content";
import type { Activity, ActivityLog } from "@/lib/types";
import {
  type Period, rangeYmd, shift, periodLabel, scaleTarget, toWeekly, inRange, ymd,
} from "@/lib/period";
import { resolveWeeklyTarget, withTargetEdits } from "@/lib/targets";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

// Design tokens lifted from the handoff (JobHackers design system).
const C = {
  red: "#c2001f", ink: "#191c27", green: "#2f7a3a",
  mute: "#6b7280", muteLight: "#9aa0ad", slash: "#c5c9d2", disabled: "#d4d8e2",
  track: "#e3e9f4", line: "#eef0f5", circle: "#e6e8ef",
  toggleBg: "#f3f5fa", bannerBlue: "#e2ebfb", bannerRed: "#fbe3e6", pillRed: "#f6e0e3",
};

const PERIODS: Period[] = ["day", "week", "month"];

export default function PerformancePage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const content = useContent();
  const { t, hidden, visible, weeklyTargets, effortSplit } = content;
  const [period, setPeriod] = useState<Period>("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [editAll, setEditAll] = useState(false);
  const [editRows, setEditRows] = useState<Record<string, boolean>>({});

  const { data: logs } = useLiveCollection<ActivityLog>(uid, paths.activityLogs, "createdAt");
  const { data: targetDoc } = useLiveDoc<{ targets: Record<string, number> }>(uid ? paths.settingsTargets(uid) : null);
  const userTargets = targetDoc?.targets ?? {};

  const range = rangeYmd(period, anchor);
  // Source of truth for target resolution — shared with onboarding (lib/targets.ts).
  const weeklyTarget = (id: string) => resolveWeeklyTarget(id, userTargets, weeklyTargets);
  const periodTarget = (id: string) => scaleTarget(weeklyTarget(id), period, anchor);

  const actuals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const l of logs) if (inRange(l.loggedOn, range)) acc[l.categoryId] = (acc[l.categoryId] ?? 0) + (l.count ?? 1);
    return acc;
  }, [logs, range]);

  const todayKey = ymd(new Date());
  const logOn = period === "day" ? range.start : inRange(todayKey, range) ? todayKey : range.end;

  async function add(catId: string) {
    if (!uid) return;
    await createDoc(paths.activityLogs(uid), { categoryId: catId, loggedOn: logOn, count: 1 });
    track(TAGS.LOG_ACTIVITY, { props: { categoryId: catId, period } });
  }
  async function remove(catId: string) {
    if (!uid) return;
    const latest = logs
      .filter((l) => l.categoryId === catId && inRange(l.loggedOn, range))
      .sort((a, b) => (b.loggedOn > a.loggedOn ? 1 : -1))[0];
    if (!latest) return;
    if ((latest.count ?? 1) > 1) await updateRecord(uid, "activityLogs", latest.id, { count: (latest.count ?? 1) - 1 });
    else await deleteRecord(uid, "activityLogs", latest.id);
    track(TAGS.UNLOG_ACTIVITY, { props: { categoryId: catId, period } });
  }
  // Edit the goal for the CURRENT period; stored as one weekly base so day/week/month all reflect it.
  async function setGoal(catId: string, enteredForPeriod: number) {
    if (!uid) return;
    const weekly = toWeekly(Math.max(0, enteredForPeriod), period, anchor);
    await setDoc(paths.settingsTargets(uid), { targets: withTargetEdits(userTargets, { [catId]: weekly }) }, { merge: true });
    track(TAGS.SET_TARGET, { props: { categoryId: catId, period, value: enteredForPeriod } });
  }

  function toggleEditAll() {
    setEditAll((prev) => { if (prev) setEditRows({}); return !prev; });
  }
  const startEdit = (id: string) => setEditRows((r) => ({ ...r, [id]: true }));
  const finishRow = (id: string) => setEditRows((r) => { const n = { ...r }; delete n[id]; return n; });

  const rowProps = {
    editAll, editRows, periodTarget, actuals, add, remove, setGoal, startEdit, finishRow,
    actualLabel: t("perf.actual"), targetLabel: t("perf.target"),
    setGoalLabel: t("perf.setGoal"), setTargetHint: t("perf.setTargetHint"),
  };

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* header */}
      <div>
        <div className="font-display font-semibold uppercase" style={{ fontSize: 11, letterSpacing: ".09em", color: C.red }}>
          {t("perf.eyebrow")}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <h1 className="font-display font-bold" style={{ fontSize: 27, letterSpacing: "-.02em", color: C.ink }}>{t("perf.title")}</h1>
          <button onClick={toggleEditAll}
            className="font-display font-semibold rounded-full transition"
            style={editAll
              ? { fontSize: 12.5, padding: "8px 15px", background: C.red, color: "#fff", border: `1.5px solid ${C.red}` }
              : { fontSize: 12.5, padding: "8px 15px", background: "#fff", color: C.ink, border: `1.5px solid ${C.disabled}` }}>
            {editAll ? t("perf.done") : t("perf.editTargets")}
          </button>
        </div>

        {/* period toggle */}
        <div className="flex gap-1 rounded-full p-1 mt-4" style={{ background: C.toggleBg }}>
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex-1 text-center font-display font-semibold capitalize rounded-full"
              style={period === p
                ? { fontSize: 13.5, padding: "8px 0", background: "#fff", color: C.ink, boxShadow: "0 1px 2px rgba(25,28,39,.08)" }
                : { fontSize: 13.5, padding: "8px 0", color: C.muteLight }}>
              {p}
            </button>
          ))}
        </div>

        {/* date nav */}
        <div className="flex items-center justify-center gap-6 mt-4 mb-1">
          <button onClick={() => setAnchor(shift(period, anchor, -1))} aria-label="Previous"><ChevronLeft className="h-5 w-5" style={{ color: C.muteLight }} /></button>
          <span className="font-display font-semibold" style={{ fontSize: 16, color: C.ink }}>{periodLabel(period, anchor)}</span>
          <button onClick={() => setAnchor(shift(period, anchor, 1))} aria-label="Next"><ChevronRight className="h-5 w-5" style={{ color: C.muteLight }} /></button>
        </div>
      </div>

      {/* Hidden job market — the bulk of success (top) */}
      <section>
        <Banner emoji={t("perf.hiddenEmoji")} main={t("perf.hiddenTitle")}
          subtitle={fillTemplate(t("perf.effortNote"), { pct: effortSplit.hidden })} bg={C.bannerBlue} />
        <Rows cats={hidden} {...rowProps} />
      </section>

      {/* Visible job market (bottom) */}
      <section>
        <Banner emoji={t("perf.visibleEmoji")} main={t("perf.visibleTitle")}
          subtitle={fillTemplate(t("perf.effortNote"), { pct: effortSplit.visible })} bg={C.bannerRed} />
        <Rows cats={visible} {...rowProps} />
      </section>

      <p className="text-center italic" style={{ fontSize: 12.5, color: C.muteLight }}>
        {t("perf.footer")}
      </p>
    </div>
  );
}

function Banner({ emoji, main, sub, subtitle, bg }: { emoji: string; main: string; sub?: string; subtitle: string; bg: string }) {
  return (
    <div className="rounded-2xl flex items-center gap-3" style={{ background: bg, padding: "15px 18px" }}>
      <span style={{ fontSize: 24, lineHeight: 1 }}>{emoji}</span>
      <div>
        <div className="font-display font-bold" style={{ fontSize: 16, lineHeight: 1.2, color: C.ink }}>
          {main}{sub ? <> <span className="font-semibold" style={{ color: C.mute }}>{sub}</span></> : null}
        </div>
        <div style={{ fontSize: 13, color: C.mute, marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

interface RowProps {
  cats: Activity[];
  editAll: boolean;
  editRows: Record<string, boolean>;
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

function Rows({ cats, editAll, editRows, periodTarget, actuals, add, remove, setGoal, startEdit, finishRow, actualLabel, targetLabel, setGoalLabel, setTargetHint }: RowProps) {
  return (
    <div>
      {cats.map((c) => {
        const a = actuals[c.id] ?? 0;
        const t = periodTarget(c.id);
        const hasGoal = t > 0;
        const done = hasGoal && a >= t;
        const editing = editAll || !!editRows[c.id];
        const perRowEdit = !editAll && !!editRows[c.id];

        const actualColor = done ? C.green : hasGoal ? C.red : C.slash;
        const targetText = hasGoal || editing ? String(t) : "—";
        const targetColor = hasGoal || editing ? C.ink : C.slash;
        const incColor = editing ? C.ink : done ? C.green : C.red;
        const incShadow = editing ? "rgba(25,28,39,.20)" : "rgba(194,0,31,.28)";
        const decColor = editing ? (t > 0 ? C.mute : C.disabled) : (a > 0 ? C.mute : C.disabled);
        const onDec = () => (editing ? setGoal(c.id, t - 1) : remove(c.id));
        const onInc = () => (editing ? setGoal(c.id, t + 1) : add(c.id));

        return (
          <div key={c.id} className="flex gap-4 items-start" style={{ padding: "18px 0", borderBottom: `1px solid ${C.line}` }}>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold" style={{ fontSize: 15, lineHeight: 1.3, color: C.ink }}>{c.label}</div>

              {hasGoal && !editing && <div style={{ marginTop: 13 }}><Bar a={a} t={t} done={done} /></div>}

              {!hasGoal && !editing && (
                <button onClick={() => startEdit(c.id)}
                  className="inline-flex items-center gap-1 font-display font-semibold rounded-full"
                  style={{ marginTop: 11, fontSize: 12.5, color: C.red, background: C.pillRed, padding: "6px 12px" }}>
                  <Plus className="h-3.5 w-3.5" /> {setGoalLabel}
                </button>
              )}

              {editing && <div className="italic" style={{ marginTop: 11, fontSize: 12.5, color: C.muteLight }}>{setTargetHint}</div>}
            </div>

            <div className="flex-none" style={{ width: 156 }}>
              <div className="grid items-center" style={{ gridTemplateColumns: "1fr 16px 1fr" }}>
                <Label>{actualLabel}</Label>
                <div />
                <Label>{targetLabel}</Label>
                <div className="text-center font-display font-bold" style={{ fontSize: 24, marginTop: 3, color: actualColor }}>{a}</div>
                <div className="text-center font-display font-light" style={{ fontSize: 22, marginTop: 3, color: C.slash }}>/</div>
                <div className="text-center font-display font-bold" style={{ fontSize: 24, marginTop: 3, color: targetColor }}>{targetText}</div>
              </div>

              <div className="flex justify-end items-center" style={{ gap: 11, marginTop: 12 }}>
                {perRowEdit && (
                  <button onClick={() => finishRow(c.id)} className="font-display font-semibold" style={{ fontSize: 12.5, color: C.red }}>Done</button>
                )}
                <button onClick={onDec} className="grid place-items-center rounded-full"
                  style={{ width: 36, height: 36, border: `1.5px solid ${C.circle}`, background: "#fff", color: decColor }}>
                  <Minus className="h-5 w-5" />
                </button>
                <button onClick={onInc} className="grid place-items-center rounded-full text-white"
                  style={{ width: 36, height: 36, background: incColor, boxShadow: `0 4px 12px ${incShadow}` }}>
                  <Plus className="h-5 w-5" />
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
  return (
    <div className="text-center font-display font-semibold uppercase" style={{ fontSize: 10.5, letterSpacing: ".07em", color: C.muteLight }}>
      {children}
    </div>
  );
}

// Bullet bar: track + value fill + target tick. Matches the handoff exactly.
function Bar({ a, t, done }: { a: number; t: number; done: boolean }) {
  const maxScale = Math.max(Math.ceil(t * 1.6), a, 4);
  const fillPct = Math.min(a / maxScale, 1) * 100;
  const tickPct = Math.min(t / maxScale, 1) * 100;
  const color = done ? C.green : C.red;
  return (
    <div className="relative" style={{ height: 22 }}>
      <div className="absolute rounded-full" style={{ top: 5, left: 0, right: 0, height: 12, background: C.track }} />
      <div className="absolute rounded-full" style={{ top: 5, left: 0, height: 12, width: `${fillPct}%`, background: color, transition: "width .45s cubic-bezier(.2,.7,.2,1)" }} />
      <div className="absolute" style={{ top: 0, left: `${tickPct}%`, transform: "translateX(-50%)", width: 3, height: 22, background: C.ink, borderRadius: 2 }} title={`Target ${t}`} />
    </div>
  );
}
