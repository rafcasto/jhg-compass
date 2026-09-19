"use client";

import { useMemo, useState } from "react";
import { Radar, Sparkles, X, ExternalLink } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { paths, useLiveCollection } from "@/lib/firestore/db";
import { postJson } from "@/components/admin/shared";
import type { PipelineItem } from "@/lib/careerops/types";
import JobStatus from "./JobStatus";

// Agents → Scan. Run the Scout over the member's portals; triage what it found.
export default function Scan({ uid, hasPortals, online, onEvaluateQueued }: { uid: string; hasPortals: boolean; online: boolean; onEvaluateQueued: (jobId: string) => void }) {
  const { data: items } = useLiveCollection<PipelineItem>(uid, paths.careerOpsPipeline, "foundAt");
  const [scanJob, setScanJob] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);
  const shown = showAll ? items : pending;

  async function scan() {
    setBusy("scan"); setErr(null);
    try {
      const r = await postJson("/api/agents/jobs", { type: "scan" });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error ?? "Couldn't start the scan."); return; }
      setScanJob(d.job.id);
    } catch { setErr("Couldn't start the scan."); }
    finally { setBusy(null); }
  }
  async function evaluate(it: PipelineItem) {
    setBusy(it.id); setErr(null);
    try {
      const r = await postJson("/api/agents/jobs", { type: "evaluate", url: it.url, pipelineId: it.id });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error ?? "Couldn't queue the evaluation."); return; }
      onEvaluateQueued(d.job.id);
    } catch { setErr("Couldn't queue the evaluation."); }
    finally { setBusy(null); }
  }
  const dismiss = (it: PipelineItem) => updateDoc(doc(paths.careerOpsPipeline(uid), it.id), { status: "dismissed", updatedAt: Date.now() });
  const restore = (it: PipelineItem) => updateDoc(doc(paths.careerOpsPipeline(uid), it.id), { status: "pending", updatedAt: Date.now() });

  return (
    <div className="space-y-5">
      <section className="card p-5 space-y-3">
        <h2 className="text-lg flex items-center gap-2"><Radar className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> Scout</h2>
        <p className="text-jh-mute text-sm max-w-2xl">Checks the careers pages in your Setup for postings whose titles match your keywords. New ones land below; evaluate the ones that look right. Nothing is applied to.</p>
        {!hasPortals && <p className="text-sm text-jh-red">Add at least one company under <strong>Setup → Portals</strong> first.</p>}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={scan} disabled={busy === "scan" || !hasPortals || !!scanJob} className="btn-primary disabled:opacity-60"><Radar className="h-4 w-4" /> {busy === "scan" ? "Starting…" : "Scan now"}</button>
          {!online && <span className="text-xs text-jh-mute">The agents are asleep — the scan will wait in the queue.</span>}
          {err && <p role="alert" className="text-sm text-jh-red">{err}</p>}
        </div>
        {scanJob && <JobStatus jobId={scanJob} onDone={() => setScanJob(null)} onGone={() => setScanJob(null)} />}
      </section>

      <section className="card divide-y divide-jh-line">
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg">{pending.length} pending posting{pending.length === 1 ? "" : "s"}</h2>
          <button type="button" onClick={() => setShowAll((v) => !v)} className="btn-ghost text-xs">{showAll ? "Show pending only" : `Show all (${items.length})`}</button>
        </div>
        {shown.length === 0 ? <p className="px-5 py-8 text-center text-jh-mute">{items.length === 0 ? "Nothing yet — run a scan." : "No pending postings. Run another scan or show all."}</p> : (
          <ul className="divide-y divide-jh-line">
            {shown.map((it) => (
              <li key={it.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-jh-ink truncate">{it.title} <span className="font-normal text-jh-mute">· {it.company}</span></p>
                  <p className="text-xs text-jh-mute truncate">{it.location ?? "—"} · found {new Date(it.foundAt).toLocaleDateString()}{it.status !== "pending" ? ` · ${it.status}${it.score != null ? ` ${it.score}/5` : ""}` : ""}</p>
                </div>
                <a href={it.url} target="_blank" rel="noreferrer" className="btn-ghost p-2" aria-label="Open posting"><ExternalLink className="h-4 w-4" /></a>
                {it.status === "pending" ? (
                  <>
                    <button type="button" onClick={() => evaluate(it)} disabled={busy === it.id} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-60"><Sparkles className="h-3.5 w-3.5" /> Evaluate</button>
                    <button type="button" onClick={() => dismiss(it)} className="btn-ghost p-2 text-jh-mute" aria-label="Dismiss"><X className="h-4 w-4" /></button>
                  </>
                ) : it.status === "dismissed" ? <button type="button" onClick={() => restore(it)} className="btn-ghost text-xs">Restore</button> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
