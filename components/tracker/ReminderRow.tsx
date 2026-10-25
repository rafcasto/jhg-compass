"use client";

import { AlertCircle, Calendar, Check, Briefcase, Trash2 } from "lucide-react";
import type { Reminder } from "@/lib/types";

export function fmtDue(dueOn?: string) {
  if (!dueOn) return null;
  const d = new Date(`${dueOn}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export interface ReminderRowLabels {
  overdue: string;
  noDue: string;
  delete: string;
}

// ONE reminder row, used by the Reminders view and inside a job's detail sheet so
// the same object never gets two treatments. 24px checkbox inside a 40px target;
// the unchecked border is `jh-mute` (≥3:1 on white — `jh-line` was ~1.2:1).
export default function ReminderRow({ reminder: r, today, meta, onToggle, onRemove, labels }: {
  reminder: Reminder;
  /** yyyy-mm-dd — rows due before this are overdue. */
  today: string;
  /** Optional context line (the job this reminder belongs to). */
  meta?: string | null;
  onToggle: () => void;
  onRemove: () => void;
  labels: ReminderRowLabels;
}) {
  const overdue = !r.done && !!r.dueOn && r.dueOn < today;
  return (
    <li className={`flex items-start gap-2 rounded-sm border border-jh-line p-3 ${r.done ? "bg-jh-mist/60" : "bg-white shadow-jh-1"}`}>
      <button type="button" onClick={onToggle} aria-pressed={!!r.done}
        aria-label={r.done ? "Mark not done" : "Mark done"}
        className="icon-btn icon-btn-tight -my-2.5 hover:bg-transparent">
        <span className={`grid h-6 w-6 place-items-center rounded-xs border-2 transition-colors duration-200 ease-out
          ${r.done ? "border-rb-green-dark bg-rb-green-dark text-white" : "border-jh-mute bg-white hover:border-jh-ink"}`}>
          {r.done && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-display text-sm font-semibold leading-snug ${r.done ? "text-jh-mute line-through" : "text-jh-ink"}`}>{r.title}</p>
        {!r.done && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-jh-red" : "text-jh-mute"}`}>
              {overdue ? <AlertCircle className="h-3.5 w-3.5" aria-hidden /> : <Calendar className="h-3.5 w-3.5" aria-hidden />}
              {r.dueOn ? (overdue ? `${labels.overdue} · ${fmtDue(r.dueOn)}` : fmtDue(r.dueOn)) : labels.noDue}
            </span>
            {meta && (
              <span className="inline-flex min-w-0 items-center gap-1 text-jh-mute">
                <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{meta}</span>
              </span>
            )}
          </div>
        )}
      </div>
      <button type="button" onClick={onRemove} className="icon-btn icon-btn-danger icon-btn-tight -my-2.5" aria-label={labels.delete}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
