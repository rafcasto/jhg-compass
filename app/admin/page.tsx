"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Check, Link as LinkIcon, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase/client";
import ArticlesTab from "@/components/admin/ArticlesTab";
import StagesTab from "@/components/admin/StagesTab";
import CoachingScreenTab from "@/components/admin/CoachingScreenTab";
import type { AdminConfig, Activity, ContentConfig } from "@/lib/types";
import { DEFAULT_CONTENT, TEXT_FIELDS, newActivityId } from "@/lib/content";
import {
  DEFAULT_FUNNEL, type FunnelConfig, type QuizQuestion, type QuizOption,
} from "@/lib/funnel";
import FeedbackTab from "@/components/admin/FeedbackTab";

const TABS = ["Dashboard", "Analytics", "Registration links", "Content", "Stages", "Articles", "Coaching", "Feedback", "Funnel", "Event tracking"] as const;
type Tab = (typeof TABS)[number];

// Paywall / email copy (stored separately in config/admin) — edited inside the
// Content tab alongside all other static text. Coaching-tab copy has its own tab.
const CONFIG_FIELDS: { key: keyof AdminConfig; label: string; textarea?: boolean }[] = [
  { key: "paywallTitle", label: "Paywall — title" },
  { key: "paywallBody", label: "Paywall — body", textarea: true },
  { key: "paywallCtaLabel", label: "Paywall — CTA label" },
  { key: "paywallCtaUrl", label: "Paywall — CTA URL" },
  { key: "pwResetSubject", label: "Password email — subject" },
  { key: "pwResetBody", label: "Password email — body", textarea: true },
  { key: "emailVerifySubject", label: "Email verification — subject" },
  { key: "emailVerifyBody", label: "Email verification — body", textarea: true },
];

async function token() { return auth.currentUser!.getIdToken(); }
async function authedFetch(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${await token()}` } });
}

export default function AdminPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("Dashboard");

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    user.getIdTokenResult(true).then((t) => setAuthorized(t.claims.admin === true));
  }, [user, loading, router]);

  if (authorized === null) return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
  if (authorized === false) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div><h1 className="mb-2">Not authorized</h1><p className="text-jh-mute">This area is for admins only.</p></div>
    </div>
  );

  return (
    <div className="admin-scope min-h-screen bg-jh-paper">
      <style>{`.admin-scope .btn-primary,.admin-scope .btn-secondary{border-radius:9999px;}`}</style>
      {/* red brand bar — matches the funnel / landing */}
      <div className="h-[5px] bg-jh-red" />
      {/* light branded header */}
      <header className="bg-white border-b border-jh-line">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-8 w-8 rounded-[9px] bg-jh-red text-white text-base shadow-cta">🧭</span>
            <span className="font-display font-bold text-jh-ink">JobHacker <span className="text-jh-red">Compass</span></span>
            <span className="ml-1.5 hidden sm:inline font-display font-semibold text-[11px] uppercase tracking-[.12em] text-jh-mute">Admin</span>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <span className="text-jh-mute hidden sm:inline">{user?.email}</span>
            <Link href="/compass" className="inline-flex items-center gap-1 text-jh-ink hover:text-jh-red underline underline-offset-2">View site <ExternalLink className="h-3.5 w-3.5" /></Link>
            <button onClick={() => signOut()} className="font-display font-semibold text-jh-ink hover:text-jh-red">Sign out</button>
          </div>
        </div>
      </header>

      {/* tabs */}
      <div className="bg-jh-paper border-b border-jh-line">
        <nav className="mx-auto max-w-6xl px-5 flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 text-sm font-display font-semibold whitespace-nowrap border-b-2 -mb-px transition ${tab === t ? "border-jh-red text-jh-red" : "border-transparent text-jh-mute hover:text-jh-ink"}`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {tab === "Dashboard" && <DashboardTab />}
        {tab === "Analytics" && <AnalyticsTab />}
        {tab === "Registration links" && <RegistrationLinks />}
        {tab === "Content" && <ContentTab />}
        {tab === "Stages" && <StagesTab />}
        {tab === "Articles" && <ArticlesTab />}
        {tab === "Coaching" && <CoachingScreenTab />}
        {tab === "Funnel" && <FunnelTab />}
        {tab === "Event tracking" && <EventTracking />}
        {tab === "Feedback" && <FeedbackTab />}
      </main>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function DashboardTab() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { authedFetch("/api/admin/stats").then((r) => r.json()).then((d) => d.ok && setS(d)); }, []);
  if (!s) return <p className="text-jh-mute animate-pulse">Loading stats…</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={s.users} label="Users" />
        <StatCard value={s.eventsTotal} label="Events tracked" />
        <StatCard value={s.activeGrants} label="Active access" />
        <StatCard value={s.activeLinks} label="Active invite links" />
      </div>

      <div>
        <h2 className="text-xl mb-3">Recent activity</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-jh-mute border-b border-jh-line">
                {["Name", "Email", "Stage", "Event tag", "Source", "Score", "Date"].map((h) => <th key={h} className="font-semibold px-4 py-3 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(s.recent ?? []).map((r: any, i: number) => (
                <tr key={i} className="border-b border-jh-line last:border-0">
                  <td className="px-4 py-3">{r.first_name ?? "—"}</td>
                  <td className="px-4 py-3 text-jh-mute">{r.email}</td>
                  <td className="px-4 py-3"><span className="pill bg-jh-mist text-jh-ink capitalize">{r.stage}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-jh-ink">{r.tag}</td>
                  <td className="px-4 py-3 text-jh-mute">{r.source}</td>
                  <td className="px-4 py-3 font-semibold">{r.score}</td>
                  <td className="px-4 py-3 text-jh-mute whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</td>
                </tr>
              ))}
              {(!s.recent || s.recent.length === 0) && <tr><td colSpan={7} className="px-4 py-8 text-center text-jh-mute">No events yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="card p-5">
      <div className="font-display font-extrabold text-3xl text-jh-ink">{value ?? 0}</div>
      <div className="text-sm text-jh-mute mt-1">{label}</div>
    </div>
  );
}

/* ---------------- Analytics (quiz answers + switchable dashboards) ---------------- */
type Analytics = {
  total: number;
  questionBreakdowns: { id: string; prompt: string; options: { label: string; count: number }[] }[];
  archetype: { label: string; count: number }[];
  grade: { label: string; count: number }[];
  fit: { label: string; count: number }[];
  readiness: { label: string; count: number }[];
  flags: { label: string; count: number }[];
  obstacle: { label: string; count: number }[];
  timeseries: { day: string; count: number }[];
  openResponses: { name: string; email: string; q6: string; other: Record<string, string>; created_at: string | null }[];
  questionMeta: { id: string; prompt: string; kind: string }[];
  responses: {
    name: string; email: string; archetype: string; score: number | null; grade: string;
    fit: string; created_at: string | null;
    answers: Record<string, string>; q6: string; other: Record<string, string>;
  }[];
};

const DASHBOARDS = ["Quiz answers", "Questions & answers", "Archetypes", "Readiness & fit", "Completions over time", "Open responses"] as const;
type Dashboard = (typeof DASHBOARDS)[number];

// Brand-aligned palette for charts.
const CHART_COLORS = ["#E11D2E", "#0F172A", "#2563EB", "#0EA5E9", "#16A34A", "#EAB308", "#9333EA", "#F97316"];

function AnalyticsTab() {
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState(false);
  const [view, setView] = useState<Dashboard>("Quiz answers");

  useEffect(() => {
    authedFetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setErr(true)))
      .catch(() => setErr(true));
  }, []);

  if (err) return <p className="text-jh-red">Couldn’t load analytics. Try again.</p>;
  if (!data) return <p className="text-jh-mute animate-pulse">Loading analytics…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl">Quiz analytics</h2>
          <p className="text-jh-mute text-sm mt-1">
            {data.total} quiz {data.total === 1 ? "completion" : "completions"} captured. Switch dashboards to slice the data.
          </p>
        </div>
        <div>
          <label className="label">Dashboard</label>
          <select className="field w-auto min-w-56" value={view} onChange={(e) => setView(e.target.value as Dashboard)}>
            {DASHBOARDS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {data.total === 0 ? (
        <div className="card p-10 text-center text-jh-mute">No quiz completions yet.</div>
      ) : (
        <>
          {view === "Quiz answers" && <QuizAnswersDash data={data} />}
          {view === "Questions & answers" && <ResponsesDash data={data} />}
          {view === "Archetypes" && <ArchetypesDash data={data} />}
          {view === "Readiness & fit" && <ReadinessFitDash data={data} />}
          {view === "Completions over time" && <TimeseriesDash data={data} />}
          {view === "Open responses" && <OpenResponsesDash data={data} />}
        </>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="font-display font-semibold text-jh-ink">{title}</p>
      {subtitle && <p className="text-xs text-jh-mute mb-3">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function HBar({ rows, color = CHART_COLORS[0] }: { rows: { label: string; count: number }[]; color?: string }) {
  if (!rows.length) return <p className="text-sm text-jh-mute">No data.</p>;
  const height = Math.max(120, rows.length * 42);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#EEE" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12 }} />
        <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Donut({ rows }: { rows: { label: string; count: number }[] }) {
  if (!rows.length) return <p className="text-sm text-jh-mute">No data.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={rows} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {rows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function Legend({ rows }: { rows: { label: string; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <ul className="mt-3 space-y-1.5">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-center gap-2 text-sm">
          <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
          <span className="text-jh-ink flex-1 truncate">{r.label}</span>
          <span className="text-jh-mute tabular-nums">{r.count} · {Math.round((r.count / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

function QuizAnswersDash({ data }: { data: Analytics }) {
  if (!data.questionBreakdowns.length)
    return <div className="card p-10 text-center text-jh-mute">No scored questions configured in the funnel.</div>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.questionBreakdowns.map((q, i) => (
        <ChartCard key={q.id} title={`${q.id.toUpperCase()} · ${q.prompt}`} subtitle="Answer distribution">
          <HBar rows={q.options} color={CHART_COLORS[i % CHART_COLORS.length]} />
        </ChartCard>
      ))}
    </div>
  );
}

function ResponsesDash({ data }: { data: Analytics }) {
  const [sortKey, setSortKey] = useState<"score" | "fit">("score");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [open, setOpen] = useState<number | null>(null);

  // qualified ranks above below-icp; unknown last.
  const fitRank = (f: string) => (f === "qualified" ? 2 : f === "below-icp" ? 1 : 0);

  const rows = [...data.responses].sort((a, b) => {
    let d = 0;
    if (sortKey === "score") d = (a.score ?? -1) - (b.score ?? -1);
    else d = fitRank(a.fit) - fitRank(b.fit);
    if (d === 0) d = (a.score ?? -1) - (b.score ?? -1); // tie-break on score
    return dir === "desc" ? -d : d;
  });

  // Only the choice (scored) questions carry per-option answers.
  const choiceQs = data.questionMeta.filter((q) => q.kind === "choice");
  const openQ = data.questionMeta.find((q) => q.kind === "text");

  const fitPill = (f: string) =>
    f === "qualified" ? "bg-rb-green-light/20 text-rb-green-dark"
    : f === "below-icp" ? "bg-jh-red-soft text-jh-red"
    : "bg-jh-mist text-jh-mute";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Sort by</label>
          <select className="field w-auto" value={sortKey} onChange={(e) => setSortKey(e.target.value as "score" | "fit")}>
            <option value="score">Readiness score</option>
            <option value="fit">Fit</option>
          </select>
        </div>
        <div>
          <label className="label">Order</label>
          <select className="field w-auto" value={dir} onChange={(e) => setDir(e.target.value as "desc" | "asc")}>
            <option value="desc">High → low</option>
            <option value="asc">Low → high</option>
          </select>
        </div>
        <p className="text-sm text-jh-mute ml-auto self-center">{rows.length} respondents</p>
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => {
          const isOpen = open === i;
          const others = Object.entries(r.other || {}).filter(([, v]) => (v as string)?.trim());
          return (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-jh-paper/60 transition">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-jh-ink truncate">{r.name}</p>
                  <p className="text-xs text-jh-mute truncate">{r.email}</p>
                </div>
                <span className="pill bg-jh-mist text-jh-ink capitalize">{r.archetype}</span>
                <span className={`pill ${fitPill(r.fit)} capitalize`}>{r.fit}</span>
                <span className="pill bg-jh-mist text-jh-ink" title="Readiness score (0–6)">
                  Score {r.score ?? "—"}
                </span>
                {r.grade && r.grade !== "—" && <span className="pill bg-jh-mist text-jh-ink">{r.grade}</span>}
                <span className="text-jh-mute text-xs tabular-nums">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-jh-line px-4 py-4 space-y-3 bg-jh-paper/40">
                  {choiceQs.map((q) => (
                    <div key={q.id} className="grid sm:grid-cols-[1fr_1.2fr] gap-1 sm:gap-3">
                      <p className="text-sm text-jh-mute">
                        <span className="font-mono text-[11px] text-jh-mute-2">{q.id.toUpperCase()}</span> {q.prompt}
                      </p>
                      <p className="text-sm font-medium text-jh-ink">{r.answers[q.id] ?? "—"}</p>
                    </div>
                  ))}
                  {openQ && (
                    <div className="grid sm:grid-cols-[1fr_1.2fr] gap-1 sm:gap-3">
                      <p className="text-sm text-jh-mute">
                        <span className="font-mono text-[11px] text-jh-mute-2">{openQ.id.toUpperCase()}</span> {openQ.prompt}
                      </p>
                      <p className="text-sm font-medium text-jh-ink whitespace-pre-wrap">{r.q6 || "—"}</p>
                    </div>
                  )}
                  {others.map(([k, v]) => (
                    <div key={k} className="grid sm:grid-cols-[1fr_1.2fr] gap-1 sm:gap-3">
                      <p className="text-sm text-jh-mute">
                        <span className="font-mono text-[11px] text-jh-mute-2">{k.toUpperCase()}</span> “Something else”
                      </p>
                      <p className="text-sm font-medium text-jh-ink">{v as string}</p>
                    </div>
                  ))}
                  {r.created_at && (
                    <p className="text-xs text-jh-mute-2 pt-1">Completed {new Date(r.created_at).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div className="card p-10 text-center text-jh-mute">No respondents yet.</div>}
      </div>
    </div>
  );
}

function ArchetypesDash({ data }: { data: Analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Archetype mix" subtitle="Who’s taking the quiz">
        <Donut rows={data.archetype} />
        <Legend rows={data.archetype} />
      </ChartCard>
      <ChartCard title="Top obstacles" subtitle="Message-routing label (Q3)">
        <HBar rows={data.obstacle} color={CHART_COLORS[2]} />
      </ChartCard>
      {data.flags.length > 0 && (
        <ChartCard title="Flags raised" subtitle="ai-anxious · vip-signal · below-icp · manual-review">
          <HBar rows={data.flags} color={CHART_COLORS[6]} />
        </ChartCard>
      )}
    </div>
  );
}

function ReadinessFitDash({ data }: { data: Analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Readiness score" subtitle="0–6 points (higher = warmer lead)">
        <HBar rows={data.readiness.map((r) => ({ label: `${r.label} pts`, count: r.count }))} color={CHART_COLORS[0]} />
      </ChartCard>
      <ChartCard title="Fit gate" subtitle="qualified vs below-icp (Q4)">
        <Donut rows={data.fit} />
        <Legend rows={data.fit} />
      </ChartCard>
      <ChartCard title="Triage grade" subtitle="Computed lead grade">
        <HBar rows={data.grade} color={CHART_COLORS[4]} />
      </ChartCard>
    </div>
  );
}

function TimeseriesDash({ data }: { data: Analytics }) {
  return (
    <ChartCard title="Quiz completions over time" subtitle="Daily completed quizzes">
      {data.timeseries.length === 0 ? (
        <p className="text-sm text-jh-mute">No dated completions.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.timeseries} margin={{ left: 8, right: 24, top: 8, bottom: 4 }}>
            <CartesianGrid stroke="#EEE" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function OpenResponsesDash({ data }: { data: Analytics }) {
  const rows = data.openResponses;
  if (!rows.length) return <div className="card p-10 text-center text-jh-mute">No free-text answers yet.</div>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-jh-mute border-b border-jh-line">
            {["Name", "Email", "Open answer / “Something else”", "Date"].map((h) => (
              <th key={h} className="font-semibold px-4 py-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const others = Object.entries(r.other || {}).filter(([, v]) => (v as string)?.trim());
            return (
              <tr key={i} className="border-b border-jh-line last:border-0 align-top">
                <td className="px-4 py-3 whitespace-nowrap">{r.name}</td>
                <td className="px-4 py-3 text-jh-mute whitespace-nowrap">{r.email}</td>
                <td className="px-4 py-3 text-jh-ink">
                  {r.q6 && <p>{r.q6}</p>}
                  {others.map(([k, v]) => (
                    <p key={k} className="text-jh-mute text-xs mt-1"><span className="font-mono">{k}</span>: {v as string}</p>
                  ))}
                </td>
                <td className="px-4 py-3 text-jh-mute whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Content (static text + activities + paywall/email copy) ----------------
   Progress-board stages are managed on the separate Stages tab — this tab never
   writes config/content.stages, so the two can be edited independently. */
function ContentTab() {
  const [cfg, setCfg] = useState<ContentConfig | null>(null);
  const [adminCfg, setAdminCfg] = useState<Partial<AdminConfig>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authedFetch("/api/admin/content").then((r) => r.json()).then((d) => d.ok && setCfg(d.content));
    authedFetch("/api/admin/config").then((r) => r.json()).then((d) => d.ok && setAdminCfg(d.config));
  }, []);

  function patch(p: Partial<ContentConfig>) { setCfg((c) => ({ ...(c as ContentConfig), ...p })); setSaved(false); }
  function setText(key: string, value: string) {
    setCfg((c) => ({ ...(c as ContentConfig), text: { ...(c as ContentConfig).text, [key]: value } }));
    setSaved(false);
  }
  function setAdmin(key: keyof AdminConfig, value: string) { setAdminCfg((a) => ({ ...a, [key]: value })); setSaved(false); }
  function setEffort(market: "hidden" | "visible", value: number) {
    patch({ effortSplit: { ...(cfg as ContentConfig).effortSplit, [market]: value } });
  }

  function updateActivity(id: string, p: Partial<Activity>) {
    patch({ activities: (cfg as ContentConfig).activities.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  }
  function removeActivity(id: string) {
    patch({ activities: (cfg as ContentConfig).activities.filter((a) => a.id !== id) });
  }
  function addActivity(market: "hidden" | "visible") {
    const a: Activity = { id: newActivityId(""), market, emoji: "•", label: "New activity", defaultWeekly: 1 };
    patch({ activities: [...(cfg as ContentConfig).activities, a] });
  }

  async function save() {
    if (!cfg) return;
    setBusy(true); setSaved(false);
    const { stages: _stages, ...content } = cfg; // stages are owned by the Stages tab
    const [rContent, rConfig] = await Promise.all([
      authedFetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }),
      authedFetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adminCfg) }),
    ]);
    if (rContent.ok) setCfg((await rContent.json()).content);
    if (rConfig.ok) setAdminCfg((await rConfig.json()).config);
    if (rContent.ok && rConfig.ok) setSaved(true);
    setBusy(false);
  }
  function resetDefaults() {
    if (confirm("Reset the text & activity lists to the built-in defaults? (Paywall/email copy and Progress stages are left as-is.) Applied when you Save.")) {
      setCfg((c) => ({ ...structuredClone(DEFAULT_CONTENT), stages: (c as ContentConfig).stages })); setSaved(false);
    }
  }

  if (!cfg) return <p className="text-jh-mute animate-pulse">Loading content…</p>;

  const hidden = cfg.activities.filter((a) => a.market === "hidden");
  const visible = cfg.activities.filter((a) => a.market === "visible");

  // Group text fields preserving catalogue order.
  const groups: { name: string; fields: typeof TEXT_FIELDS }[] = [];
  for (const f of TEXT_FIELDS) {
    let g = groups.find((x) => x.name === f.group);
    if (!g) { g = { name: f.group, fields: [] }; groups.push(g); }
    g.fields.push(f);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl">App content</h2>
          <p className="text-jh-mute text-sm mt-1">Edit every static label, the job-market activity lists, and the paywall / email copy. Progress-board stages live on the Stages tab; the Coaching tab has its own editor. Changes go live across the app and onboarding the moment you save.</p>
        </div>
        <button onClick={resetDefaults} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap">Reset to defaults</button>
      </div>

      {/* ---- Activities ---- */}
      <section className="space-y-4">
        <div>
          <h3 className="font-display font-bold text-jh-ink">Job-market activities</h3>
          <p className="text-jh-mute text-sm">Add or remove the activities shown on Performance and in onboarding. “Default / wk” is the suggested weekly target until a user changes it.</p>
        </div>

        <div className="card p-4 grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="label">Hidden — % of success</label>
            <input type="number" min={0} max={100} className="field" value={cfg.effortSplit.hidden}
              onChange={(e) => setEffort("hidden", +e.target.value)} />
          </div>
          <div>
            <label className="label">Visible — % of success</label>
            <input type="number" min={0} max={100} className="field" value={cfg.effortSplit.visible}
              onChange={(e) => setEffort("visible", +e.target.value)} />
          </div>
        </div>

        <ActivityList title="👀 Hidden Job Market" items={hidden} market="hidden"
          onChange={updateActivity} onRemove={removeActivity} onAdd={() => addActivity("hidden")} />
        <ActivityList title="✅ Visible Job Market" items={visible} market="visible"
          onChange={updateActivity} onRemove={removeActivity} onAdd={() => addActivity("visible")} />
      </section>

      {/* ---- Static text ---- */}
      <section className="space-y-5">
        <h3 className="font-display font-bold text-jh-ink">Static text</h3>
        {groups.map((g) => (
          <div key={g.name} className="card p-5 space-y-4">
            <p className="font-display font-semibold text-jh-ink">{g.name}</p>
            {g.fields.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {f.textarea
                  ? <textarea className="field min-h-20" value={cfg.text[f.key] ?? ""} onChange={(e) => setText(f.key, e.target.value)} />
                  : <input className="field" value={cfg.text[f.key] ?? ""} onChange={(e) => setText(f.key, e.target.value)} />}
                {f.help && <p className="text-[11px] text-jh-mute mt-1">{f.help}</p>}
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* ---- Paywall & email copy ---- */}
      <section className="space-y-5">
        <div>
          <h3 className="font-display font-bold text-jh-ink">Paywall &amp; email</h3>
          <p className="text-jh-mute text-sm">Copy for the expired-access paywall and transactional emails.</p>
        </div>
        <div className="card p-5 space-y-4">
          {CONFIG_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              {f.textarea
                ? <textarea className="field min-h-24" value={(adminCfg[f.key] as string) ?? ""} onChange={(e) => setAdmin(f.key, e.target.value)} />
                : <input className="field" value={(adminCfg[f.key] as string) ?? ""} onChange={(e) => setAdmin(f.key, e.target.value)} />}
            </div>
          ))}
        </div>
      </section>

      {/* sticky save */}
      <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-jh-paper/90 backdrop-blur border-t border-jh-line flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save content"}</button>
        {saved && <span className="text-sm text-rb-green-dark">Saved ✓ — live now</span>}
      </div>
    </div>
  );
}

function ActivityList({ title, items, market, onChange, onRemove, onAdd }: {
  title: string;
  items: Activity[];
  market: "hidden" | "visible";
  onChange: (id: string, p: Partial<Activity>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-jh-line font-display font-semibold text-jh-ink text-sm">{title}</div>
      <div className="divide-y divide-jh-line">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-2 px-3 py-2.5">
            <input value={a.emoji} onChange={(e) => onChange(a.id, { emoji: e.target.value })}
              className="field py-2 text-center w-12 shrink-0" aria-label="Emoji" />
            <input value={a.label} onChange={(e) => onChange(a.id, { label: e.target.value })}
              className="field py-2 flex-1 text-sm" placeholder="Activity label" />
            <div className="shrink-0 w-24">
              <input type="number" min={0} value={a.defaultWeekly}
                onChange={(e) => onChange(a.id, { defaultWeekly: Math.max(0, +e.target.value) })}
                className="field py-2 text-sm" aria-label="Default weekly target" title="Default weekly target" />
            </div>
            <button onClick={() => onRemove(a.id)} className="shrink-0 grid place-items-center h-9 w-9 rounded-[10px] text-jh-mute hover:text-jh-red hover:bg-jh-red-soft" aria-label="Remove activity">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="px-4 py-6 text-center text-jh-mute text-sm">No activities yet.</div>}
      </div>
      <div className="px-3 py-3 border-t border-jh-line">
        <button onClick={onAdd} className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add activity
        </button>
      </div>
    </div>
  );
}

/* ---------------- Funnel (landing / details / quiz / thank-you / expired + registration link) ---------------- */
const ARCHETYPES = ["", "Job Seeker", "Career Changer", "Promotion Seeker", "Unclassified"];
const FIT_GATES = ["", "qualified", "below-icp"];
const FLAGS = ["", "ai-anxious", "vip-signal", "below-icp", "manual-review"];

function FunnelTab() {
  const [f, setF] = useState<FunnelConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { authedFetch("/api/admin/funnel").then((r) => r.json()).then((d) => d.ok && setF(d.funnel)); }, []);

  function touched() { setSaved(false); }
  function setLanding<K extends keyof FunnelConfig["landing"]>(key: K, value: FunnelConfig["landing"][K]) {
    setF((c) => ({ ...(c as FunnelConfig), landing: { ...(c as FunnelConfig).landing, [key]: value } })); touched();
  }
  function setDetails<K extends keyof FunnelConfig["details"]>(key: K, value: FunnelConfig["details"][K]) {
    setF((c) => ({ ...(c as FunnelConfig), details: { ...(c as FunnelConfig).details, [key]: value } })); touched();
  }
  function setLead<K extends keyof FunnelConfig["lead"]>(key: K, value: FunnelConfig["lead"][K]) {
    setF((c) => ({ ...(c as FunnelConfig), lead: { ...(c as FunnelConfig).lead, [key]: value } })); touched();
  }
  function setExpired<K extends keyof FunnelConfig["expired"]>(key: K, value: FunnelConfig["expired"][K]) {
    setF((c) => ({ ...(c as FunnelConfig), expired: { ...(c as FunnelConfig).expired, [key]: value } })); touched();
  }
  function setBlocked<K extends keyof FunnelConfig["blocked"]>(key: K, value: FunnelConfig["blocked"][K]) {
    setF((c) => ({ ...(c as FunnelConfig), blocked: { ...(c as FunnelConfig).blocked, [key]: value } })); touched();
  }
  function setCountdown<K extends keyof FunnelConfig["countdown"]>(key: K, value: FunnelConfig["countdown"][K]) {
    setF((c) => ({ ...(c as FunnelConfig), countdown: { ...(c as FunnelConfig).countdown, [key]: value } })); touched();
  }
  function setQuizMeta<K extends keyof FunnelConfig["quiz"]>(key: K, value: FunnelConfig["quiz"][K]) {
    setF((c) => ({ ...(c as FunnelConfig), quiz: { ...(c as FunnelConfig).quiz, [key]: value } })); touched();
  }
  function setInviteUrl(v: string) { setF((c) => ({ ...(c as FunnelConfig), inviteUrl: v })); touched(); }

  function setCard(i: number, patch: Partial<FunnelConfig["landing"]["cards"][number]>) {
    setF((c) => { const cfg = c as FunnelConfig; const cards = cfg.landing.cards.map((x, j) => (j === i ? { ...x, ...patch } : x)); return { ...cfg, landing: { ...cfg.landing, cards } }; }); touched();
  }
  function updateQuestion(qi: number, patch: Partial<QuizQuestion>) {
    setF((c) => { const cfg = c as FunnelConfig; const questions = cfg.quiz.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)); return { ...cfg, quiz: { ...cfg.quiz, questions } }; }); touched();
  }
  function updateOption(qi: number, oi: number, patch: Partial<QuizOption>) {
    setF((c) => { const cfg = c as FunnelConfig; const questions = cfg.quiz.questions.map((q, i) => { if (i !== qi || !q.options) return q; const options = q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)); return { ...q, options }; }); return { ...cfg, quiz: { ...cfg.quiz, questions } }; }); touched();
  }

  async function save() {
    if (!f) return;
    setBusy(true); setSaved(false);
    const r = await authedFetch("/api/admin/funnel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funnel: f }) });
    if (r.ok) { setF((await r.json()).funnel); setSaved(true); }
    setBusy(false);
  }
  function resetDefaults() {
    if (confirm("Reset the whole funnel (landing, details, quiz, thank-you, expired) to the built-in defaults? Applied when you Save.")) {
      setF(structuredClone(DEFAULT_FUNNEL)); setSaved(false);
    }
  }

  if (!f) return <p className="text-jh-mute animate-pulse">Loading funnel…</p>;

  const num = (v: string) => (v === "" ? undefined : Math.max(0, +v));

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl">Acquisition funnel</h2>
          <p className="text-jh-mute text-sm mt-1">Edit the landing page, the details form, the quiz &amp; scoring, the thank-you page, the registration link, and the expired-link experience. Changes go live on the public pages the moment you save.</p>
        </div>
        <button onClick={resetDefaults} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap">Reset to defaults</button>
      </div>

      {/* ---- Registration link ---- */}
      <section className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink">Registration link</h3>
        <p className="text-jh-mute text-sm">Where the thank-you button continues to. We append <code className="font-mono text-xs">?firstName=&amp;lastName=&amp;email=</code> so people don’t re-type their details. Use a time-boxed <code className="font-mono text-xs">/register/&lt;token&gt;</code> link — when it expires, visitors see the expired-link experience below.</p>
        <input className="field" value={f.inviteUrl} onChange={(e) => setInviteUrl(e.target.value)} placeholder="https://…/register/…" />
      </section>

      {/* ---- Countdown ---- */}
      <section className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink">Countdown timer</h3>
        <p className="text-jh-mute text-sm">Shown on the landing page. <strong>Evergreen</strong> = a per-visitor timer that persists across reloads; <strong>Fixed</strong> = one shared deadline for everyone.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Mode</label>
            <select className="field" value={f.countdown.mode} onChange={(e) => setCountdown("mode", e.target.value as "fixed" | "evergreen")}>
              <option value="evergreen">evergreen</option>
              <option value="fixed">fixed</option>
            </select>
          </div>
          <div>
            <label className="label">Evergreen hours</label>
            <input type="number" min={1} className="field" value={f.countdown.hours} onChange={(e) => setCountdown("hours", Math.max(1, +e.target.value))} />
          </div>
          <Field label="Fixed deadline (ISO)" value={f.countdown.deadline} onChange={(v) => setCountdown("deadline", v)} />
        </div>
      </section>

      {/* ---- Landing ---- */}
      <section className="space-y-4">
        <h3 className="font-display font-bold text-jh-ink">Landing page</h3>
        <div className="card p-5 grid sm:grid-cols-2 gap-4">
          <Field label="Header tag" value={f.landing.headTag} onChange={(v) => setLanding("headTag", v)} />
          <Field label="CTA label" value={f.landing.ctaLabel} onChange={(v) => setLanding("ctaLabel", v)} />
          <Field label="Brand name" value={f.landing.brandName} onChange={(v) => setLanding("brandName", v)} />
          <Field label="Brand accent" value={f.landing.brandAccent} onChange={(v) => setLanding("brandAccent", v)} />
          <Field label="Hero headline" value={f.landing.heroH1} onChange={(v) => setLanding("heroH1", v)} />
          <Field label="Hero headline accent (red)" value={f.landing.heroH1Accent} onChange={(v) => setLanding("heroH1Accent", v)} />
          <Field className="sm:col-span-2" textarea label="Hero sub" value={f.landing.heroSub} onChange={(v) => setLanding("heroSub", v)} />
          <Field label="Countdown label" value={f.landing.countdownLabel} onChange={(v) => setLanding("countdownLabel", v)} />
          <Field label="Proof row" value={f.landing.proofrow} onChange={(v) => setLanding("proofrow", v)} />
          <Field label="“What you get” eyebrow" value={f.landing.getEyebrow} onChange={(v) => setLanding("getEyebrow", v)} />
          <Field label="Footer" value={f.landing.footer} onChange={(v) => setLanding("footer", v)} />
          <Field label="Tagline" value={f.landing.tagline} onChange={(v) => setLanding("tagline", v)} />
        </div>

        {/* what-you-get bullets */}
        <div className="card p-5 space-y-3">
          <p className="font-display font-semibold text-jh-ink">“What you get” bullets</p>
          {f.landing.cards.map((c, i) => (
            <input key={i} className="field py-2 text-sm" value={c.title} onChange={(e) => setCard(i, { title: e.target.value })} placeholder="Bullet text" />
          ))}
        </div>
      </section>

      {/* ---- Details form (before the quiz) ---- */}
      <section className="space-y-4">
        <h3 className="font-display font-bold text-jh-ink">Details form (before the quiz)</h3>
        <div className="card p-5 grid sm:grid-cols-2 gap-4">
          <Field label="Eyebrow" value={f.details.eyebrow} onChange={(v) => setDetails("eyebrow", v)} />
          <Field label="Title" value={f.details.title} onChange={(v) => setDetails("title", v)} />
          <Field className="sm:col-span-2" textarea label="Lede" value={f.details.lede} onChange={(v) => setDetails("lede", v)} />
          <Field label="First-name label" value={f.details.firstNameLabel} onChange={(v) => setDetails("firstNameLabel", v)} />
          <Field label="Last-name label" value={f.details.lastNameLabel} onChange={(v) => setDetails("lastNameLabel", v)} />
          <Field label="Email label" value={f.details.emailLabel} onChange={(v) => setDetails("emailLabel", v)} />
          <Field label="Submit button" value={f.details.submitLabel} onChange={(v) => setDetails("submitLabel", v)} />
          <Field className="sm:col-span-2" label="Consent line" value={f.details.consent} onChange={(v) => setDetails("consent", v)} />
        </div>
      </section>

      {/* ---- Quiz ---- */}
      <section className="space-y-4">
        <div>
          <h3 className="font-display font-bold text-jh-ink">Quiz</h3>
          <p className="text-jh-mute text-sm">Edit each question, its options, and the per-option scoring. Q1 sets the archetype; Q2 + Q5 readiness points sum to 0–6; Q4 is the fit gate; Q3 routes the message. The open question is never scored.</p>
        </div>
        <div className="card p-5">
          <Field label="Footer note" value={f.quiz.footerNote} onChange={(v) => setQuizMeta("footerNote", v)} />
        </div>

        {f.quiz.questions.map((q, qi) => (
          <div key={q.id} className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-display font-semibold text-jh-ink">{q.id.toUpperCase()} · {q.kind === "text" ? "Open text (unscored)" : "Multiple choice"}</p>
              {q.kind === "choice" && (
                <label className="flex items-center gap-2 text-xs text-jh-mute">
                  <input type="checkbox" checked={!!q.allowOther} onChange={(e) => updateQuestion(qi, { allowOther: e.target.checked })} />
                  Allow free text on “Something else”
                </label>
              )}
            </div>
            <Field label="Prompt" value={q.prompt} onChange={(v) => updateQuestion(qi, { prompt: v })} />

            {q.kind === "text" && (
              <Field label="Placeholder" value={q.placeholder ?? ""} onChange={(v) => updateQuestion(qi, { placeholder: v })} />
            )}

            {q.kind === "choice" && q.options && (
              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-[1fr_4.5rem_8rem_6rem_8rem_2rem] gap-2 text-[11px] text-jh-mute-2 font-semibold px-1">
                  <span>Label</span><span>Readiness</span><span>Archetype</span><span>Fit gate</span><span>Flag</span><span>Other</span>
                </div>
                {q.options.map((o, oi) => (
                  <div key={o.id} className="grid sm:grid-cols-[1fr_4.5rem_8rem_6rem_8rem_2rem] grid-cols-2 gap-2 items-center">
                    <input className="field py-2 text-sm" value={o.label} onChange={(e) => updateOption(qi, oi, { label: e.target.value })} placeholder="Option label" />
                    <input className="field py-2 text-sm" type="number" min={0} value={o.readiness ?? ""} onChange={(e) => updateOption(qi, oi, { readiness: num(e.target.value) })} placeholder="pts" />
                    <select className="field py-2 text-sm" value={o.archetype ?? ""} onChange={(e) => updateOption(qi, oi, { archetype: (e.target.value || undefined) as any })}>
                      {ARCHETYPES.map((a) => <option key={a} value={a}>{a || "—"}</option>)}
                    </select>
                    <select className="field py-2 text-sm" value={o.fitGate ?? ""} onChange={(e) => updateOption(qi, oi, { fitGate: (e.target.value || undefined) as any })}>
                      {FIT_GATES.map((a) => <option key={a} value={a}>{a || "—"}</option>)}
                    </select>
                    <select className="field py-2 text-sm" value={o.flag ?? ""} onChange={(e) => updateOption(qi, oi, { flag: (e.target.value || undefined) as any })}>
                      {FLAGS.map((a) => <option key={a} value={a}>{a || "—"}</option>)}
                    </select>
                    <label className="grid place-items-center" title="Marks this as the “Something else” option">
                      <input type="checkbox" checked={!!o.isOther} onChange={(e) => updateOption(qi, oi, { isOther: e.target.checked })} />
                    </label>
                    {o.obstacle !== undefined && (
                      <input className="field py-2 text-sm sm:col-span-6" value={o.obstacle} onChange={(e) => updateOption(qi, oi, { obstacle: e.target.value })} placeholder="Obstacle routing label (Q3)" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ---- Thank-you ---- */}
      <section className="space-y-4">
        <h3 className="font-display font-bold text-jh-ink">Thank-you page</h3>
        <div className="card p-5 grid sm:grid-cols-2 gap-4">
          <Field label="Eyebrow" value={f.lead.eyebrow} onChange={(v) => setLead("eyebrow", v)} />
          <Field label="Title" value={f.lead.title} onChange={(v) => setLead("title", v)} />
          <Field className="sm:col-span-2" textarea label="Body" value={f.lead.body} onChange={(v) => setLead("body", v)} />
          <Field label="CTA label" value={f.lead.ctaLabel} onChange={(v) => setLead("ctaLabel", v)} />
          <Field label="Fine print" value={f.lead.fine} onChange={(v) => setLead("fine", v)} />
          <Field label="Tagline" value={f.lead.tagline} onChange={(v) => setLead("tagline", v)} />
        </div>
      </section>

      {/* ---- Expired-link experience ---- */}
      <section className="space-y-4">
        <div>
          <h3 className="font-display font-bold text-jh-ink">Expired-link experience</h3>
          <p className="text-jh-mute text-sm">Shown when a registration link has expired — invites people to your next meetup for a fresh invite.</p>
        </div>
        <div className="card p-5 grid sm:grid-cols-2 gap-4">
          <Field label="Eyebrow" value={f.expired.eyebrow} onChange={(v) => setExpired("eyebrow", v)} />
          <Field label="Title" value={f.expired.title} onChange={(v) => setExpired("title", v)} />
          <Field className="sm:col-span-2" textarea label="Body" value={f.expired.body} onChange={(v) => setExpired("body", v)} />
          <Field label="CTA label" value={f.expired.ctaLabel} onChange={(v) => setExpired("ctaLabel", v)} />
          <Field label="Meetup URL" value={f.expired.meetupUrl} onChange={(v) => setExpired("meetupUrl", v)} />
        </div>
      </section>

      {/* ---- Already-done / registered screen ---- */}
      <section className="space-y-4">
        <div>
          <h3 className="font-display font-bold text-jh-ink">“Already done” screen</h3>
          <p className="text-jh-mute text-sm">Shown when someone who already completed the quiz, or is already registered in Compass, tries to take it again.</p>
        </div>
        <div className="card p-5 grid sm:grid-cols-2 gap-4">
          <Field label="Title" value={f.blocked.title} onChange={(v) => setBlocked("title", v)} />
          <Field label="CTA label" value={f.blocked.ctaLabel} onChange={(v) => setBlocked("ctaLabel", v)} />
          <Field className="sm:col-span-2" textarea label="Body" value={f.blocked.body} onChange={(v) => setBlocked("body", v)} />
          <Field label="CTA link" value={f.blocked.ctaHref} onChange={(v) => setBlocked("ctaHref", v)} />
        </div>
      </section>

      {/* sticky save */}
      <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-jh-paper/90 backdrop-blur border-t border-jh-line flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save funnel"}</button>
        {saved && <span className="text-sm text-rb-green-dark">Saved ✓ — live now</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea, className }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {textarea
        ? <textarea className="field min-h-20" value={value} onChange={(e) => onChange(e.target.value)} />
        : <input className="field" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

/* ---------------- Event tracking ---------------- */
function EventTracking() {
  const [cfg, setCfg] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { authedFetch("/api/admin/events").then((r) => r.json()).then((d) => d.ok && setCfg(d.config)); }, []);

  function update(key: string, patch: any) { setCfg((c) => ({ ...c!, [key]: { ...c![key], ...patch } })); setSaved(false); }

  async function save() {
    setBusy(true); setSaved(false);
    const r = await authedFetch("/api/admin/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: cfg }) });
    if (r.ok) { setCfg((await r.json()).config); setSaved(true); }
    setBusy(false);
  }

  if (!cfg) return <p className="text-jh-mute animate-pulse">Loading events…</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl">Event tracking</h2>
        <p className="text-jh-mute text-sm mt-1">Switch which events are sent to Supabase and rename their tags. Disabled events are skipped entirely.</p>
      </div>
      <div className="card divide-y divide-jh-line">
        {Object.entries(cfg).map(([key, e]: [string, any]) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
            <div className="sm:w-44 shrink-0">
              <p className="font-display font-semibold text-jh-ink text-sm">{e.label}</p>
              <p className="text-[11px] text-jh-mute-2 font-mono">{key}</p>
            </div>
            <input value={e.tag} onChange={(ev) => update(key, { tag: ev.target.value })}
              className="field py-2 text-xs font-mono flex-1" />
            <select value={e.stage} onChange={(ev) => update(key, { stage: ev.target.value })} className="field py-2 w-auto text-sm">
              <option value="acquisition">acquisition</option>
              <option value="activation">activation</option>
              <option value="retention">retention</option>
            </select>
            <Toggle on={e.enabled} onChange={(v) => update(key, { enabled: v })} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save event settings"}</button>
        {saved && <span className="text-sm text-rb-green-dark">Saved ✓</span>}
      </div>
    </div>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-pill transition shrink-0 ${on ? "bg-rb-green-dark" : "bg-jh-line-2"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/* ---------------- Registration links ---------------- */
function RegistrationLinks() {
  const [expiryHours, setExpiryHours] = useState(48);
  const [accessDurationDays, setAccessDurationDays] = useState(90);
  const [maxUses, setMaxUses] = useState(1);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const res = await authedFetch("/api/admin/registration-link");
    if (res.ok) setLinks((await res.json()).links ?? []);
  }
  useEffect(() => { load(); }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const res = await authedFetch("/api/admin/registration-link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiryHours, accessDurationDays, maxUses, email: email || null }),
    });
    if (res.ok) { setEmail(""); await load(); }
    setBusy(false);
  }
  const urlFor = (t: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/register/${t}`;
  async function copy(t: string) { await navigator.clipboard.writeText(urlFor(t)); setCopied(t); setTimeout(() => setCopied(null), 1500); }
  const fmt = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2"><LinkIcon className="h-5 w-5 text-jh-red" /><h2 className="text-xl">Registration links</h2></div>
      <p className="text-sm text-jh-mute">Generate a temporary signup link that grants timed access.</p>
      <form onSubmit={generate} className="card p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div><label className="label">Link valid (hours)</label><input type="number" min={1} className="field" value={expiryHours} onChange={(e) => setExpiryHours(+e.target.value)} /></div>
        <div><label className="label">Access (days)</label><input type="number" min={1} className="field" value={accessDurationDays} onChange={(e) => setAccessDurationDays(+e.target.value)} /></div>
        <div><label className="label">Max uses</label><input type="number" min={1} className="field" value={maxUses} onChange={(e) => setMaxUses(+e.target.value)} /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label">Lock to email</label><input className="field" placeholder="anyone" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="col-span-2 sm:col-span-4"><button disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Generating…" : "Generate link"}</button></div>
      </form>
      {links.length > 0 && (
        <ul className="card divide-y divide-jh-line">
          {links.map((l) => (
            <li key={l.token} className="py-3 px-4 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono text-jh-ink truncate">/register/{l.token.slice(0, 12)}…</p>
                <p className="text-xs text-jh-mute">{l.accessDurationDays}d access · {l.uses}/{l.maxUses} used · {l.email ? `${l.email} · ` : ""}
                  <span className={l.status === "active" ? "text-rb-green-dark" : "text-jh-mute"}>{l.status === "active" ? `valid till ${fmt(l.expiresAt)}` : l.status}</span></p>
              </div>
              <button onClick={() => copy(l.token)} disabled={l.status !== "active"} className="btn-secondary text-xs px-3 py-2 disabled:opacity-40">
                {copied === l.token ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
