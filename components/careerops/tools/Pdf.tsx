"use client";

import { useMemo, useState } from "react";
import { FileText, Download } from "lucide-react";
import { postJson } from "@/components/admin/shared";
import JobStatus from "@/components/agents/JobStatus";
import type { ToolProps } from "../SectionScreen";
import { ReportPicker, downloadDoc } from "../shared";

const TEMPLATES = [
  { key: "cv-template.html", label: "Classic" }, { key: "cv-template.modern.html", label: "Modern" }, { key: "cv-template.compact.html", label: "Compact" },
  { key: "cv-template.executive.html", label: "Executive" }, { key: "cv-template.leadership.html", label: "Leadership" }, { key: "cv-template.jake.html", label: "Jake (single column)" },
];

// Tailoring → pdf: JD-tailored, ATS-safe CV for a scored posting.
export default function Pdf({ ctx }: ToolProps) {
  const [reportJobId, setReportJobId] = useState("");
  const [template, setTemplate] = useState(TEMPLATES[0].key);
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cvDocs = useMemo(() => ctx.docs.filter((d) => d.kind === "cv" && (!reportJobId || d.reportJobId === reportJobId)), [ctx.docs, reportJobId]);
  const running = jobId && !ctx.docs.some((d) => d.id === jobId);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = await postJson("/api/agents/jobs", { type: "pdf", reportJobId, template });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error ?? "Couldn't queue that."); return; }
      setJobId(d.job.id);
    } catch { setErr("Couldn't queue that."); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><FileText className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> Tailor for which posting?</h3>
        <ReportPicker reports={ctx.reports} value={reportJobId} onChange={setReportJobId} />
        <label className="block"><span className="label">Template</span>
          <select className="field" value={template} onChange={(e) => setTemplate(e.target.value)} aria-label="CV template">{TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={busy || !reportJobId || !!running} className="btn-primary disabled:opacity-60">{busy ? "Queuing…" : "Tailor CV → PDF"}</button>
          <span className="text-xs text-jh-mute">Two pages max, ATS-safe. Nothing is claimed that isn&apos;t in your CV.</span>
          {err && <p role="alert" className="text-sm text-jh-red">{err}</p>}
        </div>
        {running && <div className="rounded-md bg-jh-mist p-3"><JobStatus jobId={jobId!} onGone={() => setJobId(null)} /></div>}
      </form>

      <section className="card divide-y divide-jh-line">
        <p className="px-5 py-3 text-sm font-display font-semibold text-jh-ink">Tailored CVs{reportJobId ? " for this posting" : ""} ({cvDocs.length})</p>
        {cvDocs.length === 0 ? <p className="px-5 py-8 text-center text-jh-mute text-sm">None yet.</p> : (
          <ul className="divide-y divide-jh-line">
            {cvDocs.map((d) => (
              <li key={d.id} className="px-5 py-3 space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex-1 min-w-0"><span className="block font-semibold text-jh-ink truncate">{d.company} — {d.role}</span><span className="block text-xs text-jh-mute">{d.pageCount} page{d.pageCount === 1 ? "" : "s"} · {TEMPLATES.find((t) => t.key === d.template)?.label ?? d.template} · {d.model} · {new Date(d.createdAt).toLocaleString()}</span></span>
                  <button type="button" onClick={async () => { const e = await downloadDoc(d); if (e) setErr(e); }} className="btn-secondary text-xs px-3 py-1.5"><Download className="h-3.5 w-3.5" /> PDF</button>
                </div>
                {(d.keywordsMissing?.length ?? 0) > 0 && <p className="text-xs text-jh-mute">Not claimed (not in your CV): {d.keywordsMissing!.join(", ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
