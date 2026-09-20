"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText, PenLine, Download, AlertTriangle, ScanSearch, Recycle, Hand, UserRound, MousePointerClick, ExternalLink } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { postJson } from "@/components/admin/shared";
import JobStatus from "@/components/agents/JobStatus";
import { paths } from "@/lib/firestore/db";
import { normalizeQuestion, questionId, standardId, standardLabel } from "@/lib/careerops/answers";
import type { CareerOpsNote } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";
import { CopyButton, NoteHistory, ReportPicker, downloadDoc, isHttp, splitLines, useNoteJob } from "../shared";
import { PortalAccountForm } from "@/components/agents/PortalAccount";
import { useLiveCollection } from "@/lib/firestore/db";
import type { VaultAccount } from "@/lib/careerops/vault";

interface Answer { question: string; answer: string; knockout?: string | null; maxChars?: number | null; from?: { source: "you" | "standard" | "profile" | "drafted"; company?: string | null; at?: number | null } | null; needsYou?: boolean; standardKey?: string | null; standardLabel?: string | null }
interface FormQuestion { label: string; type: string; required: boolean; options: string[]; maxLength: number | null }
interface FormData { url: string; finalUrl: string; atsHint: string | null; needsAccount: boolean; note: string; questions: FormQuestion[]; identity: { label: string; type: string }[]; files: { label: string; kind: "cv" | "cover" | "other"; required: boolean }[]; host?: string; signedIn?: { host: string; email: string; pages: { title: string; url: string; questions: number; filled: string[]; skipped: string[] }[]; stoppedAt: string } | null }

// Tailoring → apply: assemble the package for a posting, read the form off the apply page (or paste
// its questions), then answer every question — from your answer bank first, the model second, and
// you for the facts only you know. Reviewed and edited inline; edits are remembered for next time.
export default function Apply({ ctx }: ToolProps) {
  const [reportJobId, setReportJobId] = useState("");
  const [questions, setQuestions] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [pkgJob, setPkgJob] = useState<{ id: string; kind: "pdf" | "cover" } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<CareerOpsNote | null>(null);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [remembered, setRemembered] = useState<Record<number, boolean>>({});
  const job = useNoteJob(ctx.notes, "apply");
  const formJob = useNoteJob(ctx.notes, "apply_form");
  const fillJob = useNoteJob(ctx.notes, "apply_fill");
  const shown = job.note ?? open;
  const report = ctx.reports.find((r) => r.jobId === reportJobId);
  const docs = useMemo(() => ctx.docs.filter((d) => d.reportJobId === reportJobId), [ctx.docs, reportJobId]);
  const cv = docs.find((d) => d.kind === "cv"); const cover = docs.find((d) => d.kind === "cover");
  const answers = (Array.isArray(shown?.data?.answers) ? (shown!.data!.answers as Answer[]) : []);
  const latestForm = useMemo(() => formJob.note ?? ctx.notes.filter((n) => n.kind === "apply_form" && n.reportJobId === reportJobId).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null, [formJob.note, ctx.notes, reportJobId]);
  const form = latestForm?.data as FormData | undefined;
  const { data: vault } = useLiveCollection<VaultAccount>(ctx.uid, paths.careerOpsVault);
  const gateHost = form?.needsAccount ? (form.host ?? "") : "";
  const gateAccount = gateHost ? vault.find((v) => v.id === gateHost) ?? null : null;
  // "Fill it in the portal" needs a saved draft on the portal side, i.e. a candidate account in the vault.
  const fillHost = form?.host ?? (report?.url ? new URL(report.url).hostname.toLowerCase() : "");
  const fillAccount = fillHost ? vault.find((v) => v.id === fillHost) ?? null : null;
  const fillRunning = !!fillJob.jobId && !fillJob.note && !fillJob.failed;
  const fillResult = fillJob.note?.data as { possible: boolean; outcome?: string; finalUrl?: string; filled: string[]; skipped: string[]; atsHint?: string | null } | undefined;
  async function fillInPortal() {
    const list = answers.map((a, i) => ({ question: a.question, answer: (edits[i] ?? a.answer).trim() })).filter((a) => a.answer);
    await fillJob.run({ type: "apply_fill", reportJobId: shown?.reportJobId ?? reportJobId, answers: list, ...(applyUrl.trim() ? { applyUrl: applyUrl.trim() } : {}), ...(cv?.file ? { cvFile: cv.file } : {}) });
  }
  useEffect(() => { setEdits({}); setRemembered({}); }, [shown?.id]);
  // A freshly read form fills the questions box (only when it is empty, so a paste is never clobbered).
  useEffect(() => { if (formJob.note && form?.questions?.length && !questions.trim()) setQuestions(form.questions.map((q) => q.label).join("\n")); }, [formJob.note]); // eslint-disable-line react-hooks/exhaustive-deps
  const qs = splitLines(questions);
  const pkgRunning = pkgJob && !ctx.docs.some((d) => d.id === pkgJob.id);
  const formRunning = !!formJob.jobId && !formJob.note && !formJob.failed;

  async function queuePkg(kind: "pdf" | "cover") {
    setErr(null);
    try {
      const r = await postJson("/api/agents/jobs", { type: kind, reportJobId });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error ?? "Couldn't queue that."); return; }
      setPkgJob({ id: d.job.id, kind });
    } catch { setErr("Couldn't queue that."); }
  }
  async function readForm() { await formJob.run({ type: "apply_form", reportJobId, ...(applyUrl.trim() ? { applyUrl: applyUrl.trim() } : {}), ...(cv?.file ? { cvFile: cv.file } : {}) }); }
  async function draft(e: React.FormEvent) {
    e.preventDefault(); setOpen(null);
    await job.run({ type: "apply", reportJobId, questions: qs.slice(0, 25) });
  }
  // Remember what you actually said: on leaving an answer box whose text differs from the draft.
  async function remember(i: number, a: Answer) {
    const text = (edits[i] ?? a.answer).trim();
    if (!text || (text === a.answer && a.from && a.from.source !== "drafted")) return;
    const now = Date.now();
    const base = { question: a.question, key: normalizeQuestion(a.question), answer: text, company: shown?.company ?? report?.company ?? null, reportJobId: shown?.reportJobId ?? reportJobId ?? null, updatedAt: now };
    try {
      await setDoc(doc(paths.careerOpsAnswers(ctx.uid), await questionId(a.question)), { ...base, source: "you", standardKey: a.standardKey ?? null }, { merge: true });
      if (a.standardKey) await setDoc(doc(paths.careerOpsAnswers(ctx.uid), standardId(a.standardKey)), { ...base, question: standardLabel(a.standardKey), key: standardLabel(a.standardKey).toLowerCase(), source: "standard", standardKey: a.standardKey }, { merge: true });
      setRemembered((m) => ({ ...m, [i]: true }));
    } catch { setErr("Couldn't save that answer to your bank."); }
  }
  const fromLabel = (a: Answer) => a.from?.source === "you" ? `your answer${a.from.company ? ` to ${a.from.company}` : ""}${a.from.at ? `, ${new Date(a.from.at).toLocaleDateString()}` : ""}` : a.from?.source === "standard" ? `your standard answer${a.standardLabel ? ` (${a.standardLabel})` : ""}` : a.from?.source === "profile" ? "your profile" : null;

  return (
    <div className="space-y-5">
      <section className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><ClipboardList className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> 1 · The posting and the package</h3>
        <ReportPicker reports={ctx.reports} value={reportJobId} onChange={(id) => { setReportJobId(id); setPkgJob(null); setQuestions(""); setApplyUrl(""); formJob.reset(); }} />
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
        <h3 className="font-display font-bold text-jh-ink">2 · The form&apos;s questions</h3>
        <p className="text-xs text-jh-mute">Let the Pi read the application form for you — it opens the posting in its browser, follows the Apply link and lists every field (read-only, nothing is typed or clicked). Or paste the questions, one per line. Knock-out questions — years of experience, degree, work authorisation, salary — are flagged against your profile.</p>
        {report && (
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={readForm} disabled={formJob.busy || formRunning || !reportJobId || (!!applyUrl.trim() && !isHttp(applyUrl.trim())) || (!applyUrl.trim() && !report.url)} className="btn-secondary text-xs px-3 py-2 disabled:opacity-60"><ScanSearch className="h-4 w-4" /> {formJob.busy ? "Queuing…" : formRunning ? "Reading…" : "Read the form"}</button>
            <input aria-label="Application form URL" className="field text-sm font-mono flex-1 min-w-[16rem]" placeholder={report.url ? `apply URL if not ${report.url.replace(/^https?:\/\//, "").slice(0, 40)}…` : "paste the application form URL"} value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} />
            {formJob.err && <p role="alert" className="text-sm text-jh-red">{formJob.err}</p>}
          </div>
        )}
        {formJob.status}
        {form && (
          <div className="rounded-md bg-jh-mist p-3 text-xs text-jh-mute space-y-1">
            <p className="text-jh-ink font-semibold">Form read{form.atsHint ? ` · ${form.atsHint}` : ""} · {form.questions.length} question{form.questions.length === 1 ? "" : "s"}, {form.files.length} file slot{form.files.length === 1 ? "" : "s"}, {form.identity.length} identity field{form.identity.length === 1 ? "" : "s"} <a href={form.finalUrl} target="_blank" rel="noreferrer" className="underline font-normal">open</a></p>
            {form.needsAccount && <p className="text-jh-red flex items-start gap-1.5"><UserRound className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {form.note}</p>}
            {form.needsAccount && gateHost && (
              <div className="rounded-md border border-jh-line bg-white p-3 space-y-2">
                <p className="text-jh-ink font-semibold">{gateAccount ? `Your ${gateHost} account (${gateAccount.email}) is in the vault${gateAccount.status === "failed" ? ` — last sign-in failed: ${gateAccount.lastError}` : ""}. ${gateAccount.status === "failed" ? "Fix it below, then" : "Press"} "Read the form" again and the Pi signs in to read the whole wizard.` : `Save your ${gateHost} account and the Pi signs in as you to read the whole form. No account yet? Create one on the portal first — generate a password for it below.`}</p>
                <PortalAccountForm uid={ctx.uid} host={gateHost} company={report?.company ?? null} publicKey={ctx.status?.vaultPublicKey ?? null} existing={gateAccount} />
              </div>
            )}
            {form.signedIn && <p>Signed in as {form.signedIn.email} · read {form.signedIn.pages.length} page{form.signedIn.pages.length === 1 ? "" : "s"}: {form.signedIn.pages.map((p) => p.title || "page").join(" → ")}{form.signedIn.pages.some((p) => p.skipped.length) ? ` · could not fill: ${form.signedIn.pages.flatMap((p) => p.skipped).join(", ")}` : ""}</p>}
            {!form.needsAccount && form.note && <p>{form.note}</p>}
            {form.files.length > 0 && <p>Files: {form.files.map((f) => `${f.label}${f.kind === "cv" && cv ? " → your tailored CV" : f.kind === "cover" && cover ? " → your cover letter" : ""}`).join(" · ")}</p>}
            {form.questions.length > 0 && qs.length === 0 && <button type="button" onClick={() => setQuestions(form.questions.map((q) => q.label).join("\n"))} className="btn-ghost text-xs">Fill the questions in</button>}
          </div>
        )}
        <textarea aria-label="Form questions" className="field text-sm min-h-[9rem]" value={questions} onChange={(e) => setQuestions(e.target.value)} placeholder={"Why do you want to work at Xero?\nDescribe a time you influenced without authority.\nAre you legally entitled to work in New Zealand?\nWhat are your salary expectations?"} maxLength={12000} />
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={job.busy || !reportJobId || qs.length === 0 || (!!job.jobId && !job.note && !job.failed)} className="btn-primary disabled:opacity-60">{job.busy ? "Queuing…" : `Answer ${qs.length || ""} question${qs.length === 1 ? "" : "s"}`}</button>
          <span className="text-xs text-jh-mute">{qs.length > 25 ? "Max 25 per run." : "Answers you already gave are reused; the rest are drafted; facts only you know are asked. You review, paste and submit."}</span>
          {job.err && <p role="alert" className="text-sm text-jh-red">{job.err}</p>}
        </div>
        {job.status}
      </form>

      {shown && (
        <section className="card p-5 space-y-4">
          <header className="flex items-start justify-between gap-3 flex-wrap"><div><h3 className="font-display font-bold text-jh-ink">{shown.title}</h3><p className="text-xs text-jh-mute">{shown.model} · {new Date(shown.createdAt).toLocaleString()}{typeof shown.data?.reused === "number" ? ` · ${shown.data.reused as number} reused from your bank` : ""} · edit inline — edits are remembered for the next form</p></div><CopyButton text={answers.map((a, i) => `${a.question}\n${edits[i] ?? a.answer}`).join("\n\n")} label="Copy all" /></header>
          {answers.length === 0 && <div className="prose prose-sm max-w-none"><pre className="whitespace-pre-wrap">{shown.markdown}</pre></div>}
          {answers.length > 0 && (
            <div className="rounded-md bg-jh-mist p-3 space-y-2 text-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={fillInPortal} disabled={fillJob.busy || fillRunning || !fillAccount} className="btn-primary text-xs px-3 py-2 disabled:opacity-60"><MousePointerClick className="h-4 w-4" /> {fillJob.busy ? "Queuing…" : fillRunning ? "Filling…" : "Fill it in the portal"}</button>
                <span className="text-xs text-jh-mute">{fillAccount ? `The Pi signs in to ${fillHost} as ${fillAccount.email}, types these answers and your details into the form, attaches the tailored CV, and stops at Review — you press Submit.` : fillHost ? `Save your ${fillHost} account under Portal accounts (or at the gate above) and the Pi can type these into the portal for you.` : "Read the form first so Compass knows which portal to fill."}</span>
                {fillJob.err && <p role="alert" className="text-xs text-jh-red">{fillJob.err}</p>}
              </div>
              {fillJob.status}
              {fillResult && (
                <div className="text-xs space-y-1">
                  <p className={fillResult.possible ? "text-jh-ink" : "text-jh-red"}>{fillResult.possible ? fillResult.outcome : `${fillResult.atsHint ?? "This"} form keeps no draft without an account — copy the answers in.`}{fillResult.possible && fillResult.finalUrl && <> <a href={fillResult.finalUrl} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">open the portal <ExternalLink className="h-3 w-3" /></a></>}</p>
                  {fillResult.filled?.length > 0 && <p className="text-jh-mute">Filled: {fillResult.filled.join(" · ")}</p>}
                  {fillResult.skipped?.length > 0 && <p className="text-jh-red">Left for you: {fillResult.skipped.join(" · ")}</p>}
                </div>
              )}
            </div>
          )}
          <ol className="space-y-4">
            {answers.map((a, i) => {
              const val = edits[i] ?? a.answer;
              const from = fromLabel(a);
              return (
                <li key={i} className={`space-y-1.5 ${a.needsYou ? "rounded-md border border-jh-red/40 p-3" : ""}`}>
                  <p className="text-sm font-semibold text-jh-ink">{i + 1}. {a.question}</p>
                  {a.knockout && <p className="text-xs text-jh-red flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span><strong>Knock-out check:</strong> {a.knockout}</span></p>}
                  {a.needsYou && <p className="text-xs text-jh-red flex items-start gap-1.5"><Hand className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span><strong>Needs you.</strong> Only you know this — type it once and it becomes your standard answer for <em>{a.standardLabel}</em>, reused on every form.</span></p>}
                  {from && <p className="text-xs text-rb-green-dark flex items-center gap-1.5"><Recycle className="h-3.5 w-3.5 shrink-0" /> Reused from {from}</p>}
                  <textarea aria-label={`Answer ${i + 1}`} className="field text-sm min-h-[5.5rem]" value={val} onChange={(e) => setEdits((m) => ({ ...m, [i]: e.target.value }))} onBlur={() => remember(i, a)} placeholder={a.needsYou ? "Your answer — saved to your standard answers when you leave this box" : undefined} />
                  <div className="flex items-center gap-3 text-xs text-jh-mute"><span>{val.length} chars{a.maxChars ? ` / ${a.maxChars}` : ""}</span><CopyButton text={val} />{remembered[i] && <span className="text-rb-green-dark">remembered</span>}</div>
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
