"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Database, Cpu, FlaskConical, Upload, Check, X, Eye, Trash2, Star } from "lucide-react";
import { authed, postJson, fmtDateTime, Empty, Loading, NumberField, Section, type Notice } from "@/components/admin/shared";
import { FINETUNE_BASES, type AgentsStatus, type TrainingDataset, type TrainingExample, type TrainingExampleRow, type TrainingModel } from "@/lib/careerops/types";
import WorkerBanner from "./WorkerBanner";

interface Data { examples: TrainingExampleRow[]; datasets: TrainingDataset[]; models: TrainingModel[] }

// Admin → Agents → Training. Teacher–student: Claude writes gold evaluations for
// synthetic cases (plus approved live reports when switched on) → dataset →
// LoRA on the GPU box → exam against the held-out cases → promote.
export default function Training({ status }: { status: AgentsStatus | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<TrainingExample | null>(null);
  const [filter, setFilter] = useState<"all" | "claude" | "live" | "exam" | "unapproved">("all");

  // forms
  const [gold, setGold] = useState({ count: 5, roles: "Product Owner, Product Manager", market: "New Zealand", cvSource: "synthetic" as "synthetic" | "setup" });
  const [ds, setDs] = useState({ name: `evaluator-${new Date().toISOString().slice(0, 10)}`, claude: true, live: false });
  const [ft, setFt] = useState({ dataset: "", base: FINETUNE_BASES[1] as string, tag: `careerops-evaluator:v1`, epochs: 2 });
  const [examTag, setExamTag] = useState("");
  const [examLimit, setExamLimit] = useState(6);
  const [imp, setImp] = useState({ tag: "", driveFileId: "" });

  const load = useCallback(async () => {
    try { const d = await (await authed("/api/admin/agents/training")).json(); if (d.ok) setData(d); else setNotice({ kind: "err", text: d.error ?? "Couldn't load training data." }); }
    catch { setNotice({ kind: "err", text: "Couldn't load training data." }); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (data?.datasets.length && !ft.dataset) setFt((f) => ({ ...f, dataset: data.datasets[0].name })); }, [data, ft.dataset]);

  const st = status?.state;
  const online = !!status?.online;
  const claudeOk = !!st?.claude?.configured;
  const gpuOk = !!st?.gpu?.reachable;
  const models = useMemo(() => st?.models ?? [], [st?.models]);
  useEffect(() => { if (models.length && !examTag) setExamTag(models[0].name); }, [models, examTag]);

  async function queue(type: string, payload: Record<string, unknown>, label: string) {
    setBusy(type); setNotice(null);
    try {
      const r = await postJson("/api/admin/agents/jobs", { type, payload });
      const d = await r.json();
      if (r.ok && d.ok) setNotice({ kind: "ok", text: `${label} queued as ${d.job.id} — follow it on the Overview tab.` });
      else setNotice({ kind: "err", text: d.error ?? "Couldn't queue the job." });
    } catch { setNotice({ kind: "err", text: "Couldn't queue the job." }); }
    finally { setBusy(null); }
  }
  async function setApproved(id: string, approved: boolean) {
    await postJson(`/api/admin/agents/training/examples/${id}`, { approved }); await load();
    if (view?.id === id) setView({ ...view, approved });
  }
  async function remove(id: string) { if (!confirm("Delete this example?")) return; await authed(`/api/admin/agents/training/examples/${id}`, { method: "DELETE" }); setView(null); await load(); }
  async function open(id: string) { const d = await (await authed(`/api/admin/agents/training/examples/${id}`)).json(); if (d.ok) setView(d.example); }
  async function promote(tag: string) {
    if (!confirm(`Make ${tag} the Evaluator's production model?`)) return;
    const r = await postJson("/api/admin/agents/config", { agent: "evaluator", patch: { model: tag } });
    setNotice(r.ok ? { kind: "ok", text: `Evaluator now runs on ${tag}.` } : { kind: "err", text: "Couldn't promote." });
  }

  const rows = useMemo(() => (data?.examples ?? []).filter((e) => filter === "all" || (filter === "exam" ? e.split === "exam" : filter === "unapproved" ? !e.approved : e.source === filter)), [data, filter]);
  const counts = useMemo(() => { const c = { total: 0, approved: 0, exam: 0, claude: 0, live: 0 }; for (const e of data?.examples ?? []) { c.total++; if (e.approved) c.approved++; if (e.split === "exam") c.exam++; if (e.source === "claude") c.claude++; if (e.source === "live") c.live++; } return c; }, [data]);

  return (
    <div className="space-y-6">
      <WorkerBanner status={status} error={null} />
      {notice && <p role="status" className={`text-sm ${notice.kind === "ok" ? "text-rb-green-dark" : "text-jh-red"}`}>{notice.text}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["Examples", `${counts.approved}/${counts.total}`, "approved / total"], ["Held-out exam", counts.exam, "15% of gold"], ["Claude teacher", claudeOk ? "Ready" : "No key", st?.claude?.model ?? "ANTHROPIC_API_KEY on the Pi"], ["GPU box", gpuOk ? "Reachable" : "Off", st?.gpu?.host ?? "ssh gpu"]].map(([l, v, h]) => (
          <div key={String(l)} className="card p-5"><div className="font-display font-extrabold text-2xl text-jh-ink tabular-nums">{v}</div><div className="text-sm text-jh-mute mt-1">{l}</div><div className="text-[11px] text-jh-mute-2 mt-0.5">{h}</div></div>
        ))}
      </div>

      <Section title="1 · Generate gold with Claude" help={<>Claude ({st?.claude?.model ?? "claude-fable-5-1"}) invents a candidate and a posting per case, then evaluates it with the full career-ops rubric in the exact format the Pi model must learn. Every case is stored approved; 15% are held out for the exam. Roughly 25k tokens per case.</>}>
        {!claudeOk && <p className="text-sm text-jh-red mb-3">Add <code className="font-mono">ANTHROPIC_API_KEY</code> to the worker&apos;s <code className="font-mono">.env</code> on the Pi and restart it.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <NumberField label="Cases" min={1} max={20} value={gold.count} onChange={(v) => setGold({ ...gold, count: v })} />
          <label className="block lg:col-span-2"><span className="label">Role families (comma-separated)</span><input className="field" value={gold.roles} onChange={(e) => setGold({ ...gold, roles: e.target.value })} /></label>
          <label className="block"><span className="label">Market</span><input className="field" value={gold.market} onChange={(e) => setGold({ ...gold, market: e.target.value })} /></label>
          <label className="block"><span className="label">Candidate</span>
            <select className="field" value={gold.cvSource} onChange={(e) => setGold({ ...gold, cvSource: e.target.value as "synthetic" | "setup" })}><option value="synthetic">Synthetic (varied)</option><option value="setup">My own CV (Setup)</option></select></label>
        </div>
        <button type="button" disabled={!online || !claudeOk || busy === "generate_gold"} onClick={() => queue("generate_gold", { agent: "evaluator", count: gold.count, roles: gold.roles.split(",").map((s) => s.trim()).filter(Boolean), market: gold.market, cvSource: gold.cvSource }, "Gold generation")} className="btn-primary text-sm mt-3 disabled:opacity-50"><Sparkles className="h-4 w-4" /> Generate {gold.count} case{gold.count === 1 ? "" : "s"}</button>
      </Section>

      <Section title="2 · Examples" help="Everything that can go into a dataset. Claude gold is approved on arrival; live-member reports (👍 in the app, when collection is on) arrive unapproved and pseudonymised — review before approving.">
        <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-pill bg-jh-mist p-1 mb-3">
          {(["all", "claude", "live", "exam", "unapproved"] as const).map((f) => <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-pill text-sm font-display font-semibold capitalize ${filter === f ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute"}`}>{f}</button>)}
        </div>
        {!data ? <Loading>Loading examples…</Loading> : rows.length === 0 ? <Empty>No examples yet — generate gold above.</Empty> : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-jh-mute border-b border-jh-line">{["Case", "Source", "Split", "Fit → score", "Archetype", "Approved", ""].map((h) => <th key={h} className="font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 200).map((e) => (
                  <tr key={e.id} className="border-b border-jh-line last:border-0">
                    <td className="px-3 py-2"><p className="font-semibold text-jh-ink">{e.company} — {e.role}</p><p className="text-xs text-jh-mute">{fmtDateTime(e.createdAt)}{e.notes ? ` · ${e.notes}` : ""}</p></td>
                    <td className="px-3 py-2 text-jh-mute">{e.source}</td>
                    <td className="px-3 py-2">{e.split === "exam" ? <span className="pill bg-rb-yellow/30 text-jh-ink">exam</span> : <span className="text-jh-mute">train</span>}</td>
                    <td className="px-3 py-2 text-jh-mute tabular-nums">{e.intendedFit ?? "—"} → {e.summary?.score ?? "?"}</td>
                    <td className="px-3 py-2 text-jh-mute">{e.summary?.archetype ?? "—"}</td>
                    <td className="px-3 py-2"><button type="button" onClick={() => setApproved(e.id, !e.approved)} className={`pill ${e.approved ? "bg-rb-green-light/30 text-rb-green-dark" : "bg-jh-mist text-jh-mute"}`}>{e.approved ? "yes" : "no"}</button></td>
                    <td className="px-3 py-2 whitespace-nowrap"><button type="button" onClick={() => open(e.id)} className="btn-ghost p-1.5" aria-label="View"><Eye className="h-4 w-4" /></button><button type="button" onClick={() => remove(e.id)} className="btn-ghost p-1.5 text-jh-red" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {view && (
          <div className="mt-4 rounded-md border border-jh-line p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap"><p className="font-semibold text-jh-ink">{view.company} — {view.role}</p><span className="text-xs text-jh-mute">{view.source} · {view.split} · teacher {view.teacherModel ?? "—"}</span><span className="flex-1" />
              <button type="button" onClick={() => setApproved(view.id, !view.approved)} className="btn-secondary text-xs px-3 py-1.5">{view.approved ? <><X className="h-3.5 w-3.5" /> Unapprove</> : <><Check className="h-3.5 w-3.5" /> Approve</>}</button>
              <button type="button" onClick={() => setView(null)} className="btn-ghost text-xs">Close</button></div>
            <div className="grid lg:grid-cols-2 gap-3">
              <details open><summary className="text-sm font-semibold cursor-pointer">Job description</summary><pre className="mt-2 text-xs bg-jh-mist rounded-md p-3 overflow-auto max-h-72 whitespace-pre-wrap">{view.jd}</pre></details>
              <details><summary className="text-sm font-semibold cursor-pointer">CV</summary><pre className="mt-2 text-xs bg-jh-mist rounded-md p-3 overflow-auto max-h-72 whitespace-pre-wrap">{view.cv}</pre></details>
            </div>
            <details open><summary className="text-sm font-semibold cursor-pointer">Gold report ({view.summary?.score}/5 · {view.summary?.archetype} · {view.summary?.legitimacy})</summary><pre className="mt-2 text-xs bg-jh-mist rounded-md p-3 overflow-auto max-h-96 whitespace-pre-wrap">{view.report}</pre></details>
          </div>
        )}
      </Section>

      <Section title="3 · Datasets" help="Approved examples → train.jsonl (chat format: current Evaluator prompt + case → gold report) and exam.jsonl on the Pi.">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <label className="block sm:col-span-2"><span className="label">Name</span><input className="field font-mono" value={ds.name} onChange={(e) => setDs({ ...ds, name: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm h-[46px]"><input type="checkbox" className="accent-jh-red" checked={ds.claude} onChange={(e) => setDs({ ...ds, claude: e.target.checked })} /> Claude gold ({counts.claude})</label>
          <label className="flex items-center gap-2 text-sm h-[46px]"><input type="checkbox" className="accent-jh-red" checked={ds.live} onChange={(e) => setDs({ ...ds, live: e.target.checked })} /> Live, approved ({counts.live})</label>
        </div>
        <button type="button" disabled={!online || busy === "build_dataset" || !ds.name.trim() || (!ds.claude && !ds.live)} onClick={() => queue("build_dataset", { agent: "evaluator", name: ds.name.trim(), sources: [...(ds.claude ? ["claude"] : []), ...(ds.live ? ["live"] : [])] }, "Dataset build")} className="btn-secondary text-sm mt-3 disabled:opacity-50"><Database className="h-4 w-4" /> Build dataset</button>
        {data && data.datasets.length > 0 && (
          <ul className="mt-4 divide-y divide-jh-line text-sm">{data.datasets.map((d) => <li key={d.name} className="py-2 flex items-center gap-3"><span className="font-mono text-jh-ink">{d.name}</span><span className="text-jh-mute">{d.train} train · {d.exam} exam · {Object.entries(d.bySource ?? {}).map(([k, v]) => `${k} ${v}`).join(", ")} · prompt v{d.promptVersion}</span><span className="flex-1" /><span className="text-xs text-jh-mute-2">{fmtDateTime(d.builtAt)}</span></li>)}</ul>
        )}
      </Section>

      <Section title="4 · Fine-tune on the GPU box" help={<>LoRA (unsloth, 4-bit) over ssh to <code className="font-mono">{st?.gpu?.host ?? "gpu"}</code>, then the GGUF comes back and lands in Ollama under the tag. First run installs the Python stack (slow). Typical: 20–60 min.</>}>
        {!gpuOk && <p className="text-sm text-jh-mute mb-3">The GPU box is off right now — switch it on, or train elsewhere and use Import below.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="block"><span className="label">Dataset</span><select className="field" value={ft.dataset} onChange={(e) => setFt({ ...ft, dataset: e.target.value })}>{(data?.datasets ?? []).map((d) => <option key={d.name} value={d.name}>{d.name} ({d.train})</option>)}</select></label>
          <label className="block lg:col-span-2"><span className="label">Base model</span><select className="field" value={ft.base} onChange={(e) => setFt({ ...ft, base: e.target.value })}>{FINETUNE_BASES.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
          <label className="block"><span className="label">Ollama tag</span><input className="field font-mono" value={ft.tag} onChange={(e) => setFt({ ...ft, tag: e.target.value })} /></label>
          <NumberField label="Epochs" min={1} max={5} value={ft.epochs} onChange={(v) => setFt({ ...ft, epochs: v })} />
        </div>
        <button type="button" disabled={!online || !gpuOk || !ft.dataset || busy === "finetune"} onClick={() => queue("finetune", { agent: "evaluator", ...ft }, "Fine-tune")} className="btn-primary text-sm mt-3 disabled:opacity-50"><Cpu className="h-4 w-4" /> Fine-tune</button>
      </Section>

      <Section title="5 · Exam, import, promote" help="Exam runs a model on the held-out cases and measures agreement with the teacher (score MAE, ±0.5 hit rate, archetype). Import brings in a GGUF you uploaded to the Drive folder. Promote makes a model the Evaluator's production model.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="label">Model to examine</span><select className="field" value={examTag} onChange={(e) => setExamTag(e.target.value)}>{models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}</select></label>
          <NumberField label="Cases" min={1} max={20} value={examLimit} onChange={setExamLimit} className="w-28" />
          <button type="button" disabled={!online || !examTag || counts.exam === 0 || busy === "exam"} onClick={() => queue("exam", { agent: "evaluator", tag: examTag, limit: examLimit }, `Exam of ${examTag}`)} className="btn-secondary text-sm h-[46px] disabled:opacity-50"><FlaskConical className="h-4 w-4" /> Run exam</button>
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-3">
          <label className="block"><span className="label">Import — Ollama tag</span><input className="field font-mono" placeholder="careerops-evaluator:colab1" value={imp.tag} onChange={(e) => setImp({ ...imp, tag: e.target.value })} /></label>
          <label className="block flex-1 min-w-64"><span className="label">Drive file id of the .gguf</span><input className="field font-mono" value={imp.driveFileId} onChange={(e) => setImp({ ...imp, driveFileId: e.target.value })} /></label>
          <button type="button" disabled={!online || !imp.tag || !imp.driveFileId || busy === "import_model"} onClick={() => queue("import_model", imp, `Import ${imp.tag}`)} className="btn-secondary text-sm h-[46px] disabled:opacity-50"><Upload className="h-4 w-4" /> Import</button>
        </div>
        {data && data.models.length > 0 && (
          <div className="overflow-x-auto -mx-5 px-5 mt-4">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-jh-mute border-b border-jh-line">{["Model", "Origin", "Status", "Exam: score MAE", "±0.5", "Archetype", "Summary block", "s/case", ""].map((h) => <th key={h} className="font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {data.models.map((m) => (
                  <tr key={m.tag} className="border-b border-jh-line last:border-0">
                    <td className="px-3 py-2 font-mono text-jh-ink">{m.tag}</td>
                    <td className="px-3 py-2 text-jh-mute">{m.source === "finetune" ? `${m.base?.split("/").pop()} · ${m.dataset} · ${m.epochs}ep` : m.source}</td>
                    <td className="px-3 py-2"><span className={`pill ${m.status === "ready" ? "bg-rb-green-light/30 text-rb-green-dark" : m.status === "failed" ? "bg-jh-red-soft text-jh-red" : "bg-rb-yellow/30 text-jh-ink"}`}>{m.status}</span>{m.error && <p className="text-xs text-jh-red max-w-xs truncate" title={m.error}>{m.error}</p>}</td>
                    <td className="px-3 py-2 tabular-nums">{m.exam?.scoreMae ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{m.exam?.within05 != null ? `${m.exam.within05}%` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{m.exam?.archetypeAgreement != null ? `${m.exam.archetypeAgreement}%` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{m.exam?.summaryRate != null ? `${m.exam.summaryRate}%` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{m.exam?.avgSeconds ?? "—"}</td>
                    <td className="px-3 py-2">{m.status === "ready" && <button type="button" onClick={() => promote(m.tag)} className="btn-ghost text-xs"><Star className="h-3.5 w-3.5" /> Use for Evaluator</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
