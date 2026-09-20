"use client";

import { useState } from "react";
import { MessageSquare, ExternalLink } from "lucide-react";
import { CONTACT_TARGETS, type CareerOpsNote, type ContactTarget } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";
import { CopyButton, NoteHistory, NoteView, ReportPicker, useNoteJob } from "../shared";

// Tailoring → contacto: the one person to contact + a DM under 300 characters.
export default function Contacto({ ctx }: ToolProps) {
  const [reportJobId, setReportJobId] = useState("");
  const [target, setTarget] = useState<ContactTarget>("hiring_manager");
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [open, setOpen] = useState<CareerOpsNote | null>(null);
  const job = useNoteJob(ctx.notes, "contacto");
  const shown = job.note ?? open;
  const report = ctx.reports.find((r) => r.jobId === reportJobId);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setOpen(null);
    await job.run({ type: "contacto", reportJobId, target, personName: personName.trim(), personRole: personRole.trim() });
  }
  const dm = typeof shown?.data?.dm === "string" ? (shown.data.dm as string) : null;
  const liSearch = report ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${report.company} ${target === "recruiter" ? "recruiter talent" : target === "peer" ? report.role : "head lead manager " + report.role}`)}` : null;

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><MessageSquare className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> Who, for which role?</h3>
        <ReportPicker reports={ctx.reports} value={reportJobId} onChange={setReportJobId} />
        <div role="radiogroup" aria-label="Contact type" className="inline-flex flex-wrap gap-1 rounded-pill bg-jh-mist p-1">
          {CONTACT_TARGETS.map((t) => <button key={t.key} type="button" role="radio" aria-checked={target === t.key} onClick={() => setTarget(t.key)} className={`px-4 py-1.5 rounded-pill text-sm font-display font-semibold ${target === t.key ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute"}`}>{t.label}</button>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><span className="label">Already know who? Name <span className="font-normal text-jh-mute">(optional)</span></span><input className="field" value={personName} onChange={(e) => setPersonName(e.target.value)} maxLength={120} /></label>
          <label className="block"><span className="label">Their title <span className="font-normal text-jh-mute">(optional)</span></span><input className="field" value={personRole} onChange={(e) => setPersonRole(e.target.value)} maxLength={120} placeholder="Head of Product, Payments" /></label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={job.busy || !reportJobId || (!!job.jobId && !job.note && !job.failed)} className="btn-primary disabled:opacity-60">{job.busy ? "Queuing…" : "Find them & draft the DM"}</button>
          {liSearch && <a href={liSearch} target="_blank" rel="noreferrer" className="btn-ghost text-xs"><ExternalLink className="h-3.5 w-3.5" /> Search LinkedIn yourself</a>}
          {job.err && <p role="alert" className="text-sm text-jh-red">{job.err}</p>}
        </div>
        <p className="text-xs text-jh-mute">Never guesses a name. With web search on the Pi it names a confirmed person; without, it tells you the exact title to look for and drafts the message for that persona. You send it.</p>
        {job.status}
      </form>
      {shown && (
        <NoteView note={shown} extra={dm ? (
          <div className="rounded-md border border-jh-line p-4 space-y-2">
            <div className="flex items-center justify-between gap-3"><span className="label mb-0">The DM ({dm.length}/300 characters)</span><CopyButton text={dm} label="Copy DM" /></div>
            <p className="text-sm text-jh-ink whitespace-pre-wrap">{dm}</p>
          </div>
        ) : undefined} />
      )}
      <NoteHistory notes={ctx.notes} kind="contacto" onOpen={(n) => { job.reset(); setOpen(n); }} current={shown?.id} />
    </div>
  );
}
