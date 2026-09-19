"use client";

import { useEffect, useRef, useState } from "react";
import { XCircle } from "lucide-react";
import { authed } from "@/components/admin/shared";
import { isTerminal, JOB_TYPE_LABELS } from "@/lib/careerops/keys";
import type { CareerOpsJob } from "@/lib/careerops/types";

// Polls one of the member's jobs every 3 s and shows queue position / progress / cancel.
export default function JobStatus({ jobId, onDone, onGone }: { jobId: string; onDone?: (job: CareerOpsJob) => void; onGone?: () => void }) {
  const [job, setJob] = useState<CareerOpsJob | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const d = await (await authed(`/api/agents/jobs/${jobId}`)).json();
        if (stop || !d.ok) return;
        setJob(d.job); setPosition(d.position);
        if (isTerminal(d.job.status)) { if (timer.current) clearInterval(timer.current); if (d.job.status === "done") onDone?.(d.job); else onGone?.(); }
      } catch {}
    };
    tick();
    timer.current = setInterval(tick, 3000);
    return () => { stop = true; if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (!job) return <p className="text-sm text-jh-mute animate-pulse">Queued…</p>;
  const running = !isTerminal(job.status);
  return (
    <div className="flex items-center gap-3 flex-wrap text-sm" role="status">
      <span className={`h-2.5 w-2.5 rounded-full ${running ? "bg-jh-red animate-pulse" : job.status === "done" ? "bg-rb-green-dark" : "bg-jh-mute"}`} />
      <span className="font-semibold text-jh-ink">{JOB_TYPE_LABELS[job.type]} · <span className="capitalize">{job.status}</span>{job.status === "queued" && position != null ? ` · ${position === 0 ? "next up" : `${position} ahead`}` : ""}</span>
      <span className="text-jh-mute truncate">{job.error ?? job.progress ?? ""}</span>
      {running && <button type="button" onClick={() => authed(`/api/agents/jobs/${job.id}`, { method: "DELETE" })} className="btn-ghost text-xs text-jh-red"><XCircle className="h-4 w-4" /> Cancel</button>}
    </div>
  );
}
