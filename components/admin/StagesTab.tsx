"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { DEFAULT_STAGES, STAGE_COLORS, newStageId, stageDotClass } from "@/lib/stages";
import type { Stage } from "@/lib/types";

async function authed(url: string, init: RequestInit = {}) {
  const token = await auth.currentUser!.getIdToken();
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
}

// Admin: manage the Progress-board pipeline — add, rename, recolour, reorder and
// remove stages. Persists config/content.stages only (the Content tab leaves it alone).
export default function StagesTab() {
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authed("/api/admin/content").then((r) => r.json()).then((d) => {
      if (d.ok) setStages(d.content.stages);
      else setError("Couldn't load stages.");
    }).catch(() => setError("Couldn't load stages."));
  }, []);

  function patch(next: Stage[]) { setStages(next); setSaved(false); setError(null); }
  function update(id: string, p: Partial<Stage>) {
    patch((stages ?? []).map((s) => (s.id === id ? { ...s, ...p } : s)));
  }
  function move(id: string, dir: -1 | 1) {
    const list = stages ?? [];
    const i = list.findIndex((s) => s.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
    patch(next);
  }
  function remove(id: string) {
    const list = stages ?? [];
    if (list.length <= 1) return;
    const s = list.find((x) => x.id === id);
    if (!confirm(`Remove the “${s?.label ?? id}” stage?\n\nJobs members already placed in it aren't deleted — they'll show in the first column until moved. Applied when you Save.`)) return;
    patch(list.filter((x) => x.id !== id));
  }
  function add() {
    const list = stages ?? [];
    patch([...list, { id: newStageId("New stage", list), label: "New stage", color: "grey" }]);
  }
  function resetDefaults() {
    if (confirm("Reset the pipeline to the built-in default stages? Applied when you Save.")) patch(structuredClone(DEFAULT_STAGES));
  }

  async function save() {
    if (!stages) return;
    const blank = stages.find((s) => !s.label.trim());
    if (blank) { setError("Every stage needs a name."); return; }
    setBusy(true); setSaved(false); setError(null);
    try {
      const r = await authed("/api/admin/content", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: { stages } }),
      });
      const d = await r.json();
      if (d.ok) { setStages(d.content.stages); setSaved(true); }
      else setError("Save failed.");
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !stages) return <p className="text-jh-red">{error}</p>;
  if (!stages) return <p className="text-jh-mute animate-pulse">Loading stages…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl">Progress stages</h2>
          <p className="text-jh-mute text-sm mt-1">The columns on every member’s Progress board, in order. New jobs start in the first stage. Changes go live the moment you save.</p>
        </div>
        <button type="button" onClick={resetDefaults} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap">Reset to defaults</button>
      </div>

      <div className="card overflow-hidden">
        <div className="divide-y divide-jh-line">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2.5">
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
        <div className="px-3 py-3 border-t border-jh-line">
          <button type="button" onClick={add} className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1">
            <Plus className="h-4 w-4" /> Add stage
          </button>
        </div>
      </div>

      <p className="text-xs text-jh-mute">Removing a stage doesn’t delete anyone’s jobs — cards left in a removed stage appear in the first column until the member moves them.</p>

      <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-jh-paper/90 backdrop-blur border-t border-jh-line flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save stages"}</button>
        {saved && <span className="text-sm text-rb-green-dark">Saved ✓ — live now</span>}
        {error && <span className="text-sm text-jh-red">{error}</span>}
      </div>
    </div>
  );
}
