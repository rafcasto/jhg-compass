"use client";

import { useMemo, useState } from "react";
import { Sparkles, TrendingDown } from "lucide-react";
import { paths, useLiveCollection } from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import type { Opportunity } from "@/lib/types";
import type { CareerOpsNote } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";
import { NoteHistory, NoteView, useNoteJob } from "../shared";

// Tracking → patterns: quick local stats now, the agent's structured analysis on demand.
export default function Patterns({ ctx }: ToolProps) {
  const { stages } = useContent();
  const { data: opps } = useLiveCollection<Opportunity>(ctx.uid, paths.opportunities);
  const [open, setOpen] = useState<CareerOpsNote | null>(null);
  const job = useNoteJob(ctx.notes, "patterns");
  const shown = job.note ?? open ?? ctx.notes.find((n) => n.kind === "patterns") ?? null;
  const rejectedIds = useMemo(() => new Set(stages.filter((s) => /reject|discard|closed|declin/i.test(s.id + s.label)).map((s) => s.id)), [stages]);

  const stats = useMemo(() => {
    const byArch = new Map<string, { n: number; sum: number; rejected: number }>();
    const rejectedOpp = new Set(opps.filter((o) => rejectedIds.has(o.stage)).map((o) => o.id));
    for (const r of ctx.reports) {
      const k = (r.archetype || "Unknown").replace(/^Other:\s*/i, "");
      const e = byArch.get(k) ?? { n: 0, sum: 0, rejected: 0 };
      e.n++; e.sum += r.score ?? 0; if (r.addedOpportunityId && rejectedOpp.has(r.addedOpportunityId)) e.rejected++;
      byArch.set(k, e);
    }
    const arch = [...byArch.entries()].map(([k, v]) => ({ k, n: v.n, avg: v.n ? v.sum / v.n : 0, rejected: v.rejected })).sort((a, b) => b.n - a.n).slice(0, 8);
    const buckets = { strong: 0, good: 0, maybe: 0, skip: 0 };
    for (const r of ctx.reports) { const s = r.score ?? 0; if (s >= 4.5) buckets.strong++; else if (s >= 4) buckets.good++; else if (s >= 3.5) buckets.maybe++; else buckets.skip++; }
    return { arch, buckets, rejected: rejectedOpp.size, legit: ctx.reports.filter((r) => /suspicious|caution/i.test(r.legitimacy)).length };
  }, [ctx.reports, opps, rejectedIds]);

  const enough = ctx.reports.length >= 3;
  return (
    <div className="space-y-5">
      <section className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><TrendingDown className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> The numbers so far</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <Stat v={ctx.reports.length} l="Postings scored" />
          <Stat v={`${stats.buckets.strong + stats.buckets.good} / ${stats.buckets.maybe} / ${stats.buckets.skip}`} l="apply / maybe / skip" />
          <Stat v={stats.rejected} l="Rejected or discarded on the board" />
          <Stat v={stats.legit} l="Postings flagged caution / suspicious" />
        </div>
        {stats.arch.length > 0 && (
          <table className="w-full text-sm"><thead><tr className="text-left text-jh-mute border-b border-jh-line"><th className="font-semibold py-1.5 pr-3">Archetype</th><th className="font-semibold py-1.5 pr-3">Scored</th><th className="font-semibold py-1.5 pr-3">Avg score</th><th className="font-semibold py-1.5">Rejected</th></tr></thead>
            <tbody>{stats.arch.map((a) => <tr key={a.k} className="border-b border-jh-line last:border-0"><td className="py-1.5 pr-3 text-jh-ink">{a.k}</td><td className="py-1.5 pr-3 tabular-nums">{a.n}</td><td className="py-1.5 pr-3 tabular-nums">{a.avg.toFixed(1)}</td><td className="py-1.5 tabular-nums">{a.rejected || "·"}</td></tr>)}</tbody></table>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => { setOpen(null); job.run({ type: "patterns" }); }} disabled={job.busy || !enough || (!!job.jobId && !job.note && !job.failed)} className="btn-primary disabled:opacity-60"><Sparkles className="h-4 w-4" /> {job.busy ? "Queuing…" : "Analyse the patterns"}</button>
          <span className="text-xs text-jh-mute">{enough ? "Reads every report and every rejected/discarded card: industry, size, seniority, keywords, blockers → what to change in your targeting." : "Score at least 3 postings first — there's no pattern in one data point."}</span>
          {job.err && <p role="alert" className="text-sm text-jh-red">{job.err}</p>}
        </div>
        {job.status}
      </section>
      {shown && <NoteView note={shown} />}
      <NoteHistory notes={ctx.notes} kind="patterns" onOpen={(n) => { job.reset(); setOpen(n); }} current={shown?.id} />
    </div>
  );
}
function Stat({ v, l }: { v: number | string; l: string }) { return <div className="rounded-md bg-jh-mist p-3"><div className="font-display font-extrabold text-xl text-jh-ink tabular-nums">{v}</div><div className="text-xs text-jh-mute">{l}</div></div>; }
