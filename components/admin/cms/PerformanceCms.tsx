"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DEFAULT_CONTENT, TEXT_FIELDS, newActivityId, weeklyTargetsFrom } from "@/lib/content";
import { ymd } from "@/lib/period";
import type { Activity, ActivityLog, ContentConfig } from "@/lib/types";
import PerformanceScreen from "@/components/performance/PerformanceScreen";
import {
  authed, postJson, AuditLine, EditorLayout, Loading, NumberField, PhoneFrame, PreviewAside, SaveBar, Section, TextFields, type Notice,
} from "@/components/admin/shared";

const FIELDS = TEXT_FIELDS.filter((f) => f.group === "Performance tab");
const KEYS = new Set(FIELDS.map((f) => f.key));

// The Performance tab: its copy, the effort split and the activity taxonomy
// (which onboarding step 3 re-uses). Preview is the real screen with sample logs.
export default function PerformanceCms() {
  const [cfg, setCfg] = useState<ContentConfig | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: number | null; updatedBy: string | null } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    authed("/api/admin/content").then((r) => r.json()).then((d) => { if (d.ok) { setCfg(d.content); setMeta(d.meta ?? null); } });
  }, []);

  const patch = (p: Partial<ContentConfig>) => { setCfg((c) => (c ? { ...c, ...p } : c)); setDirty(true); setNotice(null); };
  const setText = (key: string, value: string) => { setCfg((c) => (c ? { ...c, text: { ...c.text, [key]: value } } : c)); setDirty(true); setNotice(null); };
  const updateActivity = (id: string, p: Partial<Activity>) => patch({ activities: cfg!.activities.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const removeActivity = (id: string) => patch({ activities: cfg!.activities.filter((a) => a.id !== id) });
  const addActivity = (market: "hidden" | "visible") =>
    patch({ activities: [...cfg!.activities, { id: newActivityId(""), market, emoji: "•", label: "New activity", defaultWeekly: 1 }] });
  function resetDefaults() {
    if (confirm("Reset the Performance copy, effort split and activity list to the built-in defaults? Applied when you Save.")) {
      const text = { ...cfg!.text };
      for (const k of KEYS) text[k] = DEFAULT_CONTENT.text[k] ?? "";
      patch({ text, effortSplit: structuredClone(DEFAULT_CONTENT.effortSplit), activities: structuredClone(DEFAULT_CONTENT.activities) });
    }
  }

  async function save() {
    if (!cfg) return;
    setBusy(true); setNotice(null);
    const text: Record<string, string> = {};
    for (const k of KEYS) text[k] = cfg.text[k] ?? "";
    try {
      const d = await (await postJson("/api/admin/content", { content: { text, effortSplit: cfg.effortSplit, activities: cfg.activities } })).json();
      if (d.ok) { setCfg(d.content); setMeta(d.meta ?? null); setDirty(false); setNotice({ kind: "ok", text: "Saved — live for members now." }); }
      else setNotice({ kind: "err", text: "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(false); }
  }

  // Sample day: the first few activities partially done so bars, pills and the
  // "done" state all show up in the preview.
  const sampleLogs = useMemo<ActivityLog[]>(() => {
    if (!cfg) return [];
    const today = ymd(new Date());
    return cfg.activities.filter((a) => a.defaultWeekly > 0).slice(0, 4).map((a, i) => ({
      id: `s${i}`, categoryId: a.id, loggedOn: today, count: i === 0 ? Math.max(1, Math.ceil(a.defaultWeekly / 5)) : 1,
    }));
  }, [cfg]);

  if (!cfg) return <Loading>Loading Performance tab…</Loading>;
  const hidden = cfg.activities.filter((a) => a.market === "hidden");
  const visible = cfg.activities.filter((a) => a.market === "visible");
  const t = (k: string) => cfg.text[k] ?? "";

  return (
    <div className="space-y-6">
      <EditorLayout
        form={
          <>
            <Section title="Copy" help="Header, banners, buttons and hints on the Performance tab.">
              <TextFields fields={FIELDS} text={cfg.text} onChange={setText} idPrefix="cms-perf" />
            </Section>
            <Section title="Effort split" help="The percentages quoted on the Hidden / Visible banners (and onboarding step 3).">
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <NumberField id="effort-hidden" label="Hidden — % of success" max={100} value={cfg.effortSplit.hidden} onChange={(v) => patch({ effortSplit: { ...cfg.effortSplit, hidden: Math.min(100, v) } })} />
                <NumberField id="effort-visible" label="Visible — % of success" max={100} value={cfg.effortSplit.visible} onChange={(v) => patch({ effortSplit: { ...cfg.effortSplit, visible: Math.min(100, v) } })} />
              </div>
            </Section>
            <Section title="Job-market activities" help="The rows on Performance and in onboarding step 3. “Default / wk” is the suggested weekly target until a member sets their own."
              aside={<button type="button" onClick={resetDefaults} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap">Reset to defaults</button>}>
              <ActivityList title={`${t("perf.hiddenEmoji")} ${t("perf.hiddenTitle")}`} items={hidden} onChange={updateActivity} onRemove={removeActivity} onAdd={() => addActivity("hidden")} />
              <ActivityList title={`${t("perf.visibleEmoji")} ${t("perf.visibleTitle")}`} items={visible} onChange={updateActivity} onRemove={removeActivity} onAdd={() => addActivity("visible")} />
            </Section>
          </>
        }
        preview={
          <PreviewAside caption={<span className="text-xs text-jh-mute">Real screen · sample day</span>}>
            <PhoneFrame active="performance" labels={{ compass: t("nav.compass"), performance: t("nav.performance"), tracker: t("nav.tracker"), coaching: t("nav.coaching") }}>
              <PerformanceScreen t={t} hidden={hidden} visible={visible} effortSplit={cfg.effortSplit}
                weeklyTargets={weeklyTargetsFrom(cfg)} userTargets={{}} logs={sampleLogs} />
            </PhoneFrame>
          </PreviewAside>
        }
      />
      <SaveBar onSave={save} busy={busy} dirty={dirty} notice={notice} label="Save Performance tab"
        audit={<AuditLine updatedAt={meta?.updatedAt} updatedBy={meta?.updatedBy} />} />
    </div>
  );
}

function ActivityList({ title, items, onChange, onRemove, onAdd }: {
  title: string; items: Activity[];
  onChange: (id: string, p: Partial<Activity>) => void; onRemove: (id: string) => void; onAdd: () => void;
}) {
  return (
    <div className="border border-jh-line rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-jh-line font-display font-semibold text-jh-ink text-sm bg-white">{title}</div>
      <div className="divide-y divide-jh-line bg-white">
        {items.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2 px-3 py-2.5">
            <input value={a.emoji} onChange={(e) => onChange(a.id, { emoji: e.target.value })}
              className="field py-2 text-center w-12 shrink-0" aria-label={`Activity ${i + 1} emoji`} />
            <input value={a.label} onChange={(e) => onChange(a.id, { label: e.target.value })}
              className="field py-2 flex-1 text-sm" placeholder="Activity label" aria-label={`Activity ${i + 1} label`} />
            <div className="shrink-0 w-24">
              <input type="number" min={0} value={a.defaultWeekly}
                onChange={(e) => onChange(a.id, { defaultWeekly: Math.max(0, +e.target.value) })}
                className="field py-2 text-sm" aria-label={`Activity ${i + 1} default weekly target`} title="Default weekly target" />
            </div>
            <button type="button" onClick={() => onRemove(a.id)} className="shrink-0 grid place-items-center h-9 w-9 rounded-[10px] text-jh-mute hover:text-jh-red hover:bg-jh-red-soft" aria-label={`Remove activity ${i + 1}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="px-4 py-6 text-center text-jh-mute text-sm">No activities yet.</div>}
      </div>
      <div className="px-3 py-3 border-t border-jh-line bg-white">
        <button type="button" onClick={onAdd} className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add activity
        </button>
      </div>
    </div>
  );
}
