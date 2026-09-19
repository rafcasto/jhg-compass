"use client";

import { useEffect, useState } from "react";
import { RefreshCw, XCircle } from "lucide-react";
import { authed, fmtDateTime, Empty, Loading, Section, StatCard } from "@/components/admin/shared";
import { JOB_TYPE_LABELS, isTerminal } from "@/lib/careerops/keys";
import type { AgentsStatus, CareerOpsJob } from "@/lib/careerops/types";
import WorkerBanner from "./WorkerBanner";

const STATUS_PILL: Record<CareerOpsJob["status"], string> = {
  queued: "bg-rb-yellow/30 text-jh-ink",
  running: "bg-jh-red-soft text-jh-red",
  done: "bg-rb-green-light/30 text-rb-green-dark",
  failed: "bg-jh-red-soft text-jh-red",
  cancelled: "bg-jh-mist text-jh-mute",
};

const dur = (j: CareerOpsJob) => {
  if (!j.startedAt) return "—";
  const s = Math.round(((j.endedAt ?? Date.now()) - j.startedAt) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

// Admin → Agents → Overview: health cards, models on the Pi, recent runs with log drawer.
export default function Overview({ status, error, onRefresh }: { status: AgentsStatus | null; error: string | null; onRefresh: () => void }) {
  const [jobs, setJobs] = useState<CareerOpsJob[] | null>(null);
  const [open, setOpen] = useState<CareerOpsJob | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function loadJobs() {
    try { const d = await (await authed("/api/admin/agents/jobs")).json(); if (d.ok) setJobs(d.jobs); } catch {}
  }
  useEffect(() => { loadJobs(); const t = setInterval(loadJobs, 10_000); return () => clearInterval(t); }, []);

  async function openJob(j: CareerOpsJob) {
    setOpen(j);
    try { const d = await (await authed(`/api/admin/agents/jobs/${j.id}`)).json(); if (d.ok) setOpen(d.job); } catch {}
  }
  async function cancel(j: CareerOpsJob) {
    if (!confirm(`Cancel ${JOB_TYPE_LABELS[j.type]} ${j.id}?`)) return;
    setBusy(j.id);
    try { await authed(`/api/admin/agents/jobs/${j.id}`, { method: "DELETE" }); await loadJobs(); } finally { setBusy(null); }
  }

  const st = status?.state;
  return (
    <div className="space-y-6">
      <WorkerBanner status={status} error={error} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={status ? (status.online ? "Online" : "Offline") : "…"} label="Pi worker" hint={status?.worker ? `poll every ${Math.round(status.worker.pollMs / 1000)}s` : "careerops-worker.service"} />
        <StatCard value={status?.queueLength ?? 0} label="Jobs waiting" hint="careerops:queue" />
        <StatCard value={st?.models.length ?? 0} label="Ollama models" hint={st?.careerOpsVersion ? `career-ops v${st.careerOpsVersion}` : "on the Pi"} />
        <StatCard value={st ? (st.gpu.reachable ? "Reachable" : "Off") : "…"} label="GPU box" hint={st?.gpu.host ?? "for fine-tuning"} />
      </div>

      <Section title="Agents" help="Each agent is an n8n workflow on the Pi. Active means the workflow is switched on in n8n; the model comes from the Models sub-tab."
        aside={<button type="button" onClick={onRefresh} className="btn-secondary text-xs px-3 py-2" aria-label="Refresh status"><RefreshCw className="h-4 w-4" /></button>}>
        {!st ? <Empty>{status?.online ? "Waiting for the worker to publish its state…" : "The worker publishes agent status when it is online."}</Empty> : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {st.agents.map((a) => (
              <li key={a.key} className="card p-4">
                <p className="font-display font-semibold text-jh-ink capitalize">{a.key}</p>
                <p className={`text-xs mt-1 ${a.active ? "text-rb-green-dark" : "text-jh-mute"}`}>{a.n8nWorkflowId ? (a.active ? "n8n workflow active" : "n8n workflow inactive") : "no n8n workflow yet"}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent runs" help="Every job queued by members or admins, newest first. Click a row for the log and result.">
        {jobs === null ? <Loading>Loading runs…</Loading> : jobs.length === 0 ? <Empty>No runs yet.</Empty> : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-jh-mute border-b border-jh-line">
                  {["Job", "Member", "Status", "Progress", "Duration", "Queued", ""].map((h) => <th key={h} className="font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} onClick={() => openJob(j)} className="border-b border-jh-line last:border-0 cursor-pointer hover:bg-jh-mist/50">
                    <td className="px-3 py-2.5"><p className="font-semibold text-jh-ink">{JOB_TYPE_LABELS[j.type]}</p><p className="text-xs font-mono text-jh-mute">{j.id}</p></td>
                    <td className="px-3 py-2.5 text-jh-mute">{j.createdBy}</td>
                    <td className="px-3 py-2.5"><span className={`pill capitalize ${STATUS_PILL[j.status]}`}>{j.status}</span></td>
                    <td className="px-3 py-2.5 text-jh-mute max-w-[16rem] truncate">{j.error ?? j.progress ?? "—"}</td>
                    <td className="px-3 py-2.5 text-jh-mute tabular-nums">{dur(j)}</td>
                    <td className="px-3 py-2.5 text-jh-mute whitespace-nowrap">{fmtDateTime(j.createdAt)}</td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {!isTerminal(j.status) && (
                        <button type="button" onClick={() => cancel(j)} disabled={busy === j.id} className="btn-ghost text-xs text-jh-red" aria-label="Cancel job"><XCircle className="h-4 w-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {open && (
        <Section title={`${JOB_TYPE_LABELS[open.type]} · ${open.id}`} aside={<button type="button" onClick={() => setOpen(null)} className="btn-ghost text-sm">Close</button>}>
          <dl className="grid sm:grid-cols-3 gap-3 text-sm">
            <div><dt className="text-jh-mute">Status</dt><dd className="capitalize">{open.status}</dd></div>
            <div><dt className="text-jh-mute">Worker</dt><dd className="font-mono">{open.worker ?? "—"}</dd></div>
            <div><dt className="text-jh-mute">Member</dt><dd className="font-mono">{open.uid}</dd></div>
          </dl>
          <details className="mt-3" open><summary className="cursor-pointer text-sm font-semibold">Payload</summary>
            <pre className="mt-2 text-xs bg-jh-mist rounded-md p-3 overflow-auto max-h-48">{JSON.stringify(open.payload, null, 2)}</pre></details>
          <details className="mt-3" open><summary className="cursor-pointer text-sm font-semibold">Log</summary>
            <pre className="mt-2 text-xs bg-jh-ink text-white rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap">{open.log || "(no log yet)"}</pre></details>
          {open.result !== undefined && (
            <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Result</summary>
              <pre className="mt-2 text-xs bg-jh-mist rounded-md p-3 overflow-auto max-h-96">{typeof open.result === "string" ? open.result : JSON.stringify(open.result, null, 2)}</pre></details>
          )}
        </Section>
      )}
    </div>
  );
}
