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
import { Iceberg } from "@/components/icons";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

const PERIODS: Period[] = ["day", "week", "month"];
const UNIT: Record<Period, string> = { day: "day", week: "week", month: "month" };

type RagStatus = ReturnType<typeof rag>;

export default function PerformancePage() {
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
  async function setGoal(catId: string, enteredForPeriod: number) {
    if (!uid) return;
    const weekly = toWeekly(enteredForPeriod, period, anchor);
    await setDoc(paths.settingsTargets(uid), { targets: { ...userTargets, [catId]: weekly } }, { merge: true });
    track(TAGS.SET_TARGET, { props: { categoryId: catId, period, value: enteredForPeriod } });
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="eyebrow">Success predictors</span>
        <h1 className="mt-1">Performance</h1>
        <p className="text-jh-mute mt-1 text-sm">
          Success isn&apos;t luck — it&apos;s a set of activities. Log what you do per{" "}
          <strong className="text-jh-ink">{UNIT[period]}</strong> and track actual vs target.
        </p>
      </div>

      {/* Iceberg explainer */}
      <div className="card p-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-jh-blue-grey text-jh-ink">
          <Iceberg className="h-6 w-6" />
        </div>
        <p className="text-sm text-jh-mute leading-relaxed">
          Spend <strong className="text-jh-ink">{EFFORT_SPLIT.visible}% above the waterline</strong> (the visible job
          market) and <strong className="text-jh-ink">{EFFORT_SPLIT.hidden}% below it</strong> (the hidden job market).
          The single biggest driver of success: <strong className="text-jh-ink">contacting &amp; meeting people</strong>.
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

      <CategoryGroup title="🌊 Above the waterline — Visible job market" subtitle={`≤${EFFORT_SPLIT.visible}% of your effort`} cats={VISIBLE_CATEGORIES}
        actuals={actuals} periodTarget={periodTarget} unit={UNIT[period]}
        onAdd={add} onRemove={remove} onGoal={setGoal} accent="blue" />
      <CategoryGroup title="🧊 Below the waterline — Hidden job market" subtitle={`~${EFFORT_SPLIT.hidden}% of your effort · where the jobs really are`} cats={HIDDEN_CATEGORIES}
        actuals={actuals} periodTarget={periodTarget} unit={UNIT[period]}
        onAdd={add} onRemove={remove} onGoal={setGoal} accent="red" />

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-center text-xs text-jh-mute pt-1">
        <Legend cls="bg-rb-green-dark" label="On / above goal" />
        <Legend cls="bg-rb-orange" label="Halfway" />
        <Legend cls="bg-jh-red" label="Behind" />
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-[3px] rounded bg-jh-ink" /> Target</span>
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${cls}`} /> {label}</span>;
}

// Bullet ("bowling") chart — Actual vs Target. The coloured bar is the actual value,
// the grey bands are qualitative ranges relative to target, and the dark tick is the
// target. Full-width and stacked → mobile-first; scales cleanly on desktop.
function Bullet({ a, t, status }: { a: number; t: number; status: RagStatus }) {
  const max = Math.max(t * 1.4, a, 1);
  const p = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="relative h-5 w-full rounded-[6px] bg-jh-mist overflow-hidden">
      {/* qualitative bands: lighter as you approach target */}
      {t > 0 && <div className="absolute inset-y-0 left-0 bg-jh-blue-grey/50" style={{ width: p(t * 0.9) }} />}
      {t > 0 && <div className="absolute inset-y-0 left-0 bg-jh-blue-grey" style={{ width: p(t * 0.5) }} />}
      {/* actual value bar */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-pill ${RAG_BAR[status]}`} style={{ width: p(a) }} />
      {/* target marker */}
      {t > 0 && <div className="absolute inset-y-0 w-[3px] bg-jh-ink rounded" style={{ left: p(t) }} />}
    </div>
  );
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
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl shrink-0">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-body font-semibold text-jh-ink leading-snug">{c.label}</p>
                {/* bullet (bowling) chart */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1"><Bullet a={a} t={t} status={status} /></div>
                  <span className={`text-xs font-display font-bold tabular-nums ${RAG_TEXT[status]}`}>{a}/{t}</span>
                </div>
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
