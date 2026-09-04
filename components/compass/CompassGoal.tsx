"use client";

import { useState } from "react";
import { Compass as CompassIcon, Pencil } from "lucide-react";
import { COMPANY_TYPES, EMPTY_GOAL, GOAL_KEYS, normalizeGoal, type Goal } from "@/lib/goal";
import GoalStatement from "./GoalStatement";

export interface CompassGoalLabels {
  eyebrow: string;
  title: string;
  goalEyebrow: string;
  editTitle: string;
  editIntro: string;
}

export const DEFAULT_LABELS: CompassGoalLabels = {
  eyebrow: "Clear objective",
  title: "Compass",
  goalEyebrow: "Your goal statement",
  editTitle: "Complete your objective",
  editIntro: "Every field feeds the statement above.",
};

interface Props {
  goal: Goal;
  onSave: (goal: Goal) => Promise<void> | void;
  labels?: Partial<CompassGoalLabels>;
}

// Header + statement card + (edit-mode only) form. Owns the draft: the draft is
// seeded from `goal` when Edit is pressed, drives the statement live while
// typing, and is thrown away on Cancel. Read mode never renders an input.
export default function CompassGoal({ goal, onSave, labels }: Props) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Goal>(EMPTY_GOAL);
  const [busy, setBusy] = useState(false);

  const shown = editing ? draft : goal;

  function startEdit() {
    setDraft({ ...EMPTY_GOAL, ...goal });
    setEditing(true);
  }
  function cancel() {
    setEditing(false);
    setDraft(EMPTY_GOAL);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSave(normalizeGoal(draft));
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }
  const set = (k: (typeof GOAL_KEYS)[number]) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      {/* ---- Page header ---- */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <span className="eyebrow">{L.eyebrow}</span>
          <h1 className="mt-1">{L.title}</h1>
        </div>
        {!editing && (
          <button type="button" onClick={startEdit} className="cbtn cbtn-secondary" aria-label="Edit objective">
            <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Edit
          </button>
        )}
      </header>

      {/* ---- Goal statement card ---- */}
      <section
        aria-labelledby="goal-eyebrow"
        className="relative overflow-hidden rounded-xl bg-jh-ink text-white px-6 py-6 md:px-8 md:py-7"
      >
        <CompassIcon
          aria-hidden
          strokeWidth={1}
          className="pointer-events-none absolute -right-14 top-1/2 h-[240px] w-[240px] -translate-y-1/2 text-white/5"
        />
        <div className="relative">
          <span id="goal-eyebrow" className="eyebrow text-jh-mute-2">{L.goalEyebrow}</span>
          <div className="mt-3">
            <GoalStatement goal={shown} />
          </div>
        </div>
      </section>

      {/* ---- Edit form (edit mode only) ---- */}
      {editing && (
        <form onSubmit={save} className="card rounded-lg p-5 md:p-7 space-y-5" aria-label="Edit objective">
          <div>
            <h3>{L.editTitle}</h3>
            <p className="mt-1 text-sm text-jh-mute">{L.editIntro}</p>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label htmlFor="goal-role" className="clabel">Job title + seniority level</label>
              <input id="goal-role" className="cfield" value={draft.role ?? ""} onChange={set("role")}
                placeholder="e.g. Senior Product Owner" autoComplete="organization-title" />
            </div>
            <div>
              <label htmlFor="goal-salary" className="clabel">Yearly salary before tax</label>
              <input id="goal-salary" className="cfield text-rb-green-dark font-medium" value={draft.salary ?? ""}
                onChange={set("salary")} placeholder="250,000" inputMode="numeric" />
            </div>
            <div>
              <label htmlFor="goal-city" className="clabel">City</label>
              <input id="goal-city" className="cfield" value={draft.city ?? ""} onChange={set("city")}
                placeholder="e.g. Auckland" autoComplete="address-level2" />
            </div>
            <div>
              <label htmlFor="goal-subsector" className="clabel">Thriving industry subsector</label>
              <input id="goal-subsector" className="cfield" value={draft.subsector ?? ""} onChange={set("subsector")}
                placeholder="e.g. climate-tech SaaS" />
            </div>
            <div>
              <label htmlFor="goal-companyType" className="clabel">Company type</label>
              <select id="goal-companyType" className="cfield" value={draft.companyType ?? ""} onChange={set("companyType")}>
                <option value="">Select…</option>
                {COMPANY_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" className="cbtn cbtn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save objective"}
            </button>
            <button type="button" className="cbtn cbtn-secondary" onClick={cancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
