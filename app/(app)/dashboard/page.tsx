"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { Users, Briefcase, Coffee, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useAccess } from "@/lib/firestore/access";
import { useLiveCollection, useLiveDoc, paths } from "@/lib/firestore/db";
import {
  CATEGORIES, HIDDEN_CATEGORIES, VISIBLE_CATEGORIES, DEFAULT_WEEKLY_TARGETS, NOS_PER_YES,
} from "@/lib/categories";
import type { ActivityLog, Contact, Interaction, Opportunity } from "@/lib/types";
import {
  type Period, rangeYmd, rangeMs, shift, periodLabel, scaleTarget, inRange, tsMs,
  rag, RAG_BAR, RAG_TEXT,
} from "@/lib/period";

const PERIODS: Period[] = ["day", "week", "month"];
const UNIT: Record<Period, string> = { day: "today", week: "this week", month: "this month" };

export default function Dashboard() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { daysLeft } = useAccess(uid);
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(() => new Date());

  const { data: logs } = useLiveCollection<ActivityLog>(uid, paths.activityLogs);
  const { data: contacts } = useLiveCollection<Contact>(uid, paths.contacts);
  const { data: interactions } = useLiveCollection<Interaction>(uid, paths.interactions);
  const { data: opps } = useLiveCollection<Opportunity>(uid, paths.opportunities);
  const { data: targetDoc } = useLiveDoc<{ targets: Record<string, number> }>(uid ? paths.settingsTargets(uid) : null);
  const userTargets = targetDoc?.targets ?? {};

  const rY = rangeYmd(period, anchor);
  const rM = rangeMs(period, anchor);
  const inMs = (v: any) => { const t = tsMs(v); return t >= rM.start && t <= rM.end; };

  // ---- period-scoped CRM stats ----
  const contactsN = contacts.filter((c) => inMs(c.createdAt)).length;
  const periodInteractions = interactions.filter((i) => inMs(i.occurredAt ?? i.createdAt));
  const interactionsN = periodInteractions.length;
  const interviewsN = periodInteractions.filter((i) => i.type === "job_interview").length;
  const offersN = opps.filter((o) => inMs(o.createdAt) && (o.stage === "offer" || o.stage === "accepted")).length;

  // ---- targets vs actual (period) ----
  const actualOf = (id: string) => logs.filter((l) => l.categoryId === id && inRange(l.loggedOn, rY)).reduce((a, l) => a + (l.count ?? 1), 0);
  const targetOf = (id: string) => scaleTarget(userTargets[id] ?? DEFAULT_WEEKLY_TARGETS[id] ?? 0, period, anchor);
  const agg = (ids: string[]) => ids.reduce((s, id) => ({ a: s.a + actualOf(id), t: s.t + targetOf(id) }), { a: 0, t: 0 });

  const overall = agg(CATEGORIES.map((c) => c.id));
  const hidden = agg(HIDDEN_CATEGORIES.map((c) => c.id));
  const visible = agg(VISIBLE_CATEGORIES.map((c) => c.id));
  const onTrack = CATEGORIES.filter((c) => actualOf(c.id) >= targetOf(c.id) && targetOf(c.id) > 0).length;

  // ---- trailing 6-period trend ----
  const buckets = useMemo(() => {
    const out: { label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      let a = now; for (let k = 0; k < i; k++) a = shift(period, a, -1);
      const r = rangeYmd(period, a);
      const count = logs.filter((l) => inRange(l.loggedOn, r)).reduce((s, l) => s + (l.count ?? 1), 0);
      out.push({ label: bucketLabel(period, a), count });
    }
    return out;
  }, [logs, period]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div><span className="eyebrow">Dashboard</span><h1 className="mt-1">Welcome back 👋</h1></div>
        {daysLeft != null && <span className="pill bg-jh-mist text-jh-mute">{daysLeft} days left</span>}
      </div>

      {/* global period filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-pill bg-jh-mist p-1">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`rounded-pill px-4 py-1.5 text-sm font-display font-semibold capitalize transition ${period === p ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute"}`}>{p}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor(shift(period, anchor, -1))} className="rounded-full p-2 hover:bg-jh-mist"><ChevronLeft className="h-5 w-5" /></button>
          <span className="font-display font-semibold min-w-36 text-center text-sm">{periodLabel(period, anchor)}</span>
          <button onClick={() => setAnchor(shift(period, anchor, 1))} className="rounded-full p-2 hover:bg-jh-mist"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Users} label="Contacts added" value={contactsN} />
        <Stat icon={Coffee} label="Interactions" value={interactionsN} />
        <Stat icon={MessageSquare} label="Job interviews" value={interviewsN} />
        <Stat icon={Briefcase} label="Offers" value={offersN} />
      </div>

      {/* RAG goals vs actual */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base">Goals vs actual · {UNIT[period]}</h3>
          <span className="text-xs text-jh-mute">{onTrack}/{CATEGORIES.length} on goal</span>
        </div>
        <RagBar label="Overall" a={overall.a} t={overall.t} />
        <RagBar label="Hidden market" a={hidden.a} t={hidden.t} />
        <RagBar label="Visible market" a={visible.a} t={visible.t} />
        <div className="flex items-center gap-4 text-xs text-jh-mute pt-1">
          <Legend cls="bg-rb-green-dark" label="On / above" />
          <Legend cls="bg-rb-orange" label="Halfway" />
          <Legend cls="bg-jh-red" label="Behind" />
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-base mb-1">Activity trend</h3>
        <p className="text-xs text-jh-mute mb-4">Activities logged per {period} (last 6).</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f3f5fa" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {buckets.map((_, i) => <Cell key={i} fill="#c2001f" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-base mb-3">The NO → YES funnel · {UNIT[period]}</h3>
        <p className="text-sm text-jh-mute mb-4">
          It takes <strong className="text-jh-ink">{NOS_PER_YES.min}–{NOS_PER_YES.max} NOs to earn 1 YES.</strong> Every rejection is progress.
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Mini label="Activities" value={overall.a} />
          <Mini label="Job interviews" value={interviewsN} />
          <Mini label="Offers" value={offersN} />
        </div>
      </section>
    </div>
  );
}

function RagBar({ label, a, t }: { label: string; a: number; t: number }) {
  const status = rag(a, t);
  const pct = t > 0 ? Math.min(100, Math.round((a / t) * 100)) : a > 0 ? 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-display font-semibold text-jh-ink">{label}</span>
        <span className={`font-display font-bold ${RAG_TEXT[status]}`}>{a} / {t}</span>
      </div>
      <div className="h-2.5 rounded-pill bg-jh-mist overflow-hidden">
        <div className={`h-full rounded-pill ${RAG_BAR[status]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${cls}`} /> {label}</span>;
}
function bucketLabel(period: Period, anchor: Date): string {
  if (period === "day") return anchor.toLocaleDateString(undefined, { weekday: "short" });
  if (period === "month") return anchor.toLocaleDateString(undefined, { month: "short" });
  return rangeYmd("week", anchor).start.slice(5);
}
function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="card p-4">
      <Icon className="h-5 w-5 text-jh-red mb-2" />
      <div className="font-display font-extrabold text-2xl text-jh-ink">{value}</div>
      <div className="text-xs text-jh-mute">{label}</div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] bg-jh-mist py-4">
      <div className="font-display font-extrabold text-2xl text-jh-ink">{value}</div>
      <div className="text-xs text-jh-mute">{label}</div>
    </div>
  );
}
