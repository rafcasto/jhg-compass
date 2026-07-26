"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Plus, Trash2, MessageSquareHeart } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import type { FeedbackConfig, FeedbackQuestion } from "@/lib/types";
import { DEFAULT_FEEDBACK_CONFIG, newFeedbackQuestionId } from "@/lib/feedback-defaults";

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await auth.currentUser!.getIdToken();
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
}

type ResponseRow = {
  id: string;
  email?: string;
  firstName?: string;
  rating?: number | null;
  answers: Record<string, string | number>;
  source: "global" | "link";
  createdAt: number;
};

export default function FeedbackTab() {
  const [cfg, setCfg] = useState<FeedbackConfig | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    authedFetch("/api/admin/feedback").then((r) => r.json()).then((d) => {
      if (d.ok) { setCfg(d.config); setResponses(d.responses ?? []); }
    });
  }, []);

  function set<K extends keyof FeedbackConfig>(key: K, value: FeedbackConfig[K]) {
    setCfg((c) => ({ ...(c as FeedbackConfig), [key]: value })); setSaved(false);
  }
  function updateQuestion(id: string, patch: Partial<FeedbackQuestion>) {
    setCfg((c) => ({ ...(c as FeedbackConfig), questions: (c as FeedbackConfig).questions.map((q) => q.id === id ? { ...q, ...patch } : q) }));
    setSaved(false);
  }
  function removeQuestion(id: string) {
    setCfg((c) => ({ ...(c as FeedbackConfig), questions: (c as FeedbackConfig).questions.filter((q) => q.id !== id) }));
    setSaved(false);
  }
  function addTextQuestion() {
    const q: FeedbackQuestion = { id: newFeedbackQuestionId(), kind: "text", prompt: "New question", placeholder: "", required: false };
    setCfg((c) => ({ ...(c as FeedbackConfig), questions: [...(c as FeedbackConfig).questions, q] }));
    setSaved(false);
  }
  function move(id: string, dir: -1 | 1) {
    setCfg((c) => {
      const qs = [...(c as FeedbackConfig).questions];
      const i = qs.findIndex((q) => q.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return c as FeedbackConfig;
      [qs[i], qs[j]] = [qs[j], qs[i]];
      return { ...(c as FeedbackConfig), questions: qs };
    });
    setSaved(false);
  }

  async function save() {
    if (!cfg) return;
    setBusy(true); setSaved(false);
    const r = await authedFetch("/api/admin/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
    });
    if (r.ok) { setCfg((await r.json()).config); setSaved(true); }
    setBusy(false);
  }
  function resetDefaults() {
    if (confirm("Reset the feedback survey copy & questions to the built-in defaults? Applied when you Save.")) {
      setCfg(structuredClone(DEFAULT_FEEDBACK_CONFIG)); setSaved(false);
    }
  }

  const link = typeof window !== "undefined" ? `${window.location.origin}/compass?feedback=1` : "";
  async function copyLink() { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }

  if (!cfg) return <p className="text-jh-mute animate-pulse">Loading feedback…</p>;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><MessageSquareHeart className="h-5 w-5 text-jh-red" /><h2 className="text-xl">User feedback</h2></div>
          <p className="text-jh-mute text-sm mt-1">Collect in-app feedback. The <strong>global</strong> survey shows to every user until they submit; the <strong>per-user link</strong> shows it to one person you send it to. The expired-access paywall always takes precedence.</p>
        </div>
        <button onClick={resetDefaults} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap">Reset to defaults</button>
      </div>

      {/* ---- Enable global modal ---- */}
      <section className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-display font-semibold text-jh-ink">Global feedback modal</p>
          <p className="text-jh-mute text-sm">When on, every user sees the survey until they submit it.</p>
        </div>
        <Toggle on={cfg.enabled} onChange={(v) => set("enabled", v)} />
      </section>

      {/* ---- Per-user link ---- */}
      <section className="card p-5 space-y-3">
        <p className="font-display font-semibold text-jh-ink">Per-user request link</p>
        <p className="text-jh-mute text-sm">Send this to a specific user to pop the survey for just them — works even while the global modal is off.</p>
        <div className="flex items-center gap-2">
          <input readOnly className="field font-mono text-xs flex-1" value={link} />
          <button onClick={copyLink} className="btn-secondary text-xs px-3 py-2 shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </section>

      {/* ---- Copy ---- */}
      <section className="card p-5 space-y-4">
        <p className="font-display font-semibold text-jh-ink">Survey copy</p>
        <div><label className="label">Title</label><input className="field" value={cfg.title} onChange={(e) => set("title", e.target.value)} /></div>
        <div><label className="label">Intro</label><textarea className="field min-h-20" value={cfg.intro} onChange={(e) => set("intro", e.target.value)} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Submit button</label><input className="field" value={cfg.submitLabel} onChange={(e) => set("submitLabel", e.target.value)} /></div>
          <div><label className="label">Thank-you title</label><input className="field" value={cfg.thanksTitle} onChange={(e) => set("thanksTitle", e.target.value)} /></div>
        </div>
        <div><label className="label">Thank-you body</label><textarea className="field min-h-20" value={cfg.thanksBody} onChange={(e) => set("thanksBody", e.target.value)} /></div>
      </section>

      {/* ---- Questions ---- */}
      <section className="space-y-4">
        <div>
          <h3 className="font-display font-bold text-jh-ink">Questions</h3>
          <p className="text-jh-mute text-sm">Edit prompts, add or remove free-text questions, and reorder. The rating question uses an emoji scale (one emoji + label per point).</p>
        </div>

        {cfg.questions.map((q, i) => (
          <div key={q.id} className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-display font-semibold text-jh-ink text-sm">
                {q.kind === "rating" ? "⭐ Rating scale" : "✏️ Free text"}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => move(q.id, -1)} disabled={i === 0} className="grid place-items-center h-8 w-8 rounded-[9px] text-jh-mute hover:bg-jh-mist disabled:opacity-30" aria-label="Move up">▲</button>
                <button onClick={() => move(q.id, 1)} disabled={i === cfg.questions.length - 1} className="grid place-items-center h-8 w-8 rounded-[9px] text-jh-mute hover:bg-jh-mist disabled:opacity-30" aria-label="Move down">▼</button>
                {q.kind !== "rating" && (
                  <button onClick={() => removeQuestion(q.id)} className="grid place-items-center h-8 w-8 rounded-[9px] text-jh-mute hover:text-jh-red hover:bg-jh-red-soft" aria-label="Remove question"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            </div>

            <div><label className="label">Prompt</label><input className="field" value={q.prompt} onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })} /></div>

            {q.kind === "rating" ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Emojis (comma-separated)</label><input className="field" value={(q.emojis ?? []).join(", ")} onChange={(e) => updateQuestion(q.id, { emojis: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
                <div><label className="label">Scale labels (comma-separated)</label><input className="field" value={(q.scaleLabels ?? []).join(", ")} onChange={(e) => updateQuestion(q.id, { scaleLabels: e.target.value.split(",").map((s) => s.trim()) })} /></div>
              </div>
            ) : (
              <div><label className="label">Placeholder</label><input className="field" value={q.placeholder ?? ""} onChange={(e) => updateQuestion(q.id, { placeholder: e.target.value })} /></div>
            )}

            <label className="flex items-center gap-2 text-sm text-jh-mute">
              <input type="checkbox" checked={!!q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} /> Required
            </label>
          </div>
        ))}

        <button onClick={addTextQuestion} className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add free-text question
        </button>
      </section>

      {/* sticky save */}
      <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-jh-paper/90 backdrop-blur border-t border-jh-line flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save feedback"}</button>
        {saved && <span className="text-sm text-rb-green-dark">Saved ✓ — live now</span>}
      </div>

      {/* ---- Responses ---- */}
      <FeedbackResponses cfg={cfg} rows={responses} />
    </div>
  );
}

function FeedbackResponses({ cfg, rows }: { cfg: FeedbackConfig; rows: ResponseRow[] }) {
  const ratingQ = useMemo(() => cfg.questions.find((q) => q.kind === "rating"), [cfg.questions]);
  const textQs = useMemo(() => cfg.questions.filter((q) => q.kind === "text"), [cfg.questions]);

  const dist = useMemo(() => {
    const n = ratingQ?.emojis?.length ?? 4;
    const counts = Array.from({ length: n }, () => 0);
    let sum = 0, rated = 0;
    for (const r of rows) {
      if (typeof r.rating === "number" && r.rating >= 1 && r.rating <= n) { counts[r.rating - 1]++; sum += r.rating; rated++; }
    }
    return { counts, avg: rated ? (sum / rated) : 0, rated };
  }, [rows, ratingQ]);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h3 className="font-display font-bold text-jh-ink">Responses</h3>
        <p className="text-sm text-jh-mute">{rows.length} total{dist.rated ? ` · avg ${dist.avg.toFixed(1)}/${ratingQ?.emojis?.length ?? 4}` : ""}</p>
      </div>

      {ratingQ && dist.rated > 0 && (
        <div className="card p-5">
          <p className="font-display font-semibold text-jh-ink mb-3">{ratingQ.prompt}</p>
          <div className="space-y-2">
            {dist.counts.map((c, i) => {
              const pct = dist.rated ? Math.round((c / dist.rated) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-jh-ink">{ratingQ.emojis?.[i]} {ratingQ.scaleLabels?.[i] ?? i + 1}</span>
                  <div className="flex-1 h-2.5 rounded-pill bg-jh-mist overflow-hidden"><div className="h-full bg-jh-red" style={{ width: `${pct}%` }} /></div>
                  <span className="w-16 shrink-0 text-right text-jh-mute tabular-nums">{c} · {pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-jh-mute">No feedback yet.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-display font-semibold text-jh-ink">{r.firstName || r.email || "Anonymous"}</span>
                {r.email && r.firstName && <span className="text-xs text-jh-mute">{r.email}</span>}
                {ratingQ && typeof r.rating === "number" && (
                  <span className="pill bg-jh-mist text-jh-ink">{ratingQ.emojis?.[r.rating - 1] ?? ""} {ratingQ.scaleLabels?.[r.rating - 1] ?? r.rating}</span>
                )}
                <span className="pill bg-jh-mist text-jh-mute capitalize">{r.source}</span>
                <span className="text-xs text-jh-mute ml-auto">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</span>
              </div>
              <div className="space-y-2">
                {textQs.map((q) => {
                  const a = r.answers?.[q.id];
                  if (a === undefined || a === null || `${a}`.trim() === "") return null;
                  return (
                    <div key={q.id} className="grid sm:grid-cols-[1fr_1.4fr] gap-1 sm:gap-3">
                      <p className="text-sm text-jh-mute">{q.prompt}</p>
                      <p className="text-sm text-jh-ink whitespace-pre-wrap">{a as string}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-pill transition shrink-0 ${on ? "bg-rb-green-dark" : "bg-jh-line-2"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
