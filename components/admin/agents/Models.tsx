"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { authed, postJson, Empty, Loading, NumberField, Section, Toggle, type Notice } from "@/components/admin/shared";
import { AGENT_KEYS, AGENT_LABELS, type AgentKey } from "@/lib/careerops/keys";
import { LIMITS, type AgentSettingsPatch } from "@/lib/careerops/config-validate";
import type { AgentsConfig, AgentsStatus } from "@/lib/careerops/types";
import WorkerBanner from "./WorkerBanner";

type Draft = Record<AgentKey, AgentSettingsPatch>;
const emptyDraft = () => Object.fromEntries(AGENT_KEYS.map((k) => [k, {}])) as Draft;

// Admin → Agents → Models. One row per agent: which Ollama model it runs on
// (from the list the Pi reports), its context / output caps and temperature.
// Global: the daily evaluation quota and the live-data training switch.
export default function Models({ status }: { status: AgentsStatus | null }) {
  const [cfg, setCfg] = useState<AgentsConfig | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [quota, setQuota] = useState<number | null>(null);

  async function load() {
    try { const d = await (await authed("/api/admin/agents/config")).json(); if (d.ok) { setCfg(d.config); setQuota(d.config.dailyEvalQuota); } }
    catch { setNotice({ kind: "err", text: "Couldn't load the agents config." }); }
  }
  useEffect(() => { load(); }, []);

  const models = status?.state?.models ?? [];
  const usedBy = useMemo(() => {
    const m = new Map<string, AgentKey[]>();
    if (cfg) for (const k of AGENT_KEYS) { const tag = draft[k].model ?? cfg.agents[k].model; m.set(tag, [...(m.get(tag) ?? []), k]); }
    return m;
  }, [cfg, draft]);

  const set = (k: AgentKey, patch: AgentSettingsPatch) => { setDraft((d) => ({ ...d, [k]: { ...d[k], ...patch } })); setNotice(null); };
  const dirty = (k: AgentKey) => Object.keys(draft[k]).length > 0;

  async function save(k: AgentKey) {
    setBusy(k); setNotice(null);
    try {
      const r = await postJson("/api/admin/agents/config", { agent: k, patch: draft[k] });
      const d = await r.json();
      if (r.ok && d.ok) { setCfg(d.config); setDraft((x) => ({ ...x, [k]: {} })); setNotice({ kind: "ok", text: `${AGENT_LABELS[k].label} saved — applies from the next job.` }); }
      else setNotice({ kind: "err", text: d.error ?? "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(null); }
  }
  async function saveGlobal(patch: { dailyEvalQuota?: number; collectLiveData?: boolean }) {
    setBusy("global"); setNotice(null);
    try {
      const r = await postJson("/api/admin/agents/config", { global: patch });
      const d = await r.json();
      if (r.ok && d.ok) { setCfg(d.config); setQuota(d.config.dailyEvalQuota); setNotice({ kind: "ok", text: "Settings saved." }); }
      else setNotice({ kind: "err", text: d.error ?? "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(null); }
  }

  if (!cfg) return <div className="space-y-6"><WorkerBanner status={status} error={null} /><Loading>Loading agents config…</Loading></div>;

  return (
    <div className="space-y-6">
      <WorkerBanner status={status} error={null} />
      {notice && <p role="status" className={`text-sm ${notice.kind === "ok" ? "text-rb-green-dark" : "text-jh-red"}`}>{notice.text}</p>}

      <Section title="Agents" help={<>Which model each agent runs on. The list comes from <code className="font-mono">ollama list</code> on the Pi{models.length === 0 ? " — the worker hasn't reported any yet, so tags must be typed" : ""}. Context is how much the model reads (prompt + CV + JD), output cap is how much it may write; both cost time on a Pi.</>}>
        <div className="space-y-4">
          {AGENT_KEYS.map((k) => {
            const a = { ...cfg.agents[k], ...draft[k] };
            const known = models.some((m) => m.name === a.model);
            return (
              <div key={k} className={`rounded-md border p-4 ${a.enabled ? "border-jh-line bg-white" : "border-jh-line bg-jh-mist/40"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-jh-ink">{AGENT_LABELS[k].label} <span className="text-xs font-normal text-jh-mute-2 font-mono ml-1">{AGENT_LABELS[k].mode}</span></p>
                    <p className="text-xs text-jh-mute mt-0.5">{AGENT_LABELS[k].help}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-jh-mute"><Toggle on={a.enabled} onChange={(v) => set(k, { enabled: v })} label={`${AGENT_LABELS[k].label} enabled`} /> {a.enabled ? "On" : "Off"}</label>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3 items-end">
                  <label className="block lg:col-span-2">
                    <span className="label">Model</span>
                    {models.length > 0 ? (
                      <select className="field" value={a.model} onChange={(e) => set(k, { model: e.target.value })} aria-label={`${AGENT_LABELS[k].label} model`}>
                        {!known && <option value={a.model}>{a.model} (not on the Pi)</option>}
                        {models.map((m) => <option key={m.name} value={m.name}>{m.name} · {m.sizeGb} GB{m.params ? ` · ${m.params}` : ""}</option>)}
                      </select>
                    ) : <input className="field font-mono" value={a.model} onChange={(e) => set(k, { model: e.target.value })} aria-label={`${AGENT_LABELS[k].label} model`} />}
                    {!known && models.length > 0 && <span className="flex items-center gap-1 text-xs text-jh-red mt-1"><AlertTriangle className="h-3 w-3" /> not installed on the Pi — jobs will fail until it is pulled</span>}
                  </label>
                  <NumberField label="Context (tokens)" min={LIMITS.numCtx.min} max={LIMITS.numCtx.max} value={a.numCtx} onChange={(v) => set(k, { numCtx: v })} />
                  <NumberField label="Output cap (tokens)" min={LIMITS.numPredict.min} max={LIMITS.numPredict.max} value={a.numPredict} onChange={(v) => set(k, { numPredict: v })} />
                  <label className="block">
                    <span className="label">Temperature</span>
                    <input className="field" type="number" step="0.05" min={LIMITS.temperature.min} max={LIMITS.temperature.max} value={a.temperature} onChange={(e) => set(k, { temperature: Number(e.target.value) })} aria-label={`${AGENT_LABELS[k].label} temperature`} />
                  </label>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button type="button" onClick={() => save(k)} disabled={busy === k || !dirty(k)} className="btn-primary text-xs px-3 py-2 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {busy === k ? "Saving…" : "Save"}</button>
                  {dirty(k) && <button type="button" onClick={() => setDraft((d) => ({ ...d, [k]: {} }))} className="btn-ghost text-xs">Discard</button>}
                  <span className="text-xs text-jh-mute-2">prompt v{cfg.agents[k].promptVersion}{cfg.agents[k].promptEditedBy ? ` · edited by ${cfg.agents[k].promptEditedBy}` : " · worker default"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Models on the Pi" help="Everything Ollama has pulled. Importing a fine-tuned GGUF arrives with the Training tab (phase 4).">
        {models.length === 0 ? <Empty>{status?.online ? "Waiting for the worker to report its models…" : "The worker is offline — models are listed when it comes back."}</Empty> : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-jh-mute border-b border-jh-line">{["Tag", "Size", "Family", "Params", "Used by", "Modified"].map((h) => <th key={h} className="font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.name} className="border-b border-jh-line last:border-0">
                    <td className="px-3 py-2 font-mono text-jh-ink">{m.name}</td>
                    <td className="px-3 py-2 text-jh-mute tabular-nums">{m.sizeGb} GB</td>
                    <td className="px-3 py-2 text-jh-mute">{m.family ?? "—"}</td>
                    <td className="px-3 py-2 text-jh-mute">{m.params ?? "—"}</td>
                    <td className="px-3 py-2 text-jh-mute">{(usedBy.get(m.name) ?? []).map((k) => AGENT_LABELS[k].label).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-jh-mute whitespace-nowrap">{m.modifiedAt ? new Date(m.modifiedAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Limits & training data" help="The quota protects the Pi: one evaluation takes several minutes. Live-data collection is off by default — when on, reports the admin approves may be copied (pseudonymised) into training datasets in phase 4.">
        <div className="flex flex-wrap items-end gap-4">
          <NumberField id="agents-quota" label="Evaluations per member per day" min={LIMITS.dailyEvalQuota.min} max={LIMITS.dailyEvalQuota.max} value={quota ?? cfg.dailyEvalQuota} onChange={setQuota} className="w-56" />
          <button type="button" onClick={() => quota != null && saveGlobal({ dailyEvalQuota: quota })} disabled={busy === "global" || quota === cfg.dailyEvalQuota} className="btn-secondary text-xs px-3 py-2 h-[46px] disabled:opacity-50">Save quota</button>
          <label className="flex items-center gap-2 text-sm text-jh-mute h-[46px]">
            <Toggle on={cfg.collectLiveData} onChange={(v) => saveGlobal({ collectLiveData: v })} label="Collect training data from live users" /> Collect training data from live users
          </label>
        </div>
      </Section>
    </div>
  );
}
