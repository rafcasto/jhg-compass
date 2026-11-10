"use client";

import { useEffect, useState } from "react";
import { Check, Save, Send } from "lucide-react";
import { authed, postJson, Loading, NumberField, Section, Toggle, type Notice } from "@/components/admin/shared";
import { EFFORTS, ENGINE_AGENTS, ENGINE_AGENT_LABELS, ENGINE_MODELS, isTerminal, type EngineAgent } from "@/lib/engine/keys";
import { LIMITS, type EngineAgentPatch, type EngineConfig } from "@/lib/engine/config";
import type { ModelPrice } from "@/lib/engine/pricing";
import type { EngineJobView } from "@/lib/engine/jobs";

type Draft = Partial<Record<EngineAgent, EngineAgentPatch>>;

// Admin → Claude → Settings: model + effort + max tokens per agent, the two monthly
// limits (0 = none), the price table, and a test job that proves queue → run → Firestore.
export default function Settings() {
  const [cfg, setCfg] = useState<EngineConfig | null>(null);
  const [env, setEnv] = useState<{ claude: boolean; queue: boolean } | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [limits, setLimits] = useState<{ monthlyBudgetUsd: number; monthlyTurnQuota: number; searchUsd: number } | null>(null);
  const [prices, setPrices] = useState<Record<string, ModelPrice> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [ping, setPing] = useState<{ text: string; done: boolean } | null>(null);

  async function load() {
    try {
      const d = await (await authed("/api/admin/engine/config")).json();
      if (!d.ok) { setNotice({ kind: "err", text: d.error ?? "Couldn't load the engine config." }); return; }
      setCfg(d.config); setEnv({ claude: d.claude, queue: d.queue });
      setLimits({ monthlyBudgetUsd: d.config.monthlyBudgetUsd, monthlyTurnQuota: d.config.monthlyTurnQuota, searchUsd: d.config.searchUsd });
      setPrices(d.config.prices); setDraft({});
    } catch { setNotice({ kind: "err", text: "Couldn't load the engine config." }); }
  }
  useEffect(() => { load(); }, []);

  async function post(body: unknown, key: string, okText: string) {
    setBusy(key); setNotice(null);
    try {
      const d = await (await postJson("/api/admin/engine/config", body)).json();
      if (d.ok) { setCfg(d.config); setDraft((x) => { const n = { ...x }; delete n[key as EngineAgent]; return n; }); setNotice({ kind: "ok", text: okText }); }
      else setNotice({ kind: "err", text: d.error ?? "Couldn't save." });
    } catch { setNotice({ kind: "err", text: "Couldn't save." }); }
    finally { setBusy(null); }
  }
  const setAgent = (k: EngineAgent, patch: EngineAgentPatch) => { setDraft((d) => ({ ...d, [k]: { ...(d[k] ?? {}), ...patch } })); setNotice(null); };
  const val = <K extends keyof EngineAgentPatch>(k: EngineAgent, f: K) => (draft[k]?.[f] ?? cfg!.agents[k][f]) as NonNullable<EngineAgentPatch[K]>;

  // The smoke test: a ping job for this admin, polled until it lands.
  async function sendPing() {
    setPing({ text: "Sending…", done: false });
    try {
      const d = await (await postJson("/api/engine/jobs", { type: "ping" })).json();
      if (!d.ok) { setPing({ text: d.error ?? "Couldn't create the job.", done: true }); return; }
      const job: EngineJobView = d.job;
      if (d.inline) { setPing({ text: `Ran inline (no queue configured) · ${job.id}`, done: true }); return; }
      setPing({ text: `Queued · ${job.id} — waiting for QStash…`, done: false });
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await (await authed(`/api/engine/jobs/${job.id}`)).json();
        if (s.ok && isTerminal(s.job.status)) { setPing({ text: `${s.job.status} · ${s.job.progress ?? ""} · ${job.id}`, done: true }); return; }
      }
      setPing({ text: `Still queued after 20 s · ${job.id} — check the QStash console and APP_URL`, done: true });
    } catch { setPing({ text: "Couldn't send the test job.", done: true }); }
  }

  if (!cfg || !limits || !prices) return <Loading />;

  return (
    <div className="space-y-6">
      <Section title="Connection" help="Both secrets live in Vercel's environment, server only. The queue calls this deployment back at APP_URL/api/engine/run.">
        <ul className="text-sm space-y-1">
          <li className="flex items-center gap-2"><Dot on={env?.claude ?? false} /> Anthropic API key {env?.claude ? "present" : "missing — set ANTHROPIC_API_KEY"}</li>
          <li className="flex items-center gap-2"><Dot on={env?.queue ?? false} /> QStash {env?.queue ? "configured" : "not configured — jobs run inline (local dev only)"}</li>
        </ul>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="button" onClick={sendPing} disabled={ping ? !ping.done : false} className="btn-secondary text-xs px-3 py-2 disabled:opacity-60"><Send className="h-4 w-4" /> Send a test job</button>
          {ping && <span role="status" className="text-sm text-jh-mute">{ping.text}</span>}
        </div>
      </Section>

      <Section title="Agents" help="The model and effort each agent runs with. Opus 5.5 is the default everywhere; Sonnet 5.5 is a per-agent choice after reading the meter.">
        <div className="divide-y divide-jh-line">
          {ENGINE_AGENTS.map((k) => {
            const dirty = !!draft[k] && Object.keys(draft[k]!).length > 0;
            return (
              <div key={k} className="py-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-3">
                  <div>
                    <p className="font-display font-semibold text-jh-ink">{ENGINE_AGENT_LABELS[k].label}</p>
                    <p className="text-xs text-jh-mute">{ENGINE_AGENT_LABELS[k].help}</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="block">
                      <span className="label mb-0">Model</span>
                      <select className="field mt-1.5 text-sm" value={val(k, "model")} onChange={(e) => setAgent(k, { model: e.target.value })} aria-label={`${ENGINE_AGENT_LABELS[k].label} model`}>
                        {ENGINE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="label mb-0">Effort</span>
                      <select className="field mt-1.5 text-sm" value={val(k, "effort")} onChange={(e) => setAgent(k, { effort: e.target.value as EngineAgentPatch["effort"] })} aria-label={`${ENGINE_AGENT_LABELS[k].label} effort`}>
                        {EFFORTS.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </label>
                    <NumberField id={`max-${k}`} label="Max tokens" min={LIMITS.maxTokens.min} max={LIMITS.maxTokens.max} value={val(k, "maxTokens")} onChange={(n) => setAgent(k, { maxTokens: n })} className="w-32" />
                    <label className="flex items-center gap-2 pb-2.5 text-sm text-jh-mute"><Toggle on={val(k, "enabled")} onChange={(on) => setAgent(k, { enabled: on })} label={`${ENGINE_AGENT_LABELS[k].label} enabled`} /> Enabled</label>
                  </div>
                </div>
                <button type="button" disabled={!dirty || busy === k} onClick={() => post({ agent: k, patch: draft[k] }, k, `${ENGINE_AGENT_LABELS[k].label} saved.`)} className="btn-primary text-xs px-3 py-2 disabled:opacity-40">
                  {busy === k ? "Saving…" : <><Save className="h-4 w-4" /> Save</>}
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Monthly limits" help="Per member, per calendar month. 0 means no limit — the decision was to measure first. When a limit is reached the member sees one mute line in the coach; admins are never limited.">
        <div className="flex flex-wrap items-end gap-3">
          <NumberField id="budget" label="Budget (USD)" min={0} max={LIMITS.monthlyBudgetUsd.max} value={limits.monthlyBudgetUsd} onChange={(n) => setLimits({ ...limits, monthlyBudgetUsd: n })} className="w-36" help="0 = none" />
          <NumberField id="turns" label="Calls" min={0} max={LIMITS.monthlyTurnQuota.max} value={limits.monthlyTurnQuota} onChange={(n) => setLimits({ ...limits, monthlyTurnQuota: n })} className="w-36" help="0 = none" />
          <button type="button" disabled={busy === "limits"} onClick={() => post({ limits: { monthlyBudgetUsd: limits.monthlyBudgetUsd, monthlyTurnQuota: limits.monthlyTurnQuota } }, "limits", "Limits saved.")} className="btn-primary text-xs px-3 py-2 h-[42px] disabled:opacity-60">
            {busy === "limits" ? "Saving…" : <><Save className="h-4 w-4" /> Save limits</>}
          </button>
        </div>
      </Section>

      <Section title="Price table" help="USD per million tokens, by model — what the estimates are computed from. Correct it when Anthropic's list changes. Cache writes are billed at a premium over input; web searches per call.">
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="text-sm">
            <thead><tr className="text-left text-jh-mute border-b border-jh-line">{["Model", "Input", "Output", "Cache read", "Cache write"].map((h) => <th key={h} className="font-semibold px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {ENGINE_MODELS.map((m) => (
                <tr key={m.id} className="border-b border-jh-line last:border-0">
                  <td className="px-3 py-2 font-semibold text-jh-ink whitespace-nowrap">{m.label}</td>
                  {(["input", "output", "cacheRead", "cacheWrite"] as const).map((f) => (
                    <td key={f} className="px-3 py-2">
                      <input type="number" step="0.01" min={0} aria-label={`${m.label} ${f}`} className="field text-sm w-24" value={prices[m.id]?.[f] ?? 0}
                        onChange={(e) => setPrices({ ...prices, [m.id]: { ...(prices[m.id] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }), [f]: Number(e.target.value) } })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label mb-0">Web search (USD each)</span>
            <input type="number" step="0.001" min={0} max={1} className="field mt-1.5 text-sm w-32" value={limits.searchUsd} onChange={(e) => setLimits({ ...limits, searchUsd: Number(e.target.value) })} aria-label="Web search USD" />
          </label>
          <button type="button" disabled={busy === "prices"} onClick={() => post({ limits: { prices, searchUsd: limits.searchUsd } }, "prices", "Price table saved.")} className="btn-primary text-xs px-3 py-2 h-[42px] disabled:opacity-60">
            {busy === "prices" ? "Saving…" : <><Save className="h-4 w-4" /> Save prices</>}
          </button>
        </div>
      </Section>

      {notice && <p role="status" className={`text-sm ${notice.kind === "ok" ? "text-rb-green-dark" : "text-jh-red"}`}>{notice.kind === "ok" && <Check className="inline h-4 w-4 mr-1" />}{notice.text}</p>}
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${on ? "bg-rb-green-dark" : "bg-jh-line-2"}`} aria-hidden />;
}
