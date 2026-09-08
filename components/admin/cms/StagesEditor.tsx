"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { DEFAULT_STAGES, STAGE_COLORS, newStageId, stageDotClass } from "@/lib/stages";
import type { Stage } from "@/lib/types";
import { Section } from "@/components/admin/shared";

// Controlled editor for the Progress-board pipeline — add, rename, recolour,
// reorder and remove columns. The parent (CMS → Progress) owns save.
export default function StagesEditor({ stages, onChange }: { stages: Stage[]; onChange: (s: Stage[]) => void }) {
  const update = (id: string, p: Partial<Stage>) => onChange(stages.map((s) => (s.id === id ? { ...s, ...p } : s)));
  function move(id: string, dir: -1 | 1) {
    const i = stages.findIndex((s) => s.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= stages.length) return;
    const next = [...stages]; [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(id: string) {
    if (stages.length <= 1) return;
    const s = stages.find((x) => x.id === id);
    if (!confirm(`Remove the “${s?.label ?? id}” stage?\n\nJobs members already placed in it aren't deleted — they'll show in the first column until moved. Applied when you Save.`)) return;
    onChange(stages.filter((x) => x.id !== id));
  }
  const add = () => onChange([...stages, { id: newStageId("New stage", stages), label: "New stage", color: "grey" }]);
  function resetDefaults() {
    if (confirm("Reset the pipeline to the built-in default stages? Applied when you Save.")) onChange(structuredClone(DEFAULT_STAGES));
  }

  return (
    <Section title="Pipeline stages" help="The columns on every member’s Progress board, in order. New jobs start in the first stage. Removing a stage doesn’t delete anyone’s jobs — cards left in it appear in the first column until moved."
      aside={<button type="button" onClick={resetDefaults} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap">Reset to defaults</button>}>
      <div className="border border-jh-line rounded-md overflow-hidden">
        <div className="divide-y divide-jh-line">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2.5 bg-white">
              <span className="w-6 text-xs text-jh-mute-2 tabular-nums text-right shrink-0">{i + 1}.</span>
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${stageDotClass(s.color)}`} aria-hidden />
              <input value={s.label} onChange={(e) => update(s.id, { label: e.target.value })}
                className="field py-2 flex-1 text-sm" placeholder="Stage name" aria-label={`Stage ${i + 1} name`} />
              <select value={s.color} onChange={(e) => update(s.id, { color: e.target.value })}
                className="field py-2 text-sm w-32 shrink-0" aria-label={`Stage ${i + 1} colour`}>
                {STAGE_COLORS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <button type="button" aria-label="Move up" onClick={() => move(s.id, -1)} disabled={i === 0}
                className="p-1.5 text-jh-mute hover:text-jh-ink disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" aria-label="Move down" onClick={() => move(s.id, 1)} disabled={i === stages.length - 1}
                className="p-1.5 text-jh-mute hover:text-jh-ink disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" aria-label="Remove stage" onClick={() => remove(s.id)} disabled={stages.length <= 1}
                title={stages.length <= 1 ? "The board needs at least one stage" : undefined}
                className="shrink-0 grid place-items-center h-9 w-9 rounded-[10px] text-jh-mute hover:text-jh-red hover:bg-jh-red-soft disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-jh-mute">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="px-3 py-3 border-t border-jh-line bg-white">
          <button type="button" onClick={add} className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1">
            <Plus className="h-4 w-4" /> Add stage
          </button>
        </div>
      </div>
    </Section>
  );
}
