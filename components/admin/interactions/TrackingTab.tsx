"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { PIRATE_STAGES, type EventStage } from "@/lib/tags";
import { authed, postJson, Loading, SaveBar, Section, Toggle, type Notice } from "@/components/admin/shared";

type EventSetting = { enabled: boolean; tag: string; stage: EventStage; label: string };

// Event tracking — the MO layer of Pirate metrics. Every interaction the app
// fires, the tag it writes to Supabase, whether it's written at all, and the
// AAARRR stage it rolls up into on Analytics → Pirate metrics.
export default function TrackingTab() {
  const [cfg, setCfg] = useState<Record<string, EventSetting> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    authed("/api/admin/events").then((r) => r.json()).then((d) => (d.ok ? setCfg(d.config) : setLoadError(true))).catch(() => setLoadError(true));
  }, []);
  const update = (key: string, p: Partial<EventSetting>) => { setCfg((c) => ({ ...c!, [key]: { ...c![key], ...p } })); setDirty(true); setNotice(null); };

  async function save() {
    setBusy(true); setNotice(null);
    try {
      const d = await (await postJson("/api/admin/events", { events: cfg })).json();
      if (d.ok) { setCfg(d.config); setDirty(false); setNotice({ kind: "ok", text: "Saved — new events use these settings within 30s." }); }
      else setNotice({ kind: "err", text: "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(false); }
  }

  if (loadError) return <p className="text-jh-red">Couldn&apos;t load event settings.</p>;
  if (!cfg) return <Loading>Loading event settings…</Loading>;

  return (
    <div className="space-y-6">
      <Section title="Which event counts where" help={<>Every event the app fires, the tag it writes to Supabase and the AAARRR stage it rolls up into. Disabled events are not written at all. Example: <em>Quiz completed</em> → Acquisition; <em>Registration</em> → Activation. Disabled events are not written at all.</>}>
        <div className="space-y-6">
          {PIRATE_STAGES.map((s) => {
            const rows = Object.entries(cfg).filter(([, e]) => e.stage === s.key);
            return (
              <div key={s.key}>
                <div className="flex items-baseline gap-2 mb-2">
                  <h4 className="font-display font-semibold text-jh-ink">{s.label}</h4>
                  <span className="text-xs text-jh-mute">{s.help}</span>
                  <span className="ml-auto pill bg-jh-mist text-jh-mute">{s.source}</span>
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-jh-mute border border-dashed border-jh-line rounded-md px-3 py-3">No events in this stage yet — move one here with its stage dropdown{s.key === "awareness" ? ", or connect Google Analytics" : ""}.</p>
                ) : (
                  <div className="border border-jh-line rounded-md divide-y divide-jh-line overflow-hidden">
                    {rows.map(([key, e]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-white">
                        <div className="sm:w-48 shrink-0">
                          <p className="font-display font-semibold text-jh-ink text-sm">{e.label}</p>
                          <p className="text-[11px] text-jh-mute-2 font-mono">{key}</p>
                        </div>
                        <input aria-label={`${e.label} tag`} value={e.tag} onChange={(ev) => update(key, { tag: ev.target.value })} className="field py-2 text-xs font-mono flex-1" />
                        <select aria-label={`${e.label} stage`} value={e.stage} onChange={(ev) => update(key, { stage: ev.target.value as EventStage })} className="field py-2 w-auto text-sm">
                          {PIRATE_STAGES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                        </select>
                        <Toggle on={e.enabled} onChange={(v) => update(key, { enabled: v })} label={`${e.label} enabled`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
      <SaveBar onSave={save} busy={busy} dirty={dirty} notice={notice} label="Save event settings"
        audit={<span className="inline-flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" aria-hidden /> Stored at <code className="font-mono">config/events</code> · read by /api/track · rolled up on <a href="#analytics/pirate" className="text-jh-red underline underline-offset-2">Analytics → Pirate metrics</a></span>} />
    </div>
  );
}
