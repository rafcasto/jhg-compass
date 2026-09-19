"use client";

import { useEffect, useState } from "react";
import { Bot, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useAccess } from "@/lib/firestore/access";
import { authed, fmtDateTime } from "@/components/admin/shared";
import { JOB_TYPE_LABELS } from "@/lib/careerops/keys";
import type { CareerOpsJob } from "@/lib/careerops/types";

interface MemberStatus { configured: boolean; online: boolean; queueLength: number; quotaUsed: number; jobs: CareerOpsJob[] }

// Member → Agents (career-ops on the Pi). Phase 0: shows whether the agents are
// awake and the member's recent runs. Setup / Evaluate / Scan / Reports arrive in phase 1+.
export default function AgentsPage() {
  const { user, isAdmin } = useAuth();
  const { agentsEnabled, loading } = useAccess(user?.uid);
  const [s, setS] = useState<MemberStatus | null>(null);
  const [err, setErr] = useState(false);

  const allowed = agentsEnabled || isAdmin;
  useEffect(() => {
    if (!allowed) return;
    let stop = false;
    const load = () => authed("/api/agents/status").then((r) => r.json()).then((d) => { if (!stop) { d.ok ? setS(d) : setErr(true); } }).catch(() => setErr(true));
    load();
    const t = setInterval(load, 15_000);
    return () => { stop = true; clearInterval(t); };
  }, [allowed]);

  if (loading) return <p className="text-jh-mute animate-pulse">Loading…</p>;
  if (!allowed) return (
    <div className="card p-10 text-center">
      <h1 className="mb-2">Agents aren&apos;t switched on for you yet</h1>
      <p className="text-jh-mute">Ask your JobHackers coach to enable the Agents tab on your account.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">AI agents</p>
        <h1 className="flex items-center gap-2"><Bot className="h-6 w-6 text-jh-red" strokeWidth={1.5} /> Your career-ops agents</h1>
        <p className="text-jh-mute mt-1 max-w-2xl">Scout finds postings, Evaluator scores them against your CV (1–5, A–G report), Tailor drafts the PDF. They run on our own hardware — your CV never leaves it. They never apply for you: you always press the button.</p>
      </header>

      {err ? <p className="text-jh-red">Couldn&apos;t reach the agents. Try again in a moment.</p>
      : !s ? <p className="text-jh-mute animate-pulse">Checking the agents…</p>
      : (
        <div className="card p-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {s.online
            ? <span className="inline-flex items-center gap-2 text-rb-green-dark font-semibold"><Wifi className="h-4 w-4" /> Agents awake</span>
            : <span className="inline-flex items-center gap-2 text-jh-mute font-semibold"><WifiOff className="h-4 w-4" /> Agents asleep — jobs will wait</span>}
          <span className="text-jh-mute">{s.queueLength} in the queue</span>
          <span className="text-jh-mute">{s.quotaUsed} evaluations today</span>
        </div>
      )}

      <section className="card p-5">
        <h2 className="text-lg">Evaluate a job</h2>
        <p className="text-jh-mute text-sm mt-1">Paste a job URL or the description and get an A–G evaluation. Coming next — first add your CV so the Evaluator knows you.</p>
        <button type="button" disabled className="btn-primary mt-4 opacity-50 cursor-not-allowed">Coming soon</button>
      </section>

      {s && s.jobs.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg mb-3">Recent runs</h2>
          <ul className="divide-y divide-jh-line">
            {s.jobs.map((j) => (
              <li key={j.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-jh-ink">{JOB_TYPE_LABELS[j.type]}</span>
                <span className="text-jh-mute">{j.error ?? j.progress ?? j.status}</span>
                <span className="text-jh-mute-2 whitespace-nowrap">{fmtDateTime(j.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
