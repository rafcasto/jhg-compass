"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  paths, createDoc, updateRecord, deleteRecord, setDoc, useLiveCollection, useLiveDoc,
} from "@/lib/firestore/db";
import {
  HIDDEN_CATEGORIES, VISIBLE_CATEGORIES, EFFORT_SPLIT,
  DEFAULT_WEEKLY_TARGETS, type ActivityCategory,
} from "@/lib/categories";
import type { ActivityLog } from "@/lib/types";
import {
  type Period, rangeYmd, shift, periodLabel, scaleTarget, toWeekly, inRange, ymd,
  rag, RAG_BAR, RAG_TEXT,
} from "@/lib/period";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

const PERIODS: Period[] = ["day", "week", "month"];
const UNIT: Record<Period, string> = { day: "day", week: "week", month: "month" };

export default function TrackerPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [period, setPeriod] = useState<Period>("day");
  const [anchor, setAnchor] = useState(() => new Date());

  const { data: logs } = useLiveCollection<ActivityLog>(uid, paths.activityLogs, "createdAt");
  const { data: targetDoc } = useLiveDoc<{ targets: Record<string, number> }>(uid ? paths.settingsTargets(uid) : null);
  const userTargets = targetDoc?.targets ?? {};

  const range = rangeYmd(period, anchor);
  const weeklyTarget = (id: string) => userTargets[id] ?? DEFAULT_WEEKLY_TARGETS[id] ?? 0;
  const periodTarget = (id: string) => scaleTarget(weeklyTarget(id), period, anchor);

  const actuals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const l of logs) if (inRange(l.loggedOn, range)) acc[l.categoryId] = (acc[l.categoryId] ?? 0) + (l.count ?? 1);
    return acc;
  }, [logs, range]);

  const sum = (cats: ActivityCategory[], pick: (id: string) => number) => cats.reduce((s, c) => s + pick(c.id), 0);
  const hiddenA = sum(HIDDEN_CATEGORIES, (id) => actuals[id] ?? 0);
  const visibleA = sum(VISIBLE_CATEGORIES, (id) => actuals[id] ?? 0);
  const total = hiddenA + visibleA;
  const hiddenPct = total ? Math.round((hiddenA / total) * 100) : 0;

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
  // Edit the goal in the CURRENT period; we convert and store one weekly base,
  // so day/week/month all reflect the change.
  async function setGoal(catId: string, enteredForPeriod: number) {
    if (!uid) return;
    const weekly = toWeekly(enteredForPeriod, period, anchor);
    await setDoc(paths.settingsTargets(uid), { targets: { ...userTargets, [catId]: weekly } }, { merge: true });
    track(TAGS.SET_TARGET, { props: { categoryId: catId, period, value: enteredForPeriod } });
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="eyebrow">Activity Tracker</span>
        <h1 className="mt-1">Actual vs Target</h1>
        <p className="text-jh-mute mt-1 text-sm">
          Set your goal per <strong className="text-jh-ink">{UNIT[period]}</strong> — it scales to day, week &amp; month automatically.
        </p>
      </div>

      {/* period toggle + nav */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-pill bg-jh-mist p-1 self-start">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`rounded-pill px-4 py-1.5 text-sm font-display font-semibold capitalize transition ${period === p ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute"}`}>{p}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor(shift(period, anchor, -1))} className="rounded-full p-2 hover:bg-jh-mist"><ChevronLeft className="h-5 w-5" /></button>
          <span className="font-display font-semibold min-w-36 text-center">{periodLabel(period, anchor)}</span>
          <button onClick={() => setAnchor(shift(period, anchor, 1))} className="rounded-full p-2 hover:bg-jh-mist"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      {/* 80/20 balance */}
      <div className="card p-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-jh-red font-semibold">Hidden {hiddenPct}%</span>
          <span className="text-rb-blue font-semibold">Visible {100 - hiddenPct}%</span>
        </div>
        <div className="h-2.5 rounded-pill bg-jh-blue-grey overflow-hidden">
          <div className="bg-jh-red h-full" style={{ width: `${hiddenPct}%` }} />
        </div>
        <p className="text-[11px] text-jh-mute mt-1">Aim for {EFFORT_SPLIT.hidden}% hidden / {EFFORT_SPLIT.visible}% visible · {total} activities this {UNIT[period]}.</p>
      </div>

      <CategoryGroup title="🕵️ Hidden Job Market" subtitle="~80% of your effort" cats={HIDDEN_CATEGORIES}
        actuals={actuals} periodTarget={periodTarget} unit={UNIT[period]}
        onAdd={add} onRemove={remove} onGoal={setGoal} accent="red" />
      <CategoryGroup title="📋 Visible Job Market" subtitle="≤20% of your effort" cats={VISIBLE_CATEGORIES}
        actuals={actuals} periodTarget={periodTarget} unit={UNIT[period]}
        onAdd={add} onRemove={remove} onGoal={setGoal} accent="blue" />

      <div className="flex items-center gap-4 justify-center text-xs text-jh-mute pt-1">
        <Legend cls="bg-rb-green-dark" label="On / above goal" />
        <Legend cls="bg-rb-orange" label="Halfway" />
        <Legend cls="bg-jh-red" label="Behind" />
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${cls}`} /> {label}</span>;
}

function CategoryGroup({
  title, subtitle, cats, actuals, periodTarget, unit, onAdd, onRemove, onGoal, accent,
}: {
  title: string; subtitle: string; cats: ActivityCategory[];
  actuals: Record<string, number>; periodTarget: (id: string) => number; unit: string;
  onAdd: (id: string) => void; onRemove: (id: string) => void; onGoal: (id: string, v: number) => void;
  accent: "red" | "blue";
}) {
  return (
    <section className="card overflow-hidden">
      <div className={`px-4 py-3 ${accent === "red" ? "bg-jh-red-soft" : "bg-jh-blue-grey"}`}>
        <h3 className="text-base">{title}</h3>
        <p className="text-xs text-jh-mute">{subtitle}</p>
      </div>
      <ul className="divide-y divide-jh-line">
        {cats.map((c) => {
          const a = actuals[c.id] ?? 0;
          const t = periodTarget(c.id);
          const status = rag(a, t);
          const pct = t > 0 ? Math.min(100, Math.round((a / t) * 100)) : a > 0 ? 100 : 0;
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl shrink-0">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-body font-semibold text-jh-ink leading-snug">{c.label}</p>
                {/* RAG progress bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-pill bg-jh-mist overflow-hidden">
                    <div className={`h-full rounded-pill ${RAG_BAR[status]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-xs font-display font-bold ${RAG_TEXT[status]}`}>{a}/{t}</span>
                </div>
                {/* per-period editable goal */}
                <label className="mt-1 flex items-center gap-1 text-xs text-jh-mute">
                  Goal /{unit}:
                  <input type="number" min={0} value={t}
                    onChange={(e) => onGoal(c.id, Number(e.target.value))}
                    className="w-12 rounded border border-jh-line px-1 py-0.5 text-center text-jh-ink" />
                </label>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onRemove(c.id)} disabled={a === 0}
                  className="grid h-8 w-8 place-items-center rounded-full border border-jh-line text-jh-mute hover:bg-jh-mist disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                <span className="w-7 text-center font-display font-bold text-lg text-jh-ink">{a}</span>
                <button onClick={() => onAdd(c.id)} className="grid h-8 w-8 place-items-center rounded-full bg-jh-red text-white hover:bg-jh-red-hover"><Plus className="h-4 w-4" /></button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
