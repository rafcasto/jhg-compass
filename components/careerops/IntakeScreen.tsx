"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setDoc } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Check, Circle, FileText, Lock, RotateCcw, Upload, TriangleAlert, Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { paths, useLiveCollection, useLiveDoc } from "@/lib/firestore/db";
import { buildPortalsYaml, suggestKeywords, DEFAULT_NEGATIVE } from "@/lib/careerops/portals-yaml";
import { cvReadiness, effectiveGoal, intakeComplete, intakeProgress, intakeSteps, isTextCvFile } from "@/lib/careerops/intake";
import { PORTAL_HOME, SETUP_HREF } from "@/lib/careerops/portal-nav";
import type { CareerOpsAnswer } from "@/lib/careerops/answers";
import type { CareerOpsPortals, CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import ContactPolicy from "./ContactPolicy";
import NorthStarSource from "./NorthStarSource";
import { useCareerOps } from "./shared";

// CareerOps intake — the portal's onboarding. One thing at a time: the CV,
// reviewed and confirmed, then the short list of what is still missing before
// the tools can work. The full Setup screen stays where it is for everything
// else; a first-timer never has to meet it.
//
// Pattern credit: career-ops' first-run intake (career-ops-hq/career-ops,
// web/src/components/cv/cv-ingest.tsx + modes/intake.md) — paste-or-drop as the
// single input, propose → review → confirm, readiness as a hint and never a
// gate, and the "what comes next" checklist visible from the first second.

type Phase = "ask" | "review" | "saving" | "done";

export default function IntakeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid;
  const { ctx, loading, allowed } = useCareerOps();
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: answers } = useLiveCollection<CareerOpsAnswer>(uid, paths.careerOpsAnswers);

  const [phase, setPhase] = useState<Phase>("ask");
  const [paste, setPaste] = useState("");
  const [md, setMd] = useState("");
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A member who already has a CV (or comes back after saving one) skips the
  // ask: intake becomes the checklist of what is still missing.
  useEffect(() => {
    if (ctx && !ctx.setupLoading && ctx.hasCv && phase === "ask") setPhase("done");
  }, [ctx, phase]);

  // Either process can own the goal, so the checklist reads the one in effect
  // rather than assuming Compass.
  const goal = useMemo(
    () => effectiveGoal({ source: ctx?.setup?.goalSource, compassGoal: profile?.goal, intakeGoal: ctx?.setup?.intakeGoal }),
    [ctx?.setup?.goalSource, ctx?.setup?.intakeGoal, profile?.goal],
  );
  const steps = useMemo(
    () => intakeSteps({
      hasCv: !!ctx?.hasCv,
      goalRole: goal.goal.role ?? null,
      goalSource: goal.source,
      companies: ctx?.setup?.portals?.companies?.length ?? 0,
      answers: answers.length,
    }),
    [ctx?.hasCv, ctx?.setup, goal, answers.length],
  );
  const progress = intakeProgress(steps);
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
    if (!uid || !md.trim()) { setErr("Your CV looks empty — paste it again."); return; }
    setErr(null);
    setPhase("saving");
    try {
      const existing = ctx?.setup ?? null;
      // Seed the Scout's include keywords from the North Star role so the
      // watchlist step has something sensible in it the moment they get there.
      const portals: CareerOpsPortals = existing?.portals ?? {
        companies: [],
        positive: suggestKeywords(goal.goal.role),
        negative: DEFAULT_NEGATIVE,
      };
      const doc: CareerOpsSetupV2 = {
        cvMarkdown: md.trim(),
        profileYaml: buildSetupProfileYaml({ profile, setup: existing }),
        notes: existing?.notes ?? "",
        portals,
        portalsYaml: buildPortalsYaml(portals),
        updatedAt: Date.now(),
      };
      await setDoc(paths.careerOpsSetup(uid), doc);
      setPhase("done");
    } catch {
      setErr("Couldn't save your CV — check your connection and try again.");
      setPhase("review"); // keep the text so nothing is lost
    }
  }

  if (loading || !ctx || ctx.setupLoading) return <p className="text-jh-mute animate-pulse">Loading…</p>;
  if (!allowed) return null; // the layout shows the "not switched on" card

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">CareerOps · Intake</p>
        <h1 className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-jh-red" strokeWidth={1.5} />
          {phase === "done" ? "Your CareerOps intake" : "Start with your CV"}
        </h1>
        <p className="text-jh-mute mt-1 max-w-2xl">
          {phase === "done"
            ? "Everything the agents know about you comes from these. Fill the gaps whenever you like — nothing here is ever submitted on your behalf."
            : "Paste the text, or drop it in as a Markdown or plain-text file (.md / .txt). Keep the detail — dates, numbers, tools — because the Evaluator quotes lines from it as evidence. It stays on our own hardware."}
        </p>
      </header>

      {err && (
        <p role="alert" className="flex items-start gap-2 rounded-[10px] border border-jh-red/30 bg-jh-red/5 px-3 py-2.5 text-sm text-jh-red">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" /> {err}
        </p>
      )}

      {/* ── ask: one input ── */}
      {phase === "ask" && (
        <section className="card p-5 space-y-3">
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
                <input ref={fileRef} type="file" accept=".md,.txt,.markdown,text/plain,text/markdown" className="sr-only" onChange={(e) => takeFile(e.target.files?.[0])} />
              </label>
              <span className="inline-flex items-center gap-1 text-xs text-jh-mute-2"><Lock className="h-3 w-3" /> Stays on our own hardware.</span>
              <button type="button" disabled={!paste.trim()} onClick={() => takeText(paste)} className="btn-primary ml-auto text-sm disabled:opacity-60">
                Read my CV <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── review: propose, then confirm ── */}
      {(phase === "review" || phase === "saving") && (
        <section className="card p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-jh-red" />
            <h2 className="text-lg">Here&apos;s your CV — review and save</h2>
            {readiness && (
              <span className={`ml-auto inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold ${readiness.scoreable ? "bg-rb-green-dark/10 text-rb-green-dark" : "bg-jh-red/10 text-jh-red"}`}>
                {readiness.scoreable ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
                {readiness.scoreable ? "Ready to score" : "A bit thin"}
              </span>
            )}
          </div>
          {readiness?.hint && <p className="text-xs text-jh-red">{readiness.hint}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <textarea
              aria-label="Review your CV"
              value={md}
              onChange={(e) => setMd(e.target.value)}
              className="field font-mono text-xs min-h-[18rem]"
            />
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
        </section>
      )}

      {/* ── the checklist: what the portal still needs ── */}
      {phase === "done" && (
        <section className="card p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg">What the agents need from you</h2>
            <span className="font-mono text-xs text-jh-mute">{progress.done}/{progress.total}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-pill bg-jh-mist">
            <div className="h-full rounded-pill bg-jh-red transition-[width]" style={{ width: `${progress.pct}%` }} />
          </div>

          <ul className="divide-y divide-jh-line">
            {steps.map((s) => (
              <li key={s.key} className="flex items-start gap-3 py-3">
                {s.done
                  ? <Check className="h-4 w-4 shrink-0 mt-0.5 text-rb-green-dark" aria-hidden />
                  : <Circle className="h-4 w-4 shrink-0 mt-0.5 text-jh-mute-2" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-jh-ink">
                    {s.label}
                    {s.optional && <span className="ml-2 font-normal text-xs text-jh-mute-2">optional</span>}
                  </p>
                  <p className="text-xs text-jh-mute mt-0.5">{s.detail}</p>
                </div>
                {!s.done && (
                  <Link href={s.href} className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap">
                    {s.key === "cv" ? "Add it" : "Open"}
                  </Link>
                )}
                <span className="sr-only">{s.done ? "done" : "not yet"}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" onClick={() => router.replace(PORTAL_HOME)} className="btn-primary text-sm">
              {intakeComplete(steps) ? "Enter the portal" : "Enter the portal anyway"} <ArrowRight className="h-4 w-4" />
            </button>
            <Link href={SETUP_HREF} className="btn-ghost text-xs">Full setup — CV, watchlist, portal accounts</Link>
          </div>
          {!intakeComplete(steps) && (
            <p className="text-xs text-jh-mute-2">
              Tools that need something missing will say so and link you back here.
            </p>
          )}
        </section>
      )}

      {/* Switchable at any stage, not just on the way in. */}
      {phase === "done" && uid && <NorthStarSource uid={uid} setup={ctx.setup} profile={profile} />}
      {phase === "done" && uid && <ContactPolicy uid={uid} setup={ctx.setup} profile={profile} />}
    </div>
  );
}
