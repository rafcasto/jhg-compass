"use client";

import { useEffect, useState } from "react";
import { Bot, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useAccess } from "@/lib/firestore/access";
import { paths, useLiveCollection, useLiveDoc } from "@/lib/firestore/db";
import { authed } from "@/components/admin/shared";
import type { CareerOpsJob, CareerOpsReport, CareerOpsSetupV2 } from "@/lib/careerops/types";
import Setup from "@/components/agents/Setup";
import Evaluate from "@/components/agents/Evaluate";
import Reports from "@/components/agents/Reports";
import ReportView from "@/components/agents/ReportView";
import Scan from "@/components/agents/Scan";

interface MemberStatus { configured: boolean; online: boolean; queueLength: number; quotaUsed: number; jobs: CareerOpsJob[] }
type View = "setup" | "scan" | "evaluate" | "reports";

// Member → Agents (career-ops on the Pi): Setup → Evaluate → Reports.
export default function AgentsPage() {
  const { user, isAdmin } = useAuth();
  const uid = user?.uid;
  const { agentsEnabled, loading } = useAccess(uid);
  const allowed = agentsEnabled || isAdmin;
  const [s, setS] = useState<MemberStatus | null>(null);
  const [err, setErr] = useState(false);
  const [view, setView] = useState<View>("evaluate");
  const [open, setOpen] = useState<CareerOpsReport | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [evalJob, setEvalJob] = useState<string | null>(null);

  const { data: setup, loading: setupLoading } = useLiveDoc<CareerOpsSetupV2>(uid && allowed ? paths.careerOpsSetup(uid) : null);
  const { data: reports } = useLiveCollection<CareerOpsReport>(allowed ? uid : undefined, paths.careerOpsReports);
  const hasCv = !!setup?.cvMarkdown?.trim();
  const hasPortals = (setup?.portals?.companies?.length ?? 0) > 0;

  useEffect(() => {
    if (!allowed) return;
    let stop = false;
    const load = () => authed("/api/agents/status").then((r) => r.json()).then((d) => { if (!stop) { d.ok ? setS(d) : setErr(true); } }).catch(() => setErr(true));
    load();
    const t = setInterval(load, 20_000);
    return () => { stop = true; clearInterval(t); };
  }, [allowed]);

  // First visit with no CV → land on Setup.
  useEffect(() => { if (!setupLoading && setup === null) setView("setup"); }, [setupLoading, setup]);

  // When the job we're waiting on lands as a report, open it.
  useEffect(() => {
    if (!waitingFor) return;
    const r = reports.find((x) => x.jobId === waitingFor);
    if (r) { setOpen(r); setWaitingFor(null); setView("reports"); }
  }, [reports, waitingFor]);

  if (loading) return <p className="text-jh-mute animate-pulse">Loading…</p>;
  if (!allowed) return (
    <div className="card p-10 text-center">
      <h1 className="mb-2">Agents aren&apos;t switched on for you yet</h1>
      <p className="text-jh-mute">Ask your JobHackers coach to enable the Agents tab on your account.</p>
    </div>
  );

  // Left to right in the order a member uses them: Setup (once) → Evaluate → Reports.
  const TABS: { key: View; label: string }[] = [
    { key: "setup", label: hasCv ? "1 · Setup" : "1 · Setup — add your CV" },
    { key: "evaluate", label: "2 · Evaluate" },
    { key: "reports", label: `3 · Reports${reports.length ? ` (${reports.length})` : ""}` },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">AI agents</p>
          <h1 className="flex items-center gap-2"><Bot className="h-6 w-6 text-jh-red" strokeWidth={1.5} /> Your career-ops agents</h1>
          <p className="text-jh-mute mt-1 max-w-2xl">The Evaluator scores a posting against your CV (1–5, A–G report). It runs on our own hardware — your CV never leaves it — and it never applies for you: you always press the button.</p>
        </div>
        <div className="text-sm text-right">
          {err ? <span className="text-jh-red">Can&apos;t reach the agents</span>
          : !s ? <span className="text-jh-mute animate-pulse">Checking…</span>
          : s.online ? <span className="inline-flex items-center gap-1.5 text-rb-green-dark font-semibold"><Wifi className="h-4 w-4" /> Agents awake</span>
          : <span className="inline-flex items-center gap-1.5 text-jh-mute font-semibold"><WifiOff className="h-4 w-4" /> Agents asleep</span>}
          {s && <p className="text-xs text-jh-mute mt-0.5">{s.queueLength} in queue · {s.quotaUsed} evaluations today</p>}
        </div>
      </header>

      <div role="tablist" aria-label="Agents sections" className="inline-flex flex-wrap gap-1 rounded-pill bg-jh-mist p-1">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={view === t.key} onClick={() => { setView(t.key); setOpen(null); }}
            className={`px-4 py-2 rounded-pill text-sm font-display font-semibold transition-colors ${view === t.key ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute hover:text-jh-ink"}`}>{t.label}</button>
        ))}
      </div>

      {view === "scan" && uid && <Scan uid={uid} hasPortals={hasCv && hasPortals} online={!!s?.online} onEvaluateQueued={(id) => { setWaitingFor(id); setView("evaluate"); setEvalJob(id); }} />}
      {view === "evaluate" && <Evaluate hasCv={hasCv} online={!!s?.online} onDone={(id) => setWaitingFor(id)} externalJobId={evalJob} />}
      {view === "reports" && uid && (open ? <ReportView uid={uid} report={open} onClose={() => setOpen(null)} /> : <Reports reports={reports} onOpen={setOpen} />)}
      {view === "setup" && <Setup onReady={() => setView("evaluate")} />}
    </div>
  );
}
