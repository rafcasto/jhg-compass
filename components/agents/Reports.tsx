"use client";

import type { CareerOpsReport } from "@/lib/careerops/types";
import { ScoreBadge } from "./ReportView";

export default function Reports({ reports, onOpen }: { reports: CareerOpsReport[]; onOpen: (r: CareerOpsReport) => void }) {
  if (reports.length === 0) return <div className="card p-10 text-center text-jh-mute">No evaluations yet. Paste a job on the Evaluate tab.</div>;
  return (
    <ul className="card divide-y divide-jh-line">
      {reports.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onOpen(r)} className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-jh-mist/50">
            <ScoreBadge score={r.score} />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-jh-ink truncate">{r.company} — {r.role}</span>
              <span className="block text-xs text-jh-mute truncate">{r.archetype} · {r.legitimacy}{r.addedOpportunityId ? " · on your board" : ""}</span>
            </span>
            <span className="text-xs text-jh-mute-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
