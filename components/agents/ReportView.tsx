"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, Columns3, Check, FileText, PenLine, Download, Copy } from "lucide-react";
import { updateDoc, doc } from "firebase/firestore";
import { createDoc, paths, useLiveCollection } from "@/lib/firestore/db";
import { authed, postJson } from "@/components/admin/shared";
import JobStatus from "./JobStatus";
import { useContent } from "@/lib/firestore/content";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";
import { scoreTone, scoreVerdict, type CareerOpsDoc, type CareerOpsReport } from "@/lib/careerops/types";

const TONE: Record<ReturnType<typeof scoreTone>, string> = {
  strong: "bg-rb-green-light/30 text-rb-green-dark", good: "bg-rb-green-light/30 text-rb-green-dark",
  maybe: "bg-rb-yellow/30 text-jh-ink", skip: "bg-jh-red-soft text-jh-red", unknown: "bg-jh-mist text-jh-mute",
};

export function ScoreBadge({ score, big = false }: { score: number | null; big?: boolean }) {
  return <span className={`pill tabular-nums ${TONE[scoreTone(score)]} ${big ? "text-base px-3 py-1" : ""}`}>{score == null ? "?/5" : `${score.toFixed(1)}/5`}</span>;
}

// One A–G report, rendered from the worker's markdown, with the actions that
// connect it to the rest of Compass.
export default function ReportView({ uid, report, onClose }: { uid: string; report: CareerOpsReport; onClose?: () => void }) {
  const { stages } = useContent();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string | null>(report.addedOpportunityId ?? null);
  const { data: allDocs } = useLiveCollection<CareerOpsDoc>(uid, paths.careerOpsDocs);
  const docs = useMemo(() => allDocs.filter((d) => d.reportJobId === report.jobId), [allDocs, report.jobId]);
  const [docJob, setDocJob] = useState<{ id: string; kind: "pdf" | "cover" } | null>(null);
  const [angle, setAngle] = useState("");
  const [askAngle, setAskAngle] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function queueDoc(kind: "pdf" | "cover") {
    setErr(null);
    try {
      const r = await postJson("/api/agents/jobs", { type: kind, reportJobId: report.jobId, ...(kind === "cover" && angle.trim() ? { angle: angle.trim() } : {}) });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error ?? "Couldn't queue that."); return; }
      setDocJob({ id: d.job.id, kind }); setAskAngle(false);
    } catch { setErr("Couldn't queue that."); }
  }
  async function download(d: CareerOpsDoc) {
    const r = await authed(`/api/agents/docs/${d.id}/download`);
    if (!r.ok) { setErr("Couldn't download the file."); return; }
    const blob = await r.blob();
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: d.file });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function copyText(d: CareerOpsDoc) { if (d.text) { await navigator.clipboard.writeText(d.text); setCopied(d.id); setTimeout(() => setCopied(null), 1500); } }

  async function addToTracker() {
    if (added) return;
    setBusy(true);
    try {
      const ref = await createDoc(paths.opportunities(uid), {
        company: report.company, role: report.role, market: "visible", stage: stages[0].id, contactIds: [], log: [],
        source: "Agents · Evaluator", url: report.url ?? "",
        notes: `Evaluator score ${report.score ?? "?"}/5 · ${report.archetype} · ${report.legitimacy}`,
      });
      await updateDoc(doc(paths.careerOpsReports(uid), report.id), { addedOpportunityId: ref.id });
      setAdded(ref.id);
      track(TAGS.ADD_OPPORTUNITY, { source: "agents", props: { from: "evaluator", score: report.score } });
    } finally { setBusy(false); }
  }

  return (
    <article className="card p-5 space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="eyebrow">{report.archetype} · {report.legitimacy}</p>
          <h2 className="text-xl">{report.company} — {report.role}</h2>
          <p className="text-sm text-jh-mute mt-1">{scoreVerdict(report.score)} · {report.model} · {new Date(report.createdAt).toLocaleString()}</p>
        </div>
        <ScoreBadge score={report.score} big />
      </header>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={addToTracker} disabled={busy || !!added} className="btn-primary text-sm disabled:opacity-60">
          {added ? <><Check className="h-4 w-4" /> On your Progress board</> : <><Columns3 className="h-4 w-4" /> {busy ? "Adding…" : "Add to Progress board"}</>}
        </button>
        <button type="button" onClick={() => queueDoc("pdf")} disabled={!!docJob} className="btn-secondary text-sm disabled:opacity-60"><FileText className="h-4 w-4" /> Tailor CV → PDF</button>
        <button type="button" onClick={() => setAskAngle((v) => !v)} disabled={!!docJob} className="btn-secondary text-sm disabled:opacity-60"><PenLine className="h-4 w-4" /> Draft cover letter</button>
        {report.url && <a href={report.url} target="_blank" rel="noreferrer" className="btn-secondary text-sm"><ExternalLink className="h-4 w-4" /> Open posting</a>}
        {onClose && <button type="button" onClick={onClose} className="btn-ghost text-sm">Back</button>}
      </div>
      {askAngle && (
        <div className="rounded-md border border-jh-line p-4 space-y-2">
          <label className="block"><span className="label">Why this role, in your own words <span className="font-normal text-jh-mute">(optional — the Writer uses it for the opening)</span></span>
            <textarea className="field text-sm min-h-[4.5rem]" value={angle} onChange={(e) => setAngle(e.target.value)} maxLength={1500} placeholder="e.g. I want to move into payments because merchants feel every hour of downtime…" /></label>
          <div className="flex gap-2"><button type="button" onClick={() => queueDoc("cover")} className="btn-primary text-sm">Draft it</button><button type="button" onClick={() => setAskAngle(false)} className="btn-ghost text-sm">Cancel</button></div>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-jh-red">{err}</p>}
      {docJob && <div className="rounded-md bg-jh-mist p-3"><JobStatus jobId={docJob.id} onDone={() => setDocJob(null)} onGone={() => setDocJob(null)} /></div>}
      {docs.length > 0 && (
        <ul className="divide-y divide-jh-line rounded-md border border-jh-line">
          {docs.map((d) => (
            <li key={d.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                {d.kind === "cv" ? <FileText className="h-4 w-4 text-jh-red" /> : <PenLine className="h-4 w-4 text-jh-red" />}
                <span className="font-semibold text-jh-ink">{d.kind === "cv" ? "Tailored CV" : "Cover letter"}</span>
                <span className="text-xs text-jh-mute">{d.pageCount} page{d.pageCount === 1 ? "" : "s"}{d.words ? ` · ${d.words} words` : ""} · {d.model} · {new Date(d.createdAt).toLocaleString()}</span>
                <span className="flex-1" />
                <button type="button" onClick={() => download(d)} className="btn-secondary text-xs px-3 py-1.5"><Download className="h-3.5 w-3.5" /> PDF</button>
                {d.text && <button type="button" onClick={() => copyText(d)} className="btn-ghost text-xs">{copied === d.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy text</button>}
              </div>
              {d.kind === "cv" && (d.keywordsMissing?.length ?? 0) > 0 && <p className="text-xs text-jh-mute">Not claimed (you don&apos;t have it in your CV): {d.keywordsMissing!.join(", ")}</p>}
              {d.kind === "cover" && d.text && <details><summary className="text-xs cursor-pointer text-jh-mute">Read the letter</summary><pre className="mt-2 text-sm whitespace-pre-wrap font-sans text-jh-ink">{d.text}</pre></details>}
            </li>
          ))}
        </ul>
      )}
      {!report.summaryFound && <p className="text-xs text-jh-red">The model didn&apos;t produce a clean score block for this one — read the verdict below and treat the score as unknown.</p>}
      <div className="prose prose-sm max-w-none prose-table:text-xs prose-headings:font-display">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.markdown}</ReactMarkdown>
      </div>
    </article>
  );
}
