"use client";

import { useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Circle, CircleDashed } from "lucide-react";
import {
  WIZARD_STEPS,
  firstUnfinishedStep,
  nextWizardStep,
  parseWizardStep,
  prevWizardStep,
  wizardProgress,
  wizardStates,
  type StepState,
  type WizardStepKey,
} from "@/lib/careerops/intake-wizard";
import { effectiveGoal, intakeSteps } from "@/lib/careerops/intake";
import { PORTAL_HOME, SETUP_HREF } from "@/lib/careerops/portal-nav";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import ContactPolicy from "./ContactPolicy";
import CvPanel from "./CvPanel";
import NorthStarSource from "./NorthStarSource";
import Personalization from "./Personalization";
import WatchlistPanel from "./WatchlistPanel";

// The intake wizard. Six tabs, every one reachable at any time by clicking it —
// nothing is gated behind finishing the previous step, because a member who
// wants to fix one field should not have to walk through their CV to reach it.
//
// The active tab lives in ?step=, so a half-finished intake can be bookmarked,
// reloaded, or linked to. Tab state (done / started / untouched) is shown on
// each tab rather than enforced.

const ICON: Record<StepState, typeof Check> = { done: Check, partial: CircleDashed, empty: Circle };
const TONE: Record<StepState, string> = {
  done: "text-rb-green-dark",
  partial: "text-jh-red",
  empty: "text-jh-mute-2",
};

export default function IntakeWizard({ uid, setup, profile, answers }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  profile: Profile | null | undefined;
  /** How many standard answers are saved — for the review checklist. */
  answers: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const step = parseWizardStep(params.get("step"));
  const tabsRef = useRef<HTMLDivElement>(null);

  const goal = useMemo(
    () => effectiveGoal({ source: setup?.goalSource, compassGoal: profile?.goal, intakeGoal: setup?.intakeGoal }),
    [setup?.goalSource, setup?.intakeGoal, profile?.goal],
  );

  const states = useMemo(
    () => wizardStates({
      hasCv: !!setup?.cvMarkdown?.trim(),
      goalRole: goal.goal.role ?? null,
      contact: setup?.contact,
      policy: setup?.policy,
      personalization: setup?.personalization,
      companies: setup?.portals?.companies?.length ?? 0,
    }),
    [setup, goal],
  );
  const progress = wizardProgress(states);
  const unfinished = firstUnfinishedStep(states);

  const go = useCallback((key: WizardStepKey) => {
    // replace, not push: walking the tabs should not fill the back button with
    // every step the member looked at.
    router.replace(`?step=${key}`, { scroll: false });
  }, [router]);

  // Left/right arrows move between tabs, as a tablist is expected to.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const target = dir === 1 ? nextWizardStep(step) : prevWizardStep(step);
    if (target) {
      go(target);
      const i = WIZARD_STEPS.findIndex((s) => s.key === target);
      (tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[i])?.focus();
    }
  };

  const meta = WIZARD_STEPS.find((s) => s.key === step)!;
  const back = prevWizardStep(step);
  const forward = nextWizardStep(step);

  // The review tab reuses the checklist, so "what is left" is stated once.
  const checklist = intakeSteps({
    hasCv: !!setup?.cvMarkdown?.trim(),
    goalRole: goal.goal.role ?? null,
    goalSource: goal.source,
    companies: setup?.portals?.companies?.length ?? 0,
    answers,
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-jh-mute">The three required steps</p>
          <span className="font-mono text-xs text-jh-mute" aria-label={`${progress.done} of ${progress.total} required steps done`}>
            {progress.done}/{progress.total}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-pill bg-jh-mist">
          <div className="h-full rounded-pill bg-jh-red transition-[width]" style={{ width: `${progress.pct}%` }} />
        </div>
      </div>

      <div ref={tabsRef} role="tablist" aria-label="Intake steps" onKeyDown={onKeyDown} className="flex flex-wrap gap-1 rounded-pill bg-jh-mist p-1">
        {WIZARD_STEPS.map((s) => {
          const state = states[s.key];
          const Icon = ICON[state];
          const active = s.key === step;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              id={`intake-tab-${s.key}`}
              aria-selected={active}
              aria-controls={`intake-panel-${s.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => go(s.key)}
              className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-sm font-mono font-semibold transition-colors ${active ? "bg-white text-jh-ink" : "text-jh-mute hover:text-jh-ink"}`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${TONE[state]}`} aria-hidden />
              {s.label}
              {s.required && state !== "done" && <span className="sr-only"> (still needed)</span>}
              <span className="sr-only">
                {state === "done" ? " — done" : state === "partial" ? " — started" : " — not yet"}
              </span>
            </button>
          );
        })}
      </div>

      <section
        role="tabpanel"
        id={`intake-panel-${step}`}
        aria-labelledby={`intake-tab-${step}`}
        tabIndex={-1}
        className="card p-5 space-y-4"
      >
        <div>
          <h2 className="text-lg">{meta.title}</h2>
          {!meta.required && step !== "review" && (
            <p className="text-xs text-jh-mute-2 mt-0.5">Optional — the portal works without it, but the agents argue your case better with it.</p>
          )}
        </div>

        {step === "cv" && <CvPanel uid={uid} setup={setup} profile={profile} goalRole={goal.goal.role} onSaved={() => forward && go(forward)} />}
        {step === "northstar" && <NorthStarSource uid={uid} setup={setup} profile={profile} />}
        {step === "watchlist" && <WatchlistPanel uid={uid} setup={setup} goalRole={goal.goal.role} />}
        {step === "contact" && <ContactPolicy uid={uid} setup={setup} profile={profile} />}
        {step === "targeting" && <Personalization uid={uid} setup={setup} profile={profile} />}

        {step === "review" && (
          <div className="space-y-4">
            <p className="text-jh-mute text-sm max-w-2xl">
              Everything the agents know about you. Fill a gap whenever you like — nothing here is ever submitted on your behalf.
            </p>
            <ul className="divide-y divide-jh-line">
              {checklist.map((c) => (
                <li key={c.key} className="flex items-start gap-3 py-3">
                  {c.done
                    ? <Check className="h-4 w-4 shrink-0 mt-0.5 text-rb-green-dark" aria-hidden />
                    : <Circle className="h-4 w-4 shrink-0 mt-0.5 text-jh-mute-2" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-jh-ink">
                      {c.label}
                      {c.optional && <span className="ml-2 font-normal text-xs text-jh-mute-2">optional</span>}
                    </p>
                    <p className="text-xs text-jh-mute mt-0.5">{c.detail}</p>
                  </div>
                  <span className="sr-only">{c.done ? "done" : "not yet"}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => router.replace(PORTAL_HOME)} className="btn-primary text-sm">
                {unfinished ? "Enter the portal anyway" : "Enter the portal"} <ArrowRight className="h-4 w-4" />
              </button>
              {unfinished && (
                <button type="button" onClick={() => go(unfinished)} className="btn-secondary text-sm">
                  Finish {WIZARD_STEPS.find((s) => s.key === unfinished)!.label.toLowerCase()}
                </button>
              )}
              <Link href={SETUP_HREF} className="btn-ghost text-xs">Full setup — portal accounts, standard answers</Link>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-3">
        {back ? (
          <button type="button" onClick={() => go(back)} className="btn-secondary text-sm">
            <ArrowLeft className="h-4 w-4" /> {WIZARD_STEPS.find((s) => s.key === back)!.label}
          </button>
        ) : <span />}
        {forward ? (
          <button type="button" onClick={() => go(forward)} className="btn-secondary text-sm">
            {WIZARD_STEPS.find((s) => s.key === forward)!.label} <ArrowRight className="h-4 w-4" />
          </button>
        ) : <span />}
      </div>
    </div>
  );
}
