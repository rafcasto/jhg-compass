"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import JobStatus from "@/components/coach/JobStatus";
import { auth } from "@/lib/firebase/client";
import { paths, useLiveCollection } from "@/lib/firestore/db";
import type { EngineJob } from "@/lib/engine/jobs";
import { ENGINE_JOB_LABELS } from "@/lib/engine/keys";
import type { ProfilePortal } from "@/lib/jobhacking/sections";

// Target companies, page-first (docs/UX_JOBHACKING.md §3b, decision 2026-11-17): the 40 are sourced from the page — the
// companies job (the job boards' APIs, every link opened by code) — and pruned on the page; the coach converses about the
// result. Three pieces of one action: the header's Source my 40 (the page's one primary action), the job's live status
// line under the header (the same JobStatus the coach panel shows), and Add a company under the Top 40.

export function useSourceCompanies(uid: string | undefined, portal: ProfilePortal) {
  const { data: jobs } = useLiveCollection<EngineJob>(uid, paths.engineJobs);
  const latest = useMemo(() => jobs.find((j) => j.type === "companies") ?? null, [jobs]);
  const running = !!latest && (latest.status === "queued" || latest.status === "running");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const call = useCallback(async (body: Record<string, unknown>) => {
    setError(null); setBusy(true);
    try {
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch("/api/coach/companies", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ ...body, portal }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "That didn't work — try again."); return false; }
      return true;
    } catch { setError("Lost the connection — try again."); return false; }
    finally { setBusy(false); }
  }, [portal]);
  const source = useCallback((names?: string[]) => call({ action: "source", ...(names?.length ? { names } : {}) }), [call]);
  const remove = useCallback((name: string) => call({ action: "remove", name }), [call]);
  return { latest, running, busy, error, source, remove };
}

export function SourceCompaniesButton({ running, busy, onSource }: { running: boolean; busy: boolean; onSource: () => void }) {
  return <button type="button" onClick={onSource} disabled={running || busy} className="btn-primary btn-sm">{running ? "Sourcing…" : "Source my 40"}</button>;
}

/** The job's line under the header while it runs or just after — the same grammar as the coach panel's write line. */
export function CompaniesJobStatus({ uid, latest, error, href }: { uid: string; latest: EngineJob | null; error: string | null; href: string }) {
  const recent = latest && Date.now() - (latest.endedAt ?? latest.createdAt) < 15 * 60_000;
  return (
    <div className="space-y-1">
      {latest && (recent || latest.status === "queued" || latest.status === "running") && <JobStatus uid={uid} job={{ id: latest.id, type: latest.type, label: ENGINE_JOB_LABELS.companies }} href={href} />}
      {error && <p role="alert" className="text-sm text-jh-red">{error}</p>}
    </div>
  );
}

/** Under the Top 40: one field, one secondary button — the company is sourced like the rest, never written from a name alone. */
export function AddCompany({ disabled, onAdd }: { disabled: boolean; onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const submit = async (e: FormEvent) => { e.preventDefault(); const n = name.trim(); if (!n) return; if (await onAdd(n)) setName(""); };
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-end gap-2">
      <label className="min-w-56 flex-1">
        <span className="label">Add a company</span>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} className="field text-sm" placeholder="As the company writes it" aria-label="Company to add" maxLength={80} />
      </label>
      <button type="submit" disabled={disabled || !name.trim()} className="btn-secondary btn-sm h-11"><Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Add</button>
      <p className="basis-full text-xs text-jh-mute">The portal reads its postings and careers page before it lands — a name alone is never written.</p>
    </form>
  );
}
