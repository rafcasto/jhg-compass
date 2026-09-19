"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, XCircle } from "lucide-react";
import { authed, postJson } from "@/components/admin/shared";
import { isTerminal } from "@/lib/careerops/keys";
import type { CareerOpsJob } from "@/lib/careerops/types";

// Agents → Evaluate. Paste a URL or the JD → job → live status until the
// worker's report appears (the parent watches Firestore and swaps to it).
export default function Evaluate({ hasCv, onQueued, onDone, online }: { hasCv: boolean; onQueued?: (id: string) => void; onDone: (jobId: string) => void; online: boolean }) {
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [job, setJob] = useState<CareerOpsJob | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function watch(id: string) {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const d = await (await authed(`/api/agents/jobs/${id}`)).json();
        if (!d.ok) return;
        setJob(d.job); setPosition(d.position);
        if (isTerminal(d.job.status)) { clearInterval(timer.current!); timer.current = null; if (d.job.status === "done") onDone(id); }
      } catch {}
    }, 3000);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = await postJson("/api/agents/jobs", { type: "evaluate", ...(mode === "url" ? { url: url.trim() } : { jd: jd.trim() }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error ?? "Couldn't queue the evaluation."); return; }
      setJob(d.job); setPosition(null); onQueued?.(d.job.id); watch(d.job.id);
      setUrl(""); setJd("");
    } catch { setErr("Couldn't queue the evaluation."); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!job) return;
    await authed(`/api/agents/jobs/${job.id}`, { method: "DELETE" });
  }

  const running = job && !isTerminal(job.status);
  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card p-5 space-y-3">
        <h2 className="text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> Evaluate a job</h2>
        <p className="text-jh-mute text-sm max-w-2xl">Paste the posting URL or the job description itself. You get an A–G report with a 1–5 score against your CV. Under 4.0 means: don&apos;t spend your time on it.</p>
        {!hasCv && <p className="text-sm text-jh-red">Add your CV in <strong>Setup</strong> first — the Evaluator has nothing to compare against yet.</p>}
        <div role="tablist" className="inline-flex gap-1 rounded-pill bg-jh-mist p-1">
          {(["url", "text"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-pill text-sm font-display font-semibold ${mode === m ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute"}`}>{m === "url" ? "Posting URL" : "Paste description"}</button>
          ))}
        </div>
        {mode === "url"
          ? <input aria-label="Posting URL" className="field" type="url" placeholder="https://jobs.example.com/…" value={url} onChange={(e) => setUrl(e.target.value)} required />
          : <textarea aria-label="Job description" className="field text-sm min-h-[14rem]" placeholder="Paste the full job description…" value={jd} onChange={(e) => setJd(e.target.value)} required />}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={busy || !hasCv || !!running} className="btn-primary disabled:opacity-60">{busy ? "Queuing…" : "Evaluate"}</button>
          {!online && <span className="text-xs text-jh-mute">The agents are asleep right now — your job will wait in the queue and run when they wake up.</span>}
          {err && <p role="alert" className="text-sm text-jh-red">{err}</p>}
        </div>
      </form>

      {job && (
        <div className="card p-5 flex items-center gap-4 flex-wrap" role="status">
          <span className={`h-2.5 w-2.5 rounded-full ${running ? "bg-jh-red animate-pulse" : job.status === "done" ? "bg-rb-green-dark" : "bg-jh-mute"}`} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-jh-ink capitalize">{job.status}{job.status === "queued" && position != null ? ` · ${position === 0 ? "next up" : `${position} ahead of you`}` : ""}</p>
            <p className="text-sm text-jh-mute truncate">{job.error ?? job.progress ?? (job.status === "queued" ? "Waiting for the agents…" : "")}</p>
          </div>
          {running && <button type="button" onClick={cancel} className="btn-ghost text-xs text-jh-red"><XCircle className="h-4 w-4" /> Cancel</button>}
        </div>
      )}
    </div>
  );
}
