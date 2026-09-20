"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { CareerOpsNote } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";
import { NoteHistory, NoteView, ReportPicker, useNoteJob } from "../shared";

// Sourcing → deep: company intelligence. With an Anthropic key on the Pi the
// Researcher searches the web; without one it works from the JD + what you paste.
export default function Deep({ ctx }: ToolProps) {
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [reportJobId, setReportJobId] = useState("");
  const [open, setOpen] = useState<CareerOpsNote | null>(null);
  const job = useNoteJob(ctx.notes, "deep");
  const shown = job.note ?? open;

  function pickReport(id: string) {
    setReportJobId(id);
    const r = ctx.reports.find((x) => x.jobId === id);
    if (r) setCompany(r.company);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setOpen(null);
    await job.run({ type: "deep", company: company.trim(), ...(website.trim() ? { website: website.trim() } : {}), ...(reportJobId ? { reportJobId } : {}) });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><Search className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> Which company?</h3>
        {ctx.reports.length > 0 && <ReportPicker reports={ctx.reports} value={reportJobId} onChange={pickReport} label="From a scored posting (optional — adds the role context)" />}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><span className="label">Company</span><input className="field" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Xero" required maxLength={120} /></label>
          <label className="block"><span className="label">Website <span className="font-normal text-jh-mute">(optional)</span></span><input className="field" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.xero.com" /></label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={job.busy || !company.trim() || (!!job.jobId && !job.note && !job.failed)} className="btn-primary disabled:opacity-60">{job.busy ? "Queuing…" : "Research it"}</button>
          <span className="text-xs text-jh-mute">Six axes: AI strategy · recent moves · engineering culture · likely challenges · competitors · your angle.</span>
          {job.err && <p role="alert" className="text-sm text-jh-red">{job.err}</p>}
        </div>
        {job.status}
      </form>
      {shown && <NoteView note={shown} />}
      <NoteHistory notes={ctx.notes} kind="deep" onOpen={(n) => { job.reset(); setOpen(n); }} current={shown?.id} />
    </div>
  );
}
