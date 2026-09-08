"use client";

import { useState } from "react";
import { ChartCard, CHART_COLORS, Donut, HBar, Legend, TimeLine } from "./charts";
import { Empty } from "@/components/admin/shared";

export type Analytics = {
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

const VIEWS = ["Quiz answers", "Respondents", "Archetypes", "Readiness & fit", "Completions over time", "Open responses"] as const;
type View = (typeof VIEWS)[number];

// The raw quiz output, sliceable. Segmentation of these respondents into the
// 4-quadrant matrix lives on the Segments sub-tab.
export default function QuizResults({ data }: { data: Analytics }) {
  const [view, setView] = useState<View>("Quiz answers");
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <p className="text-jh-mute text-sm">{data.total} quiz {data.total === 1 ? "completion" : "completions"} captured. Switch views to slice the data.</p>
        <div>
          <label htmlFor="quiz-view" className="label">View</label>
          <select id="quiz-view" className="field w-auto min-w-56" value={view} onChange={(e) => setView(e.target.value as View)}>
            {VIEWS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      {data.total === 0 ? <Empty>No quiz completions yet.</Empty> : (
        <>
          {view === "Quiz answers" && <QuizAnswers data={data} />}
          {view === "Respondents" && <Respondents data={data} />}
          {view === "Archetypes" && <Archetypes data={data} />}
          {view === "Readiness & fit" && <ReadinessFit data={data} />}
          {view === "Completions over time" && (
            <ChartCard title="Quiz completions over time" subtitle="Daily completed quizzes">
              <TimeLine data={data.timeseries} keys={[{ key: "count", label: "Completions" }]} />
            </ChartCard>
          )}
          {view === "Open responses" && <OpenResponses data={data} />}
        </>
      )}
    </div>
  );
}

function QuizAnswers({ data }: { data: Analytics }) {
  if (!data.questionBreakdowns.length) return <Empty>No scored questions configured in the quiz.</Empty>;
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

export function fitPill(f: string) {
  return f === "qualified" ? "bg-rb-green-light/20 text-rb-green-dark"
    : f === "below-icp" ? "bg-jh-red-soft text-jh-red"
    : "bg-jh-mist text-jh-mute";
}

function Respondents({ data }: { data: Analytics }) {
  const [sortKey, setSortKey] = useState<"score" | "fit">("score");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [open, setOpen] = useState<number | null>(null);
  const fitRank = (f: string) => (f === "qualified" ? 2 : f === "below-icp" ? 1 : 0);
  const rows = [...data.responses].sort((a, b) => {
    let d = sortKey === "score" ? (a.score ?? -1) - (b.score ?? -1) : fitRank(a.fit) - fitRank(b.fit);
    if (d === 0) d = (a.score ?? -1) - (b.score ?? -1);
    return dir === "desc" ? -d : d;
  });
  const choiceQs = data.questionMeta.filter((q) => q.kind === "choice");
  const openQ = data.questionMeta.find((q) => q.kind === "text");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="resp-sort" className="label">Sort by</label>
          <select id="resp-sort" className="field w-auto" value={sortKey} onChange={(e) => setSortKey(e.target.value as "score" | "fit")}>
            <option value="score">Readiness score</option>
            <option value="fit">Fit</option>
          </select>
        </div>
        <div>
          <label htmlFor="resp-dir" className="label">Order</label>
          <select id="resp-dir" className="field w-auto" value={dir} onChange={(e) => setDir(e.target.value as "desc" | "asc")}>
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
              <button onClick={() => setOpen(isOpen ? null : i)} className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-jh-paper/60 transition">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-jh-ink truncate">{r.name}</p>
                  <p className="text-xs text-jh-mute truncate">{r.email}</p>
                </div>
                <span className="pill bg-jh-mist text-jh-ink capitalize">{r.archetype}</span>
                <span className={`pill ${fitPill(r.fit)} capitalize`}>{r.fit}</span>
                <span className="pill bg-jh-mist text-jh-ink" title="Readiness score (0–6)">Score {r.score ?? "—"}</span>
                {r.grade && r.grade !== "—" && <span className="pill bg-jh-mist text-jh-ink">{r.grade}</span>}
                <span className="text-jh-mute text-xs tabular-nums">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-jh-line px-4 py-4 space-y-3 bg-jh-paper/40">
                  {choiceQs.map((q) => (
                    <div key={q.id} className="grid sm:grid-cols-[1fr_1.2fr] gap-1 sm:gap-3">
                      <p className="text-sm text-jh-mute"><span className="font-mono text-[11px] text-jh-mute-2">{q.id.toUpperCase()}</span> {q.prompt}</p>
                      <p className="text-sm font-medium text-jh-ink">{r.answers[q.id] ?? "—"}</p>
                    </div>
                  ))}
                  {openQ && (
                    <div className="grid sm:grid-cols-[1fr_1.2fr] gap-1 sm:gap-3">
                      <p className="text-sm text-jh-mute"><span className="font-mono text-[11px] text-jh-mute-2">{openQ.id.toUpperCase()}</span> {openQ.prompt}</p>
                      <p className="text-sm font-medium text-jh-ink whitespace-pre-wrap">{r.q6 || "—"}</p>
                    </div>
                  )}
                  {others.map(([k, v]) => (
                    <div key={k} className="grid sm:grid-cols-[1fr_1.2fr] gap-1 sm:gap-3">
                      <p className="text-sm text-jh-mute"><span className="font-mono text-[11px] text-jh-mute-2">{k.toUpperCase()}</span> “Something else”</p>
                      <p className="text-sm font-medium text-jh-ink">{v as string}</p>
                    </div>
                  ))}
                  {r.created_at && <p className="text-xs text-jh-mute-2 pt-1">Completed {new Date(r.created_at).toLocaleString()}</p>}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <Empty>No respondents yet.</Empty>}
      </div>
    </div>
  );
}

function Archetypes({ data }: { data: Analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Archetype mix" subtitle="Who’s taking the quiz"><Donut rows={data.archetype} /><Legend rows={data.archetype} /></ChartCard>
      <ChartCard title="Top obstacles" subtitle="Message-routing label (Q3)"><HBar rows={data.obstacle} color={CHART_COLORS[2]} /></ChartCard>
      {data.flags.length > 0 && (
        <ChartCard title="Flags raised" subtitle="ai-anxious · vip-signal · below-icp · manual-review"><HBar rows={data.flags} color={CHART_COLORS[6]} /></ChartCard>
      )}
    </div>
  );
}

function ReadinessFit({ data }: { data: Analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Readiness score" subtitle="0–6 points (higher = warmer lead)">
        <HBar rows={data.readiness.map((r) => ({ label: `${r.label} pts`, count: r.count }))} color={CHART_COLORS[0]} />
      </ChartCard>
      <ChartCard title="Fit gate" subtitle="qualified vs below-icp (Q4)"><Donut rows={data.fit} /><Legend rows={data.fit} /></ChartCard>
      <ChartCard title="Triage grade" subtitle="Computed lead grade"><HBar rows={data.grade} color={CHART_COLORS[4]} /></ChartCard>
    </div>
  );
}

function OpenResponses({ data }: { data: Analytics }) {
  const rows = data.openResponses;
  if (!rows.length) return <Empty>No free-text answers yet.</Empty>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-jh-mute border-b border-jh-line">
            {["Name", "Email", "Open answer / “Something else”", "Date"].map((h) => <th key={h} className="font-semibold px-4 py-3 whitespace-nowrap">{h}</th>)}
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
                  {others.map(([k, v]) => <p key={k} className="text-jh-mute text-xs mt-1"><span className="font-mono">{k}</span>: {v as string}</p>)}
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
