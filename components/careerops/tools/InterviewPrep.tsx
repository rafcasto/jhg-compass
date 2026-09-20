"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { PREP_AUDIENCES, type CareerOpsNote, type PrepAudience } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";
import { NoteHistory, NoteView, ReportPicker, useNoteJob } from "../shared";

// Tracking → interview-prep: who's in the room decides the document.
export default function InterviewPrep({ ctx }: ToolProps) {
  const [reportJobId, setReportJobId] = useState("");
  const [audience, setAudience] = useState<PrepAudience>("recruiter");
  const [extra, setExtra] = useState("");
  const [open, setOpen] = useState<CareerOpsNote | null>(null);
  const job = useNoteJob(ctx.notes, "interview_prep");
  const shown = job.note ?? open;
  const deep = ctx.notes.find((n) => n.kind === "deep" && n.reportJobId === reportJobId);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setOpen(null);
    await job.run({ type: "interview_prep", reportJobId, audience, extra: extra.trim() });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><Mic className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> Which role, who&apos;s in the room?</h3>
        <ReportPicker reports={ctx.reports} value={reportJobId} onChange={setReportJobId} />
        <div role="radiogroup" aria-label="Audience" className="inline-flex flex-wrap gap-1 rounded-pill bg-jh-mist p-1">
          {PREP_AUDIENCES.map((a) => <button key={a.key} type="button" role="radio" aria-checked={audience === a.key} onClick={() => setAudience(a.key)} className={`px-4 py-1.5 rounded-pill text-sm font-display font-semibold ${audience === a.key ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute"}`}>{a.label}</button>)}
        </div>
        <label className="block"><span className="label">Anything you know about the interview <span className="font-normal text-jh-mute">(optional — names, format, what the recruiter said)</span></span><textarea className="field text-sm min-h-[4.5rem]" value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={2000} /></label>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={job.busy || !reportJobId || (!!job.jobId && !job.note && !job.failed)} className="btn-primary disabled:opacity-60">{job.busy ? "Queuing…" : "Build the prep doc"}</button>
          <span className="text-xs text-jh-mute">{deep ? "Uses your company deep-dive too." : "Tip: run a deep-dive on the company first (Sourcing → deep) — it feeds this."} Likely questions · talking points · STAR+R stories from your CV.</span>
          {job.err && <p role="alert" className="text-sm text-jh-red">{job.err}</p>}
        </div>
        {job.status}
      </form>
      {shown && <NoteView note={shown} />}
      <NoteHistory notes={ctx.notes} kind="interview_prep" onOpen={(n) => { job.reset(); setOpen(n); }} current={shown?.id} />
    </div>
  );
}
