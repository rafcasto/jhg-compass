"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Columns3, Check, ExternalLink, FileText, PenLine, MessageSquare } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { createDoc, paths, useLiveCollection } from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import { ScoreBadge } from "@/components/agents/ReportView";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";
import { toolHref } from "@/lib/careerops/portal-nav";
import type { Opportunity } from "@/lib/types";
import type { CareerOpsReport } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";

// Tracking → tracker: every evaluation joined to its board card, documents and notes.
// The Progress board (Compass → Progress) stays the tracker of record; this is the
// CareerOps view over it.
export default function Tracker({ ctx }: ToolProps) {
  const { stages } = useContent();
  const { data: opps } = useLiveCollection<Opportunity>(ctx.uid, paths.opportunities);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "board" | "unboarded">("all");
  const oppById = useMemo(() => new Map(opps.map((o) => [o.id, o])), [opps]);
  const stageLabel = (id: string) => stages.find((s) => s.id === id)?.label ?? id;

  const rows = useMemo(() => ctx.reports.map((r) => {
    const opp = r.addedOpportunityId ? oppById.get(r.addedOpportunityId) : undefined;
    const docs = ctx.docs.filter((d) => d.reportJobId === r.jobId);
    const notes = ctx.notes.filter((n) => n.reportJobId === r.jobId);
    return { r, opp, cv: docs.some((d) => d.kind === "cv"), cover: docs.some((d) => d.kind === "cover"), notes: notes.length, replies: opp?.log?.length ?? 0 };
  }).filter((x) => filter === "all" || (filter === "board" ? !!x.opp : !x.opp)), [ctx.reports, ctx.docs, ctx.notes, oppById, filter]);

  const counts = useMemo(() => {
    const byStage: Record<string, number> = {};
    for (const o of opps) byStage[o.stage] = (byStage[o.stage] ?? 0) + 1;
    return byStage;
  }, [opps]);

  async function addToBoard(r: CareerOpsReport) {
    setBusy(r.id);
    try {
      const ref = await createDoc(paths.opportunities(ctx.uid), {
        company: r.company, role: r.role, market: "visible", stage: stages[0].id, contactIds: [], log: [],
        source: "CareerOps · Evaluator", url: r.url ?? "", notes: `Evaluator score ${r.score ?? "?"}/5 · ${r.archetype} · ${r.legitimacy}`,
      });
      await updateDoc(doc(paths.careerOpsReports(ctx.uid), r.id), { addedOpportunityId: ref.id });
      track(TAGS.ADD_OPPORTUNITY, { source: "careerops", props: { from: "tracker", score: r.score } });
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat value={ctx.reports.length} label="Evaluated" />
        <Stat value={ctx.reports.filter((r) => r.addedOpportunityId).length} label="On the board" />
        <Stat value={opps.filter((o) => /application|interview|offer|negotiation/.test(o.stage)).length} label="Applied or further" />
        <Stat value={opps.reduce((n, o) => n + (o.log?.length ?? 0), 0)} label="Logged replies & notes" />
      </div>

      <section className="card divide-y divide-jh-line">
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div role="tablist" className="inline-flex gap-1 rounded-pill bg-jh-mist p-1">
            {(["all", "board", "unboarded"] as const).map((f) => <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-pill text-xs font-display font-semibold ${filter === f ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute"}`}>{f === "all" ? "All" : f === "board" ? "On the board" : "Not on the board"}</button>)}
          </div>
          <Link href="/tracker" className="btn-ghost text-xs"><Columns3 className="h-3.5 w-3.5" /> Open the Progress board</Link>
        </div>
        {rows.length === 0 ? <p className="px-5 py-8 text-center text-jh-mute text-sm">Nothing here yet — score a posting first.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-jh-mute border-b border-jh-line">{["Score", "Company · role", "Stage", "CV", "Letter", "Notes", "Replies", "Evaluated", ""].map((h) => <th key={h} className="font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ r, opp, cv, cover, notes, replies }) => (
                <tr key={r.id} className="border-b border-jh-line last:border-0">
                  <td className="px-3 py-2"><ScoreBadge score={r.score} /></td>
                  <td className="px-3 py-2 min-w-[14rem]"><Link href={`${toolHref("scoring", "oferta")}&job=${r.jobId}`} className="font-semibold text-jh-ink hover:text-jh-red">{r.company}</Link><span className="block text-xs text-jh-mute truncate max-w-[18rem]">{r.role}</span></td>
                  <td className="px-3 py-2 whitespace-nowrap">{opp ? <span className="pill bg-jh-mist text-jh-ink">{stageLabel(opp.stage)}</span> : <span className="text-xs text-jh-mute-2">—</span>}</td>
                  <td className="px-3 py-2">{cv ? <FileText className="h-4 w-4 text-rb-green-dark" aria-label="Tailored CV ready" /> : <span className="text-jh-mute-2">·</span>}</td>
                  <td className="px-3 py-2">{cover ? <PenLine className="h-4 w-4 text-rb-green-dark" aria-label="Cover letter ready" /> : <span className="text-jh-mute-2">·</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{notes || <span className="text-jh-mute-2">·</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{replies ? <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5 text-jh-mute" />{replies}</span> : <span className="text-jh-mute-2">·</span>}</td>
                  <td className="px-3 py-2 text-xs text-jh-mute whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="flex gap-1">
                      {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="btn-ghost p-1.5" aria-label="Open posting"><ExternalLink className="h-4 w-4" /></a>}
                      {opp ? <span className="inline-flex items-center gap-1 text-xs text-rb-green-dark px-1.5"><Check className="h-3.5 w-3.5" /> board</span>
                        : <button type="button" onClick={() => addToBoard(r)} disabled={busy === r.id} className="btn-secondary text-xs px-2.5 py-1 disabled:opacity-60">{busy === r.id ? "…" : "Add to board"}</button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      {Object.keys(counts).length > 0 && (
        <p className="text-xs text-jh-mute">Board: {stages.filter((s) => counts[s.id]).map((s) => `${s.label} ${counts[s.id]}`).join(" · ")}</p>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="card p-4"><div className="font-display font-extrabold text-2xl text-jh-ink tabular-nums">{value}</div><div className="text-xs text-jh-mute">{label}</div></div>;
}
