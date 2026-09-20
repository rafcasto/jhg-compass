"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ExternalLink } from "lucide-react";
import { authed, postJson } from "@/components/admin/shared";
import { paths, useLiveCollection, useLiveDoc } from "@/lib/firestore/db";
import { useAuth } from "@/components/AuthProvider";
import { useAccess } from "@/lib/firestore/access";
import type { CareerOpsDoc, CareerOpsNote, CareerOpsReport, CareerOpsSetupV2, NoteKind } from "@/lib/careerops/types";
import { ScoreBadge } from "@/components/agents/ReportView";
import JobStatus from "@/components/agents/JobStatus";

// ---- one context object every CareerOps tool receives ----
export interface MemberStatus { configured: boolean; online: boolean; queueLength: number; quotaUsed: number }
export interface CareerOpsCtx {
  uid: string;
  isAdmin: boolean;
  setup: CareerOpsSetupV2 | null;
  setupLoading: boolean;
  hasCv: boolean;
  hasPortals: boolean;
  reports: CareerOpsReport[];
  notes: CareerOpsNote[];
  docs: CareerOpsDoc[];
  status: MemberStatus | null;
  statusError: boolean;
  online: boolean;
}

export function useCareerOps(): { ctx: CareerOpsCtx | null; loading: boolean; allowed: boolean } {
  const { user, isAdmin } = useAuth();
  const uid = user?.uid;
  const { agentsEnabled, loading } = useAccess(uid);
  const allowed = agentsEnabled || isAdmin;
  const { data: setup, loading: setupLoading } = useLiveDoc<CareerOpsSetupV2>(uid && allowed ? paths.careerOpsSetup(uid) : null);
  const { data: reports } = useLiveCollection<CareerOpsReport>(allowed ? uid : undefined, paths.careerOpsReports);
  const { data: notes } = useLiveCollection<CareerOpsNote>(allowed ? uid : undefined, paths.careerOpsNotes);
  const { data: docs } = useLiveCollection<CareerOpsDoc>(allowed ? uid : undefined, paths.careerOpsDocs);
  const [status, setStatus] = useState<MemberStatus | null>(null);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let stop = false;
    const load = () => authed("/api/agents/status").then((r) => r.json()).then((d) => { if (!stop) { d.ok ? setStatus(d) : setStatusError(true); } }).catch(() => setStatusError(true));
    load();
    const t = setInterval(load, 20_000);
    return () => { stop = true; clearInterval(t); };
  }, [allowed]);

  const ctx = useMemo<CareerOpsCtx | null>(() => uid ? ({
    uid, isAdmin, setup, setupLoading,
    hasCv: !!setup?.cvMarkdown?.trim(), hasPortals: (setup?.portals?.companies?.length ?? 0) > 0,
    reports, notes, docs, status, statusError, online: !!status?.online,
  }) : null, [uid, isAdmin, setup, setupLoading, reports, notes, docs, status, statusError]);
  return { ctx, loading, allowed };
}

// ---- queue a job, follow it, and hand back the note it produced ----
export function useNoteJob(notes: CareerOpsNote[], kind: NoteKind) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const note = useMemo(() => jobId ? notes.find((n) => n.id === jobId && n.kind === kind) ?? null : null, [notes, jobId, kind]);
  const [failed, setFailed] = useState(false);

  async function run(body: Record<string, unknown>) {
    setErr(null); setBusy(true); setFailed(false);
    try {
      const r = await postJson("/api/agents/jobs", body);
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error ?? "Couldn't queue that."); return null; }
      setJobId(d.job.id);
      return d.job.id as string;
    } catch { setErr("Couldn't queue that."); return null; }
    finally { setBusy(false); }
  }
  const status = jobId && !note ? <div className="rounded-md bg-jh-mist p-3"><JobStatus jobId={jobId} onGone={() => setFailed(true)} /></div> : null;
  return { run, jobId, note, err, busy, failed, status, reset: () => { setJobId(null); setErr(null); setFailed(false); } };
}

// ---- small UI pieces ----
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }} className="btn-ghost text-xs">
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {ok ? "Copied" : label}
    </button>
  );
}

export function Markdown({ children }: { children: string }) {
  return <div className="prose prose-sm max-w-none prose-table:text-xs prose-headings:font-display"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown></div>;
}

// A note the worker produced: header, sources, markdown, copy.
export function NoteView({ note, extra }: { note: CareerOpsNote; extra?: ReactNode }) {
  return (
    <article className="card p-5 space-y-3">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg">{note.title}</h2>
          <p className="text-xs text-jh-mute mt-0.5">{note.via === "claude" ? "Claude + web search" : note.model} · {new Date(note.createdAt).toLocaleString()}</p>
        </div>
        <CopyButton text={note.markdown} label="Copy markdown" />
      </header>
      {extra}
      <Markdown>{note.markdown}</Markdown>
      {note.sources && note.sources.length > 0 && (
        <details className="text-xs text-jh-mute"><summary className="cursor-pointer">Sources ({note.sources.length})</summary>
          <ul className="mt-2 space-y-1">{note.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">{s.title || s.url} <ExternalLink className="h-3 w-3" /></a></li>)}</ul>
        </details>
      )}
    </article>
  );
}

// Past notes of one kind, newest first.
export function NoteHistory({ notes, kind, onOpen, current }: { notes: CareerOpsNote[]; kind: NoteKind; onOpen: (n: CareerOpsNote) => void; current?: string | null }) {
  const list = notes.filter((n) => n.kind === kind);
  if (!list.length) return null;
  return (
    <section className="card divide-y divide-jh-line">
      <p className="px-5 py-3 text-sm font-display font-semibold text-jh-ink">Previous ({list.length})</p>
      <ul className="divide-y divide-jh-line">
        {list.slice(0, 30).map((n) => (
          <li key={n.id}><button type="button" onClick={() => onOpen(n)} className={`w-full text-left px-5 py-2.5 flex items-center gap-3 hover:bg-jh-mist/50 ${current === n.id ? "bg-jh-mist/60" : ""}`}>
            <span className="flex-1 min-w-0 truncate text-sm text-jh-ink">{n.title}</span>
            <span className="text-xs text-jh-mute-2 whitespace-nowrap">{new Date(n.createdAt).toLocaleDateString()}</span>
          </button></li>
        ))}
      </ul>
    </section>
  );
}

// Choose one of the member's scored postings.
export function ReportPicker({ reports, value, onChange, label = "Which posting?", minScore }: { reports: CareerOpsReport[]; value: string; onChange: (id: string) => void; label?: string; minScore?: number }) {
  const list = minScore == null ? reports : reports.filter((r) => (r.score ?? 0) >= minScore);
  if (!reports.length) return <p className="text-sm text-jh-red">Score a posting first (Scoring → oferta) — every tool here works from a scored report.</p>;
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">— pick a scored posting —</option>
        {list.map((r) => <option key={r.id} value={r.jobId}>{r.company} — {r.role} · {r.score == null ? "?" : r.score.toFixed(1)}/5 · {new Date(r.createdAt).toLocaleDateString()}</option>)}
      </select>
    </label>
  );
}

export function ReportRow({ r, onOpen }: { r: CareerOpsReport; onOpen?: (r: CareerOpsReport) => void }) {
  return (
    <button type="button" onClick={() => onOpen?.(r)} className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-jh-mist/50">
      <ScoreBadge score={r.score} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-jh-ink truncate">{r.company} — {r.role}</span>
        <span className="block text-xs text-jh-mute truncate">{r.archetype} · {r.legitimacy}{r.addedOpportunityId ? " · on your board" : ""}</span>
      </span>
      <span className="text-xs text-jh-mute-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</span>
    </button>
  );
}

export async function downloadDoc(d: CareerOpsDoc): Promise<string | null> {
  const r = await authed(`/api/agents/docs/${d.id}/download`);
  if (!r.ok) return "Couldn't download the file.";
  const blob = await r.blob();
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: d.file });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return null;
}

export const splitLines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
export const isHttp = (s: string) => { try { const u = new URL(s); return /^https?:$/.test(u.protocol); } catch { return false; } };
