"use client";

import { useState } from "react";
import { GraduationCap, Hammer } from "lucide-react";
import type { CareerOpsNote } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";
import { NoteHistory, NoteView, useNoteJob } from "../shared";

// Scoring → training / project: "will this move me?" verdicts against the North Star.
export default function Advise({ ctx, tool }: ToolProps) {
  const kind = tool === "project" ? "project" : "training";
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [url, setUrl] = useState("");
  const [cost, setCost] = useState("");
  const [effort, setEffort] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState<CareerOpsNote | null>(null);
  const job = useNoteJob(ctx.notes, kind);
  const shown = job.note ?? open;
  const Icon = kind === "project" ? Hammer : GraduationCap;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setOpen(null);
    await job.run({ type: "advise", kind, title: title.trim(), provider: provider.trim(), url: url.trim(), cost: cost.trim(), effort: effort.trim(), description: description.trim() });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><Icon className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> {kind === "project" ? "The project idea" : "The course or certification"}</h3>
        {!ctx.hasCv && <p className="text-sm text-jh-red">Add your CV in Setup first — the verdict is relative to where you are now.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><span className="label">{kind === "project" ? "Project name" : "Course / cert name"}</span><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder={kind === "project" ? "LLM eval harness for support tickets" : "AWS Solutions Architect Associate"} /></label>
          <label className="block"><span className="label">{kind === "project" ? "Stack / tools" : "Provider"} <span className="font-normal text-jh-mute">(optional)</span></span><input className="field" value={provider} onChange={(e) => setProvider(e.target.value)} maxLength={160} /></label>
          <label className="block"><span className="label">Link <span className="font-normal text-jh-mute">(optional)</span></span><input className="field" type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Cost</span><input className="field" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={kind === "project" ? "free" : "NZ$ 450"} maxLength={40} /></label>
            <label className="block"><span className="label">Time</span><input className="field" value={effort} onChange={(e) => setEffort(e.target.value)} placeholder="6 weeks × 5 h" maxLength={60} /></label>
          </div>
        </div>
        <label className="block"><span className="label">What it is, in your words</span><textarea className="field text-sm min-h-[6rem]" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={4000} placeholder={kind === "project" ? "What you'd build, for whom, what it would demonstrate, what metric it could show…" : "Syllabus highlights, why you're considering it, what you hope it signals…"} /></label>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={job.busy || !ctx.hasCv || !title.trim() || !description.trim() || (!!job.jobId && !job.note && !job.failed)} className="btn-primary disabled:opacity-60">{job.busy ? "Queuing…" : "Judge it"}</button>
          <span className="text-xs text-jh-mute">{kind === "project" ? "Verdict: BUILD · SKIP · PIVOT, with a 2-week 80/20 plan when it's a build." : "Verdict: DO · DON'T · DO WITH TIMEBOX, with a plan when it's a do."}</span>
          {job.err && <p role="alert" className="text-sm text-jh-red">{job.err}</p>}
        </div>
        {job.status}
      </form>
      {shown && <NoteView note={shown} />}
      <NoteHistory notes={ctx.notes} kind={kind} onOpen={(n) => { job.reset(); setOpen(n); }} current={shown?.id} />
    </div>
  );
}
