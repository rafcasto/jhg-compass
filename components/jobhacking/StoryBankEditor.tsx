"use client";

import { useEffect, useState } from "react";
import { setDoc } from "firebase/firestore";
import { Check, Plus, Save, TriangleAlert, X } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { PROVENANCES, STORY_BANK_CAP, cleanStoryBank, nextStoryId, storyBankDraft, type StoryBankDraft, type StoryBankSource } from "@/lib/jobhacking/story-bank";
import type { Snapshot } from "@/lib/careerops/types";

// JobHacking → Artefacts → Story Bank → Edit — docs/UX_JOBHACKING.md §3d.
//
// The three lists as rows the member types into: proof points (name · hero
// metric), stories (id · title · result · provenance) and snapshots (company ·
// the story it points at · title · figures). Add and remove on each; a story's
// id is given when it is added (the Packer's S<n> shape) and shown, not typed,
// so snapshots keep pointing at the right story. Save writes ONLY narrative ·
// stories · snapshots over what is stored; blank rows are dropped on save, a
// cleared list is written empty. One red button.

export default function StoryBankEditor({ uid, source, onSaved, onCancel }: {
  uid: string;
  source: StoryBankSource | null | undefined;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<StoryBankDraft>(() => storyBankDraft(source));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const patch = (p: Partial<StoryBankDraft>) => { setD((cur) => ({ ...cur, ...p })); setDirty(true); setErr(null); };

  const storyLabel = (id: string | undefined) => { const s = d.stories.find((x) => (x.id ?? "").trim() === (id ?? "").trim()); return s ? `${s.id} · ${s.title || "untitled"}` : id || ""; };

  async function save() {
    setBusy(true); setErr(null);
    try {
      await setDoc(paths.careerOpsSetup(uid), { ...cleanStoryBank(d), updatedAt: Date.now() }, { merge: true });
      setDirty(false);
      onSaved();
    } catch {
      setErr("Couldn't save your story bank — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {err && <p role="alert" className="flex items-start gap-2 rounded-sm border border-jh-red/30 bg-jh-red/5 px-3 py-2.5 text-sm text-jh-red"><TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden /> {err}</p>}

      <Group id="sbe-proof" label="Proof points" n={d.proofPoints.length} onAdd={() => patch({ proofPoints: [...d.proofPoints, { name: "" }] })} addLabel="Add proof point" hint="A named result and the one number that proves it.">
        {d.proofPoints.map((p, i) => (
          <li key={i} className="grid gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center">
            <Field label={`Proof point ${i + 1} name`} placeholder="Fortnightly release train" value={p.name} onChange={(name) => patch({ proofPoints: d.proofPoints.map((x, j) => (j === i ? { ...x, name } : x)) })} />
            <Field label={`Proof point ${i + 1} hero metric`} placeholder="Monthly to fortnightly releases across 9 teams in 2 quarters" value={p.heroMetric ?? ""} onChange={(heroMetric) => patch({ proofPoints: d.proofPoints.map((x, j) => (j === i ? { ...x, heroMetric } : x)) })} />
            <Remove label={`Remove proof point ${i + 1}`} onClick={() => patch({ proofPoints: d.proofPoints.filter((_, j) => j !== i) })} />
          </li>
        ))}
      </Group>

      <Group id="sbe-stories" label="Stories" n={d.stories.length} onAdd={() => patch({ stories: [...d.stories, { id: nextStoryId(d.stories), title: "" }] })} addLabel="Add story" hint="What happened, in one or two sentences with the figures, and how sure you are of them.">
        {d.stories.map((s, i) => {
          const provOptions = [...PROVENANCES, ...((s.provenance ?? "").trim() && !(PROVENANCES as readonly string[]).includes(s.provenance!.trim()) ? [s.provenance!.trim()] : [])];
          return (
            <li key={s.id ?? i} className="grid gap-2 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-start">
              <span className="pt-2.5 font-mono text-xs text-jh-mute" aria-label={`Story ${i + 1} id`}>{s.id}</span>
              <div className="space-y-2">
                <Field label={`Story ${i + 1} title`} placeholder="Fortnightly release train" value={s.title} onChange={(title) => patch({ stories: d.stories.map((x, j) => (j === i ? { ...x, title } : x)) })} />
                <textarea aria-label={`Story ${i + 1} result`} className="field text-sm min-h-[4.5rem]" placeholder="Moved release cadence from monthly to fortnightly across nine teams in two quarters with a single release train." value={s.result ?? ""} onChange={(e) => patch({ stories: d.stories.map((x, j) => (j === i ? { ...x, result: e.target.value } : x)) })} />
                <label className="block max-w-xs">
                  <span className="label">Provenance</span>
                  <select aria-label={`Story ${i + 1} provenance`} className="field text-sm" value={(s.provenance ?? "").trim()} onChange={(e) => patch({ stories: d.stories.map((x, j) => (j === i ? { ...x, provenance: e.target.value } : x)) })}>
                    <option value="">Select…</option>
                    {provOptions.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </label>
              </div>
              <Remove label={`Remove story ${i + 1}`} onClick={() => patch({ stories: d.stories.filter((_, j) => j !== i) })} />
            </li>
          );
        })}
      </Group>

      <Group id="sbe-snapshots" label="Snapshots" n={d.snapshots.length} onAdd={() => patch({ snapshots: [...d.snapshots, { company: "", results: [] }] })} addLabel="Add snapshot" hint="A story pointed at one target company, with the figures to lead with.">
        {d.snapshots.map((x, i) => (
          <li key={i} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
            <div className="space-y-2">
              <Field label={`Snapshot ${i + 1} company`} placeholder="Tracksuit" value={x.company} onChange={(company) => patch({ snapshots: d.snapshots.map((y, j) => (j === i ? { ...y, company } : y)) })} />
              <label className="block">
                <span className="label">Story</span>
                <select aria-label={`Snapshot ${i + 1} story`} className="field text-sm" value={(x.storyId ?? "").trim()} onChange={(e) => patch({ snapshots: d.snapshots.map((y, j) => (j === i ? { ...y, storyId: e.target.value } : y)) })}>
                  <option value="">None</option>
                  {d.stories.filter((s) => (s.id ?? "").trim()).map((s) => <option key={s.id} value={s.id!.trim()}>{storyLabel(s.id)}</option>)}
                </select>
              </label>
            </div>
            <div className="space-y-2">
              <Field label={`Snapshot ${i + 1} title`} placeholder="Fortnightly release train" value={x.title ?? ""} onChange={(title) => patch({ snapshots: d.snapshots.map((y, j) => (j === i ? { ...y, title } : y)) })} />
              <ListField label={`Snapshot ${i + 1} figures`} placeholder="monthly, fortnightly" value={x.results ?? []} onChange={(results) => patch({ snapshots: d.snapshots.map((y, j) => (j === i ? { ...y, results } : y)) })} />
            </div>
            <Remove label={`Remove snapshot ${i + 1}`} onClick={() => patch({ snapshots: d.snapshots.filter((_, j) => j !== i) })} />
          </li>
        ))}
      </Group>

      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          {busy ? <Save className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} {busy ? "Saving…" : "Save story bank"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary btn-sm">Cancel</button>
        <p className="text-xs text-jh-mute">Rows without a name, a title or a company are left out when you save.</p>
      </div>
    </div>
  );
}

function Group({ id, label, n, hint, onAdd, addLabel, children }: { id: string; label: string; n: number; hint: string; onAdd: () => void; addLabel: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <header>
        <h3 id={id} className="section-label flex items-center gap-2">{label} <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{n}</span></h3>
        <p className="mt-1 text-xs text-jh-mute">{hint}</p>
      </header>
      {n > 0 && <ul className="divide-y divide-jh-line border-t border-jh-line">{children}</ul>}
      {n < STORY_BANK_CAP && <button type="button" onClick={onAdd} className="btn-secondary btn-sm"><Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {addLabel}</button>}
    </section>
  );
}

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return <input aria-label={label} className="field text-sm" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="icon-btn icon-btn-danger justify-self-end sm:justify-self-auto"><X className="h-4 w-4" aria-hidden /></button>;
}

/** Comma-separated figures. The text is local, the list is the value — see KeywordArea in agents/Portals for why. */
function ListField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: Snapshot["results"] & string[]; onChange: (v: string[]) => void }) {
  const parse = (s: string) => s.split(/[,\n]/).map((k) => k.trim()).filter(Boolean);
  const [draft, setDraft] = useState(() => value.join(", "));
  useEffect(() => {
    if (JSON.stringify(parse(draft)) !== JSON.stringify(value)) setDraft(value.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only an outside change may rewrite what is being typed
  }, [value]);
  return <input aria-label={label} className="field text-sm" placeholder={placeholder} value={draft} onChange={(e) => { setDraft(e.target.value); onChange(parse(e.target.value)); }} />;
}
