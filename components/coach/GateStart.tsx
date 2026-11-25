"use client";

import { skipGateWarning, type Coach } from "@/lib/engine/coach/keys";

// The gate as the panel shows it (decision 2026-11-25, docs/UX_JOURNEY_JOBHACKING.md pain 9): one line on why,
// the warning that carries the pedagogy, and *Start anyway* — secondary, never the red: the default path is the
// rail of six under it, which the panel renders. A member who already knows her forty is not sent back three coaches.
export default function GateStart({ coach, missing, onStart, disabled = false }: {
  coach: Coach;
  /** The coaches this one needs that are not complete. */
  missing: readonly Coach[];
  /** Start the conversation past the gate. */
  onStart: () => void;
  disabled?: boolean;
}) {
  const words = missing.map((c) => c.label).join(" and ");
  return (
    <div className="space-y-3">
      <p className="text-sm text-jh-mute">{coach.label} starts after {words} — your coach needs what they write first.</p>
      <div className="space-y-2">
        <button type="button" onClick={onStart} disabled={disabled} className="btn-secondary btn-sm disabled:opacity-60">Start anyway</button>
        <p className="text-xs text-jh-mute">{skipGateWarning(coach, missing)}</p>
      </div>
    </div>
  );
}
