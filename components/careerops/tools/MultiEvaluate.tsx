"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Layers, Radar } from "lucide-react";
import { postJson } from "@/components/admin/shared";
import JobStatus from "@/components/agents/JobStatus";
import { ScoreBadge } from "@/components/agents/ReportView";
import { toolHref } from "@/lib/careerops/portal-nav";
import type { ToolProps } from "../SectionScreen";
import { isHttp, splitLines } from "../shared";

// Shared by Sourcing → pipeline (1+, auto-pipeline), Scoring → ofertas (2–9) and
// Scoring → batch (10+). Each posting becomes its own evaluate job; the table
// below ranks the reports as they land.
const LIMITS: Record<string, { min: number; max: number; auto: boolean; verb: string }> = {
  pipeline: { min: 1, max: 40, auto: true, verb: "Run the auto-pipeline" },
  ofertas: { min: 2, max: 9, auto: false, verb: "Score them" },
  batch: { min: 10, max: 50, auto: false, verb: "Score and rank" },
};

export default function MultiEvaluate({ ctx, tool }: ToolProps) {
  const lim = LIMITS[tool] ?? LIMITS.ofertas;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [queued, setQueued] = useState<{ id: string; url: string }[]>([]);
  const [showPending, setShowPending] = useState(false);

  const urls = useMemo(() => Array.from(new Set(splitLines(text))).filter(isHttp), [text]);
  const bad = useMemo(() => splitLines(text).filter((l) => !isHttp(l)), [text]);
  const pending = useMemo(() => ctx.reports.length ? [] : [], [ctx.reports.length]); // placeholder to keep hooks stable
  void pending;

  async function submit() {
    setErr(null); setBusy(true);
    const done: { id: string; url: string }[] = [];
    try {
      for (const url of urls.slice(0, lim.max)) {
        const r = await postJson("/api/agents/jobs", { type: "evaluate", url, ...(lim.auto ? { autoPipeline: true } : {}) });
        const d = await r.json();
        if (!r.ok || !d.ok) { setErr(`${done.length ? `Queued ${done.length}, then: ` : ""}${d.error ?? "couldn't queue"}`); break; }
        done.push({ id: d.job.id, url });
      }
    } finally { setQueued((q) => [...done, ...q]); setBusy(false); if (done.length === urls.length) setText(""); }
  }

  const ranked = useMemo(() => {
    const ids = new Set(queued.map((q) => q.id));
    return ctx.reports.filter((r) => ids.has(r.jobId)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [ctx.reports, queued]);
  const stillRunning = queued.filter((q) => !ctx.reports.some((r) => r.jobId === q.id));
  const tooFew = urls.length > 0 && urls.length < lim.min;

  return (
    <div className="space-y-5">
      <section className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><Layers className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> {lim.min === lim.max ? `${lim.min}` : `${lim.min}–${lim.max}`} posting URLs, one per line</h3>
        {!ctx.hasCv && <p className="text-sm text-jh-red">Add your CV in Setup first.</p>}
        <textarea aria-label="Posting URLs" className="field font-mono text-xs min-h-[10rem]" placeholder={"https://jobs.lever.co/…\nhttps://boards.greenhouse.io/…\nhttps://careers.example.com/…"} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center gap-3 flex-wrap text-xs text-jh-mute">
          <span>{urls.length} valid URL{urls.length === 1 ? "" : "s"}{bad.length ? ` · ${bad.length} line${bad.length === 1 ? "" : "s"} ignored (not a URL)` : ""}</span>
          {lim.auto && <span>· auto-pipeline: score → report → tailored CV when ≥ 4.0 → pending card on your Progress board</span>}
          {tool !== "pipeline" && <span>· each posting uses one run of your daily quota</span>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={submit} disabled={busy || !ctx.hasCv || urls.length < lim.min || urls.length > lim.max} className="btn-primary disabled:opacity-60">{busy ? "Queuing…" : lim.verb}</button>
          {tooFew && <span className="text-xs text-jh-mute">{tool === "batch" ? <>Fewer than 10? Use <Link className="underline" href={toolHref("scoring", "ofertas")}>ofertas</Link>.</> : `Add at least ${lim.min}.`}</span>}
          {urls.length > lim.max && <span className="text-xs text-jh-red">Max {lim.max} at once{tool === "ofertas" ? <> — use <Link className="underline" href={toolHref("scoring", "batch")}>batch</Link> for more</> : ""}.</span>}
          {!ctx.online && <span className="text-xs text-jh-mute">Agents asleep — jobs wait in the queue.</span>}
          {err && <p role="alert" className="text-sm text-jh-red">{err}</p>}
        </div>
        {tool === "pipeline" && (
          <p className="text-xs text-jh-mute flex items-center gap-1"><Radar className="h-3.5 w-3.5" /> Postings the Scout found are on <Link className="underline" href={toolHref("sourcing", "scan")}>scan</Link> — evaluate them from there.</p>
        )}
      </section>

      {stillRunning.length > 0 && (
        <section className="card p-5 space-y-2">
          <p className="text-sm font-display font-semibold text-jh-ink">In flight ({stillRunning.length})</p>
          {stillRunning.map((q) => <div key={q.id} className="text-xs"><p className="font-mono text-jh-mute truncate">{q.url}</p><JobStatus jobId={q.id} /></div>)}
        </section>
      )}

      {ranked.length > 0 && (
        <section className="card divide-y divide-jh-line">
          <div className="px-5 py-3 flex items-center justify-between"><p className="text-sm font-display font-semibold text-jh-ink">Ranked ({ranked.length}{stillRunning.length ? ` of ${queued.length}` : ""})</p><button type="button" onClick={() => setShowPending((v) => !v)} className="btn-ghost text-xs">{showPending ? "Hide" : "Show"} details</button></div>
          <ol>
            {ranked.map((r, i) => (
              <li key={r.id} className="px-5 py-3 flex items-center gap-4">
                <span className="text-jh-mute-2 tabular-nums w-5">{i + 1}</span>
                <ScoreBadge score={r.score} />
                <span className="flex-1 min-w-0">
                  <Link href={`${toolHref("scoring", "oferta")}&job=${r.jobId}`} className="block font-semibold text-jh-ink truncate hover:text-jh-red">{r.company} — {r.role}</Link>
                  {showPending && <span className="block text-xs text-jh-mute truncate">{r.archetype} · {r.legitimacy}{r.addedOpportunityId ? " · on your board" : ""}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
