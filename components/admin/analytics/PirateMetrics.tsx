"use client";

import { useEffect, useState } from "react";
import { Database, Globe, ExternalLink } from "lucide-react";
import { PIRATE_STAGES, type EventStage } from "@/lib/tags";
import { authed, Empty, Loading, Section, StatCard, SubTabs } from "@/components/admin/shared";
import { ChartCard, CHART_COLORS, HBar, TimeLine } from "./charts";
import { gaErrorHint } from "@/lib/ga4-hint";

interface StageRollup { stage: EventStage; label: string; people: number; events: number; byEvent: { key: string; label: string; tag: string; people: number; events: number; enabled: boolean }[] }
interface AwarenessReport {
  days: number;
  totals: { sessions: number; users: number; newUsers: number; pageViews: number; engagementRate: number };
  channels: { label: string; count: number }[];
  countries: { label: string; count: number }[];
  pages: { label: string; count: number }[];
  daily: { day: string; sessions: number; users: number }[];
}
type Ga = { usesFirebaseAccount: boolean; serviceAccountEmail: string | null; measurementId: string | null } & (
  | { configured: false }
  | { configured: true; ok: true; report: AwarenessReport }
  | { configured: true; ok: false; error: string });
interface Metrics {
  days: number; totalPeople: number; totalEvents: number; stages: StageRollup[];
  sources: { label: string; count: number }[];
  timeseries: Record<string, string | number>[];
  ga: Ga;
  supabase: { table: string; scope: string; rows: number };
}
const RANGES = [7, 28, 90] as const;

const LAYERS = [
  { key: "dashboard", label: "Dashboard", hint: "FO — the AAARRR funnel, sources and trend" },
  { key: "source", label: "Data source", hint: "BO — where the rows live" },
] as const;
type Layer = (typeof LAYERS)[number]["key"];

// AAARRR: FO (what the team looks at) and BO (the store). The MO layer — which
// event rolls into which stage — is edited under User interactions → Tracking.
export default function PirateMetrics() {
  const [layer, setLayer] = useState<Layer>("dashboard");
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState(false);
  const [days, setDays] = useState<number>(28);

  useEffect(() => {
    setM(null); setErr(false);
    authed(`/api/admin/pirate-metrics?days=${days}`).then((r) => r.json()).then((d) => (d.ok ? setM(d) : setErr(true))).catch(() => setErr(true));
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SubTabs items={LAYERS} value={layer} onChange={setLayer} ariaLabel="Pirate metrics layers" />
        {layer === "dashboard" && (
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="pm-days" className="text-jh-mute">Awareness window</label>
            <select id="pm-days" className="field w-auto py-2 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {RANGES.map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </select>
          </div>
        )}
      </div>
      {err && <p className="text-jh-red">Couldn’t load pirate metrics. Try again.</p>}
      {!err && !m && <Loading>Loading pirate metrics…</Loading>}
      {m && layer === "dashboard" && <Dashboard m={m} />}
      {m && layer === "source" && <DataSource m={m} />}
      <p className="text-xs text-jh-mute">Which event counts in which stage is configured under <a href="#interactions/tracking" className="text-jh-red underline underline-offset-2">User interactions → Tracking</a>.</p>
    </div>
  );
}

/* ---------------- FO: dashboard ---------------- */
function Dashboard({ m }: { m: Metrics }) {
  const funnel = m.stages.map((s) => ({ label: s.label, count: s.people }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={m.totalPeople} label="People tracked" hint="Distinct emails with any Compass event" />
        <StatCard value={m.totalEvents} label="Events" hint="All Compass events, repeats included" />
        <StatCard value={m.stages.find((s) => s.stage === "acquisition")?.people ?? 0} label="Acquired" hint="Left their details (quiz)" />
        <StatCard value={m.stages.find((s) => s.stage === "activation")?.people ?? 0} label="Activated" hint="Registered / verified / onboarded" />
      </div>

      <ChartCard title="AAARRR funnel" subtitle={m.ga.configured && m.ga.ok ? `Awareness = GA users (last ${m.days} days) · other stages = distinct people in Supabase, all time` : "Distinct people who reached each stage at least once (connect GA to fill Awareness)"}>
        <HBar rows={funnel} color={CHART_COLORS[0]} />
      </ChartCard>

      <Awareness ga={m.ga} />

      <ChartCard title="Event sources" subtitle="Where Supabase events were fired from (source column)">
        <HBar rows={m.sources} color={CHART_COLORS[2]} />
      </ChartCard>

      <ChartCard title="Events per day, by stage" subtitle="Acquisition → Referral">
        <TimeLine data={m.timeseries} keys={PIRATE_STAGES.map((s) => ({ key: s.key, label: s.label }))} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {m.stages.filter((s) => s.byEvent.length).map((s) => (
          <ChartCard key={s.stage} title={s.label} subtitle={`${s.people} people · ${s.events} events`}>
            <HBar rows={s.byEvent.map((e) => ({ label: e.label, count: e.people }))} color={CHART_COLORS[PIRATE_STAGES.findIndex((p) => p.key === s.stage) % CHART_COLORS.length]} />
          </ChartCard>
        ))}
      </div>
    </div>
  );
}

/* ---------------- FO: awareness (Google Analytics) ---------------- */
function Awareness({ ga }: { ga: Ga }) {
  const status = !ga.configured ? "Not connected" : ga.ok ? "Connected" : "Error";
  const pill = <span className={`pill ${!ga.configured ? "bg-jh-mist text-jh-mute" : ga.ok ? "bg-rb-green-light/20 text-rb-green-dark" : "bg-jh-red-soft text-jh-red"}`}><Globe className="h-3.5 w-3.5" aria-hidden /> {status}</span>;

  if (!ga.configured) {
    return (
      <ChartCard title="Awareness · Google Analytics" subtitle="Sessions, traffic channels (social / direct / search), countries, landing pages" aside={pill}>
        <div className="text-sm text-jh-mute space-y-2">
          <p>Awareness lives in Google Analytics, not Supabase. To connect it:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Set <code className="font-mono text-xs text-jh-ink">GA4_PROPERTY_ID</code> (the numeric id under GA → Admin → Property settings).</li>
            <li>{ga.usesFirebaseAccount
              ? <>Grant the Firebase service account{ga.serviceAccountEmail && <> <code className="font-mono text-xs text-jh-ink">{ga.serviceAccountEmail}</code></>} <strong>Viewer</strong> on the GA4 property (GA → Admin → Property access management). No extra key needed — <code className="font-mono text-xs text-jh-ink">FIREBASE_SERVICE_ACCOUNT_B64</code> is reused.</>
              : <>Set <code className="font-mono text-xs text-jh-ink">GA4_SERVICE_ACCOUNT_B64</code> to a service account (base64 JSON) with <strong>Viewer</strong> on the property.</>}</li>
          </ol>
          <p>{ga.measurementId ? <>Tagging is in place (measurement id <code className="font-mono text-xs">{ga.measurementId}</code>).</> : "No measurement id found — the public pages aren't tagged yet."}</p>
          <a href="https://analytics.google.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-jh-red underline underline-offset-2">Open Google Analytics <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      </ChartCard>
    );
  }
  if (!ga.ok) {
    return (
      <ChartCard title="Awareness · Google Analytics" subtitle="Could not read the GA4 Data API" aside={pill}>
        <p className="text-sm text-jh-red font-mono break-words">{ga.error}</p>
        <p className="text-sm text-jh-mute mt-2">{gaErrorHint(ga.error, ga.serviceAccountEmail)}</p>
      </ChartCard>
    );
  }
  const r = ga.report;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-display font-bold text-jh-ink">Awareness · Google Analytics</h3>
        {pill}
        <span className="text-xs text-jh-mute">last {r.days} days</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard value={r.totals.sessions} label="Sessions" />
        <StatCard value={r.totals.users} label="Users" />
        <StatCard value={r.totals.newUsers} label="New users" />
        <StatCard value={r.totals.pageViews} label="Page views" />
        <StatCard value={`${r.totals.engagementRate}%`} label="Engagement rate" />
      </div>
      <ChartCard title="Sessions per day" subtitle="Users overlaid">
        <TimeLine data={r.daily} keys={[{ key: "sessions", label: "Sessions" }, { key: "users", label: "Users" }]} height={220} />
      </ChartCard>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Traffic channels" subtitle="Default channel group · sessions"><HBar rows={r.channels} color={CHART_COLORS[3]} /></ChartCard>
        <ChartCard title="Countries" subtitle="Top 10 · sessions"><HBar rows={r.countries} color={CHART_COLORS[4]} /></ChartCard>
        <ChartCard title="Landing pages" subtitle="Top 8 · sessions"><HBar rows={r.pages} color={CHART_COLORS[1]} /></ChartCard>
      </div>
    </div>
  );
}

/* ---------------- BO: data source ---------------- */
function DataSource({ m }: { m: Metrics }) {
  return (
    <div className="space-y-6">
      <Section title="Supabase" help="The back office. Every enabled event is upserted into one table; repeats bump `score`.">
        <dl className="grid sm:grid-cols-3 gap-4 text-sm">
          <div><dt className="text-jh-mute">Table</dt><dd className="font-mono text-jh-ink">public.{m.supabase.table}</dd></div>
          <div><dt className="text-jh-mute">Scope</dt><dd className="font-mono text-jh-ink">{m.supabase.scope}</dd></div>
          <div><dt className="text-jh-mute">Rows loaded</dt><dd className="font-display font-bold text-jh-ink tabular-nums">{m.supabase.rows}</dd></div>
        </dl>
        <div className="text-sm text-jh-mute space-y-1">
          <p>Unique key: <code className="font-mono text-xs">(email, tag, stage)</code>. Columns written: first_name, last_name, email, stage, tag, source, archetype, score; the quiz also writes grade, obstacle and quiz_answers.</p>
          <p>The table is shared with other JobHackers marketing — the admin only reads rows whose tag starts with <code className="font-mono text-xs">EVENT-&gt;</code>.</p>
        </div>
      </Section>
      <Section title="Rows per stage (as stored)" help="Distinct people vs total event rows per stage, straight from the table.">
        {m.stages.every((s) => s.people === 0) ? <Empty>No rows yet.</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-jh-mute border-b border-jh-line"><th className="font-semibold px-3 py-2">Stage</th><th className="font-semibold px-3 py-2 text-right">People</th><th className="font-semibold px-3 py-2 text-right">Events</th><th className="font-semibold px-3 py-2">Configured events</th></tr></thead>
            <tbody>
              {m.stages.map((s) => (
                <tr key={s.stage} className="border-b border-jh-line last:border-0">
                  <td className="px-3 py-2.5 font-display font-semibold text-jh-ink">{s.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.people}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.events}</td>
                  <td className="px-3 py-2.5 text-xs text-jh-mute">{s.byEvent.map((e) => e.label).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <p className="text-xs text-jh-mute inline-flex items-center gap-1"><Database className="h-3.5 w-3.5" aria-hidden /> Migrations: supabase/migrations · client: lib/supabaseServer.ts (server-only, secret key)</p>
    </div>
  );
}
