"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, Save } from "lucide-react";
import { authed, postJson, fmtDateTime, Empty, Loading, Section, type Notice } from "@/components/admin/shared";
import { AGENT_KEYS, AGENT_LABELS, type AgentKey } from "@/lib/careerops/keys";
import { estimateTokens, LIMITS } from "@/lib/careerops/config-validate";
import type { AgentConfig, AgentsStatus, PromptVersion } from "@/lib/careerops/types";
import WorkerBanner from "./WorkerBanner";

interface Loaded { current: AgentConfig; versions: PromptVersion[]; defaultPrompt: string | null }

// Admin → Agents → Prompts. The system prompt is what makes an agent an agent:
// every save is a new version (restorable), and an admin edit stops the worker
// from silently replacing it with a newer built-in default.
export default function Prompts({ status }: { status: AgentsStatus | null }) {
  const [agent, setAgent] = useState<AgentKey>("evaluator");
  const [data, setData] = useState<Loaded | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [viewing, setViewing] = useState<PromptVersion | null>(null);

  async function load(k: AgentKey) {
    setData(null); setViewing(null); setNotice(null);
    try {
      const d = await (await authed(`/api/admin/agents/prompts?agent=${k}`)).json();
      if (d.ok) { setData(d); setText(d.current.systemPrompt ?? ""); }
      else setNotice({ kind: "err", text: d.error ?? "Couldn't load the prompt." });
    } catch { setNotice({ kind: "err", text: "Couldn't load the prompt." }); }
  }
  useEffect(() => { load(agent); }, [agent]);

  const dirty = !!data && text.trim() !== (data.current.systemPrompt ?? "").trim();

  async function save(systemPrompt: string, n: string) {
    setBusy(true); setNotice(null);
    try {
      const r = await postJson("/api/admin/agents/prompts", { agent, systemPrompt, note: n });
      const d = await r.json();
      if (r.ok && d.ok) { setData((x) => x ? { ...x, current: d.current, versions: d.versions } : x); setText(d.current.systemPrompt); setNote(""); setViewing(null); setNotice({ kind: "ok", text: `Saved as v${d.version} — the worker uses it from the next job.` }); }
      else setNotice({ kind: "err", text: d.error ?? "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <WorkerBanner status={status} error={null} />
      <div role="tablist" aria-label="Agent" className="inline-flex flex-wrap gap-1 rounded-pill bg-jh-mist p-1">
        {AGENT_KEYS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={agent === k} onClick={() => setAgent(k)}
            className={`px-4 py-2 rounded-pill text-sm font-display font-semibold transition-colors ${agent === k ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute hover:text-jh-ink"}`}>{AGENT_LABELS[k].label}</button>
        ))}
      </div>
      {notice && <p role="status" className={`text-sm ${notice.kind === "ok" ? "text-rb-green-dark" : "text-jh-red"}`}>{notice.text}</p>}

      {!data ? <Loading>Loading prompt…</Loading> : (
        <>
          <Section title={`${AGENT_LABELS[agent].label} — system prompt`}
            help={<>Distilled from career-ops <code className="font-mono">{AGENT_LABELS[agent].mode}</code>. Keep it tight: on the Pi every 1,000 prompt tokens is ~20–50 s before the model writes a word. Currently v{data.current.promptVersion}{data.current.promptEditedBy ? <> · edited by {data.current.promptEditedBy} {data.current.promptEditedAt ? fmtDateTime(data.current.promptEditedAt) : ""}</> : " · worker default (auto-upgrades until you edit it)"}.</>}
            aside={data.defaultPrompt && data.defaultPrompt.trim() !== text.trim() ? (
              <button type="button" onClick={() => { setText(data.defaultPrompt!); setNotice(null); }} className="btn-secondary text-xs px-3 py-2"><RotateCcw className="h-4 w-4" /> Load worker default</button>
            ) : undefined}>
            {!data.current.systemPrompt && !text && <p className="text-sm text-jh-mute">This agent has no prompt yet — it isn&apos;t wired up until a later phase. You can still draft one.</p>}
            <textarea aria-label={`${AGENT_LABELS[agent].label} system prompt`} className="field font-mono text-xs min-h-[28rem]" value={text} onChange={(e) => { setText(e.target.value); setNotice(null); }} maxLength={LIMITS.promptMax} />
            <div className="flex flex-wrap items-center gap-3">
              <input className="field text-sm flex-1 min-w-48" placeholder="What changed? (optional note for the version history)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
              <span className="text-xs text-jh-mute-2 tabular-nums">{text.length.toLocaleString()} chars · ≈{estimateTokens(text).toLocaleString()} tokens</span>
              <button type="button" onClick={() => save(text, note)} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? "Saving…" : `Save as v${data.current.promptVersion + 1}`}</button>
              {dirty && <button type="button" onClick={() => setText(data.current.systemPrompt ?? "")} className="btn-ghost text-xs">Discard</button>}
            </div>
          </Section>

          <Section title="Versions" help="Every save is kept. Restore writes the old text as a new version, so nothing is ever lost.">
            {data.versions.length === 0 ? <Empty>No saved versions yet — the current prompt is the worker default.</Empty> : (
              <ul className="divide-y divide-jh-line">
                {data.versions.map((v) => (
                  <li key={v.id} className="py-2.5 flex items-center gap-3 text-sm">
                    <History className="h-4 w-4 text-jh-mute-2 shrink-0" />
                    <span className="font-mono text-jh-ink">v{v.version}</span>
                    <span className="flex-1 min-w-0 text-jh-mute truncate">{v.note || "—"} · {v.savedBy ?? "—"} · {fmtDateTime(v.savedAt)}</span>
                    <button type="button" onClick={() => setViewing(viewing?.id === v.id ? null : v)} className="btn-ghost text-xs">{viewing?.id === v.id ? "Hide" : "View"}</button>
                    {v.version !== data.current.promptVersion && <button type="button" onClick={() => { if (confirm(`Restore v${v.version} as v${data.current.promptVersion + 1}?`)) save(v.systemPrompt, `restored v${v.version}`); }} disabled={busy} className="btn-secondary text-xs px-3 py-1.5">Restore</button>}
                  </li>
                ))}
              </ul>
            )}
            {viewing && <pre className="mt-3 text-xs bg-jh-mist rounded-md p-3 overflow-auto max-h-80 whitespace-pre-wrap">{viewing.systemPrompt}</pre>}
          </Section>
        </>
      )}
    </div>
  );
}
