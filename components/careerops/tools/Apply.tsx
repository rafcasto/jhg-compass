"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText, PenLine, Download, AlertTriangle } from "lucide-react";
import { postJson } from "@/components/admin/shared";
import JobStatus from "@/components/agents/JobStatus";
import type { CareerOpsNote } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";
import { CopyButton, NoteHistory, ReportPicker, downloadDoc, splitLines, useNoteJob } from "../shared";

interface Answer { question: string; answer: string; knockout?: string | null; maxChars?: number | null }

// Tailoring → apply: assemble the package for a posting, then draft every form
// question from the CV — reviewed and edited inline before it's pasted back.
export default function Apply({ ctx }: ToolProps) {
  const [reportJobId, setReportJobId] = useState("");
  const [questions, setQuestions] = useState("");
  const [pkgJob, setPkgJob] = useState<{ id: string; kind: "pdf" | "cover" } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<CareerOpsNote | null>(null);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const job = useNoteJob(ctx.notes, "apply");
  const shown = job.note ?? open;
  const report = ctx.reports.find((r) => r.jobId === reportJobId);
  const docs = useMemo(() => ctx.docs.filter((d) => d.reportJobId === reportJobId), [ctx.docs, reportJobId]);
  const cv = docs.find((d) => d.kind === "cv"); const cover = docs.find((d) => d.kind === "cover");
  const answers = (Array.isArray(shown?.data?.answers) ? (shown!.data!.answers as Answer[]) : []);
  useEffect(() => setEdits({}), [shown?.id]);
  const qs = splitLines(questions);
  const pkgRunning = pkgJob && !ctx.docs.some((d) => d.id === pkgJob.id);

  async function queuePkg(kind: "pdf" | "cover") {
    setErr(null);
    try {
      const r = await postJson("/api/agents/jobs", { type: kind, reportJobId });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error ?? "Couldn't queue that."); return; }
      setPkgJob({ id: d.job.id, kind });
    } catch { setErr("Couldn't queue that."); }
  }
  async function draft(e: React.FormEvent) {
    e.preventDefault(); setOpen(null);
    await job.run({ type: "apply", reportJobId, questions: qs.slice(0, 25) });
  }

  return (
    <div className="space-y-5">
      <section className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><ClipboardList className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> 1 · The posting and the package</h3>
        <ReportPicker reports={ctx.reports} value={reportJobId} onChange={(id) => { setReportJobId(id); setPkgJob(null); }} />
        {report && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-md border border-jh-line p-3 flex items-center gap-3">
              <FileText className="h-5 w-5 text-jh-red" />
              <span className="flex-1 min-w-0 text-sm"><span className="block font-semibold text-jh-ink">Tailored CV</span><span className="block text-xs text-jh-mute">{cv ? `${cv.pageCount} pages · ${new Date(cv.createdAt).toLocaleDateString()}` : "not generated yet"}</span></span>
              {cv ? <button type="button" onClick={async () => { const e = await downloadDoc(cv); if (e) setErr(e); }} className="btn-secondary text-xs px-3 py-1.5"><Download className="h-3.5 w-3.5" /> PDF</button>
                : <button type="button" onClick={() => queuePkg("pdf")} disabled={!!pkgRunning} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-60">Generate</button>}
            </div>
            <div className="rounded-md border border-jh-line p-3 flex items-center gap-3">
              <PenLine className="h-5 w-5 text-jh-red" />
              <span className="flex-1 min-w-0 text-sm"><span className="block font-semibold text-jh-ink">Cover letter</span><span className="block text-xs text-jh-mute">{cover ? `${cover.words ?? "?"} words · ${new Date(cover.createdAt).toLocaleDateString()}` : "not drafted yet"}</span></span>
              {cover ? <div className="flex gap-1">{cover.text && <CopyButton text={cover.text} label="Copy" />}<button type="button" onClick={async () => { const e = await downloadDoc(cover); if (e) setErr(e); }} className="btn-secondary text-xs px-3 py-1.5"><Download className="h-3.5 w-3.5" /> PDF</button></div>
                : <button type="button" onClick={() => queuePkg("cover")} disabled={!!pkgRunning} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-60">Draft</button>}
            </div>
          </div>
        )}
        {pkgRunning && <div className="rounded-md bg-jh-mist p-3"><JobStatus jobId={pkgJob!.id} onGone={() => setPkgJob(null)} /></div>}
        {err && <p role="alert" className="text-sm text-jh-red">{err}</p>}
      </section>

      <form onSubmit={draft} className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink">2 · The form&apos;s questions, one per line</h3>
        <p className="text-xs text-jh-mute">Copy the text-field questions from the application form (Workday, Greenhouse, Lever, the company&apos;s own…). Yes/no knock-out questions — years of experience, degree, work authorisation, salary — are flagged against your profile before you answer them.</p>
        <textarea aria-label="Form questions" className="field text-sm min-h-[9rem]" value={questions} onChange={(e) => setQuestions(e.target.value)} placeholder={"Why do you want to work at Xero?\nDescribe a time you influenced without authority.\nAre you legally entitled to work in New Zealand?\nWhat are your salary expectations?"} maxLength={12000} />
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={job.busy || !reportJobId || qs.length === 0 || (!!job.jobId && !job.note && !job.failed)} className="btn-primary disabled:opacity-60">{job.busy ? "Queuing…" : `Draft ${qs.length || ""} answer${qs.length === 1 ? "" : "s"}`}</button>
          <span className="text-xs text-jh-mute">{qs.length > 25 ? "Max 25 per run." : "You review, edit, paste and press submit. The agent never submits."}</span>
          {job.err && <p role="alert" className="text-sm text-jh-red">{job.err}</p>}
        </div>
        {job.status}
      </form>

      {shown && (
        <section className="card p-5 space-y-4">
          <header className="flex items-start justify-between gap-3 flex-wrap"><div><h3 className="font-display font-bold text-jh-ink">{shown.title}</h3><p className="text-xs text-jh-mute">{shown.model} · {new Date(shown.createdAt).toLocaleString()} · edit inline, then copy each one</p></div><CopyButton text={answers.map((a, i) => `${a.question}\n${edits[i] ?? a.answer}`).join("\n\n")} label="Copy all" /></header>
          {answers.length === 0 && <div className="prose prose-sm max-w-none"><pre className="whitespace-pre-wrap">{shown.markdown}</pre></div>}
          <ol className="space-y-4">
            {answers.map((a, i) => {
              const val = edits[i] ?? a.answer;
              return (
                <li key={i} className="space-y-1.5">
                  <p className="text-sm font-semibold text-jh-ink">{i + 1}. {a.question}</p>
                  {a.knockout && <p className="text-xs text-jh-red flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span><strong>Knock-out check:</strong> {a.knockout}</span></p>}
                  <textarea aria-label={`Answer ${i + 1}`} className="field text-sm min-h-[5.5rem]" value={val} onChange={(e) => setEdits((m) => ({ ...m, [i]: e.target.value }))} />
                  <div className="flex items-center gap-3 text-xs text-jh-mute"><span>{val.length} chars{a.maxChars ? ` / ${a.maxChars}` : ""}</span><CopyButton text={val} /></div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <NoteHistory notes={ctx.notes} kind="apply" onOpen={(n) => { job.reset(); setOpen(n); }} current={shown?.id} />
    </div>
  );
}
