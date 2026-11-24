"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import type { EngineJob } from "@/lib/engine/jobs";
import type { JobNote } from "@/lib/engine/coach/transcript";

// A research job in progress (docs/UX_COACH_AGENTIC.md §2): one status line in the write line's
// grammar — a 6 px pulsing dot (the one moving pixel), the verb phrase from the job's `progress`,
// a mono count when the phrase carries one, a tertiary Stop. Not a card, not a spinner block;
// the result's weight goes to the page. The live source is users/{uid}/engineJobs/{id} — the
// same document the admin tab reads. Reused later by the Target companies page when a scan runs.
export default function JobStatus({ uid, job, href, aside }: {
  uid: string; job: JobNote; href?: string;
  /** One mute sentence under the line while the job runs — the transcript's "saved as it lands" on a conversation's first job; the page passes none. */
  aside?: string;
}) {
  const { data } = useLiveDoc<EngineJob>(paths.engineJob(uid, job.id));
  const status = data?.status ?? "queued";
  const stop = async () => {
    try { const token = await auth.currentUser!.getIdToken(); await fetch(`/api/engine/jobs/${job.id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } }); } catch { /* the line stays; the member can try again */ }
  };
  if (status === "done") {
    const count = (data?.result as { count?: number } | null)?.count;
    return (
      <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-jh-ink">
        <Check className="h-4 w-4 shrink-0 text-rb-green-dark" aria-hidden /> {typeof count === "number" ? `${job.label} · ${count} found` : job.label}
        {href && <Link href={href} className="link text-sm">View ›</Link>}
      </p>
    );
  }
  if (status === "failed") return <p role="status" className="text-sm text-jh-red">Couldn&apos;t finish {job.label.toLowerCase()}{data?.error ? ` — ${data.error}` : ""}. Try again in a few minutes.</p>;
  if (status === "cancelled") return <p role="status" className="text-sm text-jh-mute">{job.label} · stopped</p>;
  const { phrase, count } = splitCount(data?.progress || (status === "queued" ? "Starting" : job.label));
  return (
    <div className="space-y-1">
      <p role="status" className="flex items-center gap-2 text-sm text-jh-ink">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-jh-mute animate-pulse" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{phrase}</span>
        {count && <span className="font-mono text-xs text-jh-mute">{count}</span>}
        {!data?.cancel && <button type="button" onClick={() => void stop()} className="link text-sm">Stop</button>}
      </p>
      {aside && <p className="text-xs text-jh-mute">{aside}</p>}
    </div>
  );
}

/** "Opening links · 7 of 20" → the phrase and the mono count; a phrase without one stays whole. */
export function splitCount(progress: string): { phrase: string; count: string | null } {
  const m = progress.match(/^(.*?)\s*·\s*(\d+ of \d+)$/);
  return m ? { phrase: m[1], count: m[2] } : { phrase: progress, count: null };
}
