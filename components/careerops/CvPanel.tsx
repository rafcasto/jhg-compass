"use client";

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Check, FileText, Lock, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { buildPortalsYaml, suggestKeywords, DEFAULT_NEGATIVE } from "@/lib/careerops/portals-yaml";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import { cvReadiness, isTextCvFile } from "@/lib/careerops/intake";
import type { CareerOpsPortals, CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// The CV step. Extracted from IntakeScreen so first-run and the wizard's CV tab
// are the same code rather than two drifting copies — a member who revisits the
// tab gets the same paste → review → confirm flow, with their current CV shown
// first so "replace" is a deliberate act.

type Phase = "ask" | "review" | "saving";

export default function CvPanel({ uid, setup, profile, goalRole, onSaved }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  profile: Profile | null | undefined;
  /** Seeds the Scout's include keywords on first save. */
  goalRole?: string | null;
  onSaved?: () => void;
}) {
  const saved = setup?.cvMarkdown?.trim() ?? "";
  const [phase, setPhase] = useState<Phase>("ask");
  const [paste, setPaste] = useState("");
  const [md, setMd] = useState("");
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  const readiness = md.trim() ? cvReadiness(md) : null;

  function takeText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) { setErr("That looks empty — paste your CV instead."); return; }
    setErr(null);
    setMd(trimmed);
    setPhase("review");
  }

  function takeFile(file: File | undefined) {
    if (!file) return;
    // Markdown and plain text are the format: they read in the browser
    // instantly, and the agents quote lines straight out of them. Anything else
    // would be a blob nothing downstream can cite, so we say what we take
    // rather than saving it.
    if (!isTextCvFile(file.name)) {
      setErr("CVs come in as Markdown or plain text — a .md or .txt file. Save or export yours as one and drop it here, or just paste the text above.");
      return;
    }
    file.text()
      .then((t) => (t.trim() ? takeText(t) : setErr("That file looks empty — paste your CV instead.")))
      .catch(() => setErr("Couldn't read that file — paste your CV instead."));
  }

  async function save() {
    if (!md.trim()) { setErr("Your CV looks empty — paste it again."); return; }
    setErr(null);
    setPhase("saving");
    try {
      // Seed the Scout's include keywords from the North Star role the first
      // time, so the watchlist tab is not empty when they reach it.
      const portals: CareerOpsPortals = setup?.portals ?? {
        companies: [],
        positive: suggestKeywords(goalRole ?? undefined),
        negative: DEFAULT_NEGATIVE,
      };
      await setDoc(
        paths.careerOpsSetup(uid),
        {
          cvMarkdown: md.trim(),
          portals,
          portalsYaml: buildPortalsYaml(portals),
          profileYaml: buildSetupProfileYaml({ profile, setup }),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      setReplacing(false);
      setPhase("ask");
      setPaste("");
      setMd("");
      onSaved?.();
    } catch {
      setErr("Couldn't save your CV — check your connection and try again.");
      setPhase("review"); // keep the text so nothing is lost
    }
  }

  const alert = err && (
    <p role="alert" className="flex items-start gap-2 rounded-[10px] border border-jh-red/30 bg-jh-red/5 px-3 py-2.5 text-sm text-jh-red">
      <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" /> {err}
    </p>
  );

  // ── already saved: show it, and make replacing deliberate ──
  if (saved && !replacing && phase === "ask") {
    const r = cvReadiness(saved);
    return (
      <div className="space-y-3">
        {alert}
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-jh-red" />
          <h3 className="font-display font-semibold text-jh-ink">Your CV is saved</h3>
          <span className={`ml-auto inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold ${r.scoreable ? "bg-rb-green-dark/10 text-rb-green-dark" : "bg-jh-red/10 text-jh-red"}`}>
            {r.scoreable ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
            {r.scoreable ? "Ready to score" : "A bit thin"}
          </span>
        </div>
        {r.hint && <p className="text-xs text-jh-red">{r.hint}</p>}
        <div className="prose prose-sm max-w-none max-h-72 overflow-y-auto rounded-[10px] border border-jh-line bg-jh-mist/40 p-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{saved}</ReactMarkdown>
        </div>
        <p className="text-xs text-jh-mute-2">{r.words} words{setup?.updatedAt ? ` · last saved ${new Date(setup.updatedAt).toLocaleString()}` : ""}</p>
        <button type="button" onClick={() => { setReplacing(true); setPaste(saved); }} className="btn-secondary text-sm">
          <RotateCcw className="h-4 w-4" /> Replace my CV
        </button>
      </div>
    );
  }

  // ── review: propose, then confirm ──
  if (phase === "review" || phase === "saving") {
    return (
      <div className="space-y-3">
        {alert}
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-jh-red" />
          <h3 className="font-display font-semibold text-jh-ink">Here&apos;s your CV — review and save</h3>
          {readiness && (
            <span className={`ml-auto inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold ${readiness.scoreable ? "bg-rb-green-dark/10 text-rb-green-dark" : "bg-jh-red/10 text-jh-red"}`}>
              {readiness.scoreable ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
              {readiness.scoreable ? "Ready to score" : "A bit thin"}
            </span>
          )}
        </div>
        {readiness?.hint && <p className="text-xs text-jh-red">{readiness.hint}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <textarea aria-label="Review your CV" value={md} onChange={(e) => setMd(e.target.value)} className="field font-mono text-xs min-h-[18rem]" />
          <div className="prose prose-sm max-w-none overflow-y-auto rounded-[10px] border border-jh-line bg-jh-mist/40 p-3 min-h-[18rem] max-h-[18rem]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
          </div>
        </div>
        <p className="text-xs text-jh-mute-2">{readiness?.words ?? 0} words</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={phase === "saving"} className="btn-primary text-sm disabled:opacity-60">
            <Check className="h-4 w-4" /> {phase === "saving" ? "Saving…" : "Save my CV"}
          </button>
          <button type="button" onClick={() => { setMd(""); setPhase("ask"); }} className="btn-ghost text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        </div>
      </div>
    );
  }

  // ── ask: one input ──
  return (
    <div className="space-y-3">
      {alert}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); takeFile(e.dataTransfer.files?.[0]); }}
        className={`rounded-[10px] border-[1.5px] border-dashed p-4 transition-colors ${over ? "border-jh-red bg-jh-red/5" : "border-jh-line-2"}`}
      >
        <textarea
          aria-label="Your CV"
          value={paste}
          onChange={(e) => { setPaste(e.target.value); setErr(null); }}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && paste.trim()) takeText(paste); }}
          placeholder={"# Jane Smith\nSenior Product Owner · Auckland\n\n## Experience\n**Acme — Product Owner (2021–2025)**\n- Led …"}
          className="w-full min-h-[18rem] resize-y bg-transparent font-mono text-xs text-jh-ink outline-none placeholder:text-jh-mute-2"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
          <label className="btn-secondary text-xs px-3 py-2 cursor-pointer">
            <Upload className="h-3.5 w-3.5" /> Upload .md / .txt
            <input type="file" accept=".md,.txt,.markdown,text/plain,text/markdown" className="sr-only" onChange={(e) => takeFile(e.target.files?.[0])} />
          </label>
          <span className="inline-flex items-center gap-1 text-xs text-jh-mute-2"><Lock className="h-3 w-3" /> Stays on our own hardware.</span>
          <button type="button" disabled={!paste.trim()} onClick={() => takeText(paste)} className="btn-primary ml-auto text-sm disabled:opacity-60">
            Read my CV <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {saved && replacing && (
        <button type="button" onClick={() => { setReplacing(false); setPaste(""); setErr(null); }} className="btn-ghost text-xs">Keep the CV I have</button>
      )}
    </div>
  );
}
