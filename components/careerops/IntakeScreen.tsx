"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { paths, useLiveCollection, useLiveDoc } from "@/lib/firestore/db";
import { effectiveGoal } from "@/lib/careerops/intake";
import { type StartPathKey } from "@/lib/careerops/maleta";
import type { CareerOpsAnswer } from "@/lib/careerops/answers";
import type { Profile } from "@/lib/types";
import IntakeWizard from "./IntakeWizard";
import MaletaUpload from "./MaletaUpload";
import StartChooser from "./StartChooser";
import { useCareerOps } from "./shared";

// CareerOps intake — the portal's onboarding.
//
// Two screens only: pick how you want to start, then the wizard. The wizard
// owns every step (CV, North Star, watchlist, contact, targeting, review) as
// freely navigable tabs; this file only decides which of the three doors the
// member came through.
//
// Pattern credit: career-ops' first-run intake (career-ops-hq/career-ops,
// web/src/components/cv/cv-ingest.tsx + modes/intake.md) — propose → review →
// confirm, readiness as a hint and never a gate, and the "what comes next"
// checklist visible from the first second.

type Phase = "choose" | "wizard" | "maleta";

function Inner() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { ctx, loading, allowed } = useCareerOps();
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: answers } = useLiveCollection<CareerOpsAnswer>(uid, paths.careerOpsAnswers);

  const [phase, setPhase] = useState<Phase>("choose");
  const [path, setPath] = useState<StartPathKey | null>(null);

  // A member who already has a CV goes straight to the wizard: the chooser is a
  // first-run question, not something to answer again on every visit.
  useEffect(() => {
    if (ctx && !ctx.setupLoading && ctx.hasCv && phase === "choose") setPhase("wizard");
  }, [ctx, phase]);

  const goal = useMemo(
    () => effectiveGoal({ source: ctx?.setup?.goalSource, compassGoal: profile?.goal, intakeGoal: ctx?.setup?.intakeGoal }),
    [ctx?.setup?.goalSource, ctx?.setup?.intakeGoal, profile?.goal],
  );

  if (loading || !ctx || ctx.setupLoading) return <p className="text-jh-mute animate-pulse">Loading…</p>;
  if (!allowed) return null; // the layout shows the "not switched on" card

  const heading = phase === "choose" ? "Let's get you set up" : phase === "maleta" ? "Upload la maleta" : "Your CareerOps intake";
  const blurb = phase === "choose"
    ? "Three ways in, and they all end up in the same place. Everything stays on our own hardware, and nothing is ever submitted on your behalf."
    : phase === "maleta"
      ? "One file with everything in it. We read it in your browser and show you what we found before saving anything."
      : "Work through the tabs in any order, and stop whenever you like — nothing is locked behind anything else.";

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">CareerOps · Intake</p>
        <h1 className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-jh-red" strokeWidth={1.5} /> {heading}
        </h1>
        <p className="text-jh-mute mt-1 max-w-2xl">{blurb}</p>
      </header>

      {phase === "choose" && (
        <StartChooser
          goalRole={goal.goal.role ?? null}
          onPick={(k) => { setPath(k); setPhase(k === "maleta" ? "maleta" : "wizard"); }}
        />
      )}

      {phase === "maleta" && uid && (
        <MaletaUpload
          uid={uid}
          setup={ctx.setup}
          profile={profile}
          onDone={() => setPhase("wizard")}
          onBack={() => { setPath(null); setPhase("choose"); }}
        />
      )}

      {phase === "wizard" && uid && (
        <>
          <IntakeWizard uid={uid} setup={ctx.setup} profile={profile} answers={answers.length} />
          {/* The light path came in expecting ~2 minutes. Say plainly that the
              optional tabs are optional, rather than letting six tabs imply a
              six-step obligation. */}
          {path === "compass" && (
            <p className="text-xs text-jh-mute-2">
              Only CV, North Star and Watchlist are needed. Contact and Targeting make the agents sharper, and can wait.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function IntakeScreen() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<p className="text-jh-mute animate-pulse">Loading…</p>}>
      <Inner />
    </Suspense>
  );
}
