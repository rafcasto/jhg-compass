// The intake wizard: six tabs, freely navigable.
//
// Deliberately NOT a locked linear wizard. Every tab is reachable at any time,
// in any order, and nothing is gated behind "complete the previous step" — a
// member who only wants to fix their phone number should not have to walk
// through their CV to reach it. The tabs carry their own state instead, so the
// shape of what is left is visible without being enforced.
//
// The active tab lives in the URL (?step=…), so a half-finished intake can be
// bookmarked, reloaded or linked to from the checklist.
//
// Pure — no React. Tested.
import type { Personalization } from "./personalization";
import type { CareerOpsContact, CareerOpsPolicy } from "./types";

export interface WizardStep {
  key: string;
  /** Tab label — short, because six of them share a row. */
  label: string;
  /** The heading on the panel itself. */
  title: string;
  /** Whether the portal can function without it. */
  required: boolean;
}

export const WIZARD_STEPS = [
  { key: "cv", label: "CV", title: "Your CV", required: true },
  { key: "northstar", label: "North Star", title: "Your North Star goal", required: true },
  { key: "watchlist", label: "Watchlist", title: "Your company watchlist", required: true },
  { key: "contact", label: "Contact", title: "Contact details and logistics", required: false },
  { key: "targeting", label: "Targeting", title: "What evaluations score against", required: false },
  { key: "review", label: "Review", title: "Everything in one place", required: false },
] as const satisfies readonly WizardStep[];

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

export const DEFAULT_STEP: WizardStepKey = "cv";

/** `?step=targeting` → "targeting"; anything unknown → the first step. */
export function parseWizardStep(raw: string | null | undefined): WizardStepKey {
  return (WIZARD_STEPS as readonly WizardStep[]).some((s) => s.key === raw)
    ? (raw as WizardStepKey)
    : DEFAULT_STEP;
}

export const findWizardStep = (key: string): WizardStep | undefined =>
  (WIZARD_STEPS as readonly WizardStep[]).find((s) => s.key === key);

export const wizardStepIndex = (key: WizardStepKey): number =>
  (WIZARD_STEPS as readonly WizardStep[]).findIndex((s) => s.key === key);

/** The next / previous tab, or null at either end. */
export const nextWizardStep = (key: WizardStepKey): WizardStepKey | null => {
  const i = wizardStepIndex(key);
  return i >= 0 && i < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[i + 1].key : null;
};
export const prevWizardStep = (key: WizardStepKey): WizardStepKey | null => {
  const i = wizardStepIndex(key);
  return i > 0 ? WIZARD_STEPS[i - 1].key : null;
};

// ---- per-tab state ----

/** "done" = nothing more needed · "partial" = started · "empty" = untouched. */
export type StepState = "done" | "partial" | "empty";

export interface WizardSignals {
  hasCv: boolean;
  /** The role from whichever North Star is in effect. */
  goalRole?: string | null;
  contact?: CareerOpsContact | null;
  policy?: CareerOpsPolicy | null;
  personalization?: Personalization | null;
  companies: number;
}

const filled = (o: object | null | undefined): number =>
  o ? Object.values(o).filter((v) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)).length : 0;

/**
 * What each tab shows. "partial" exists because a half-filled optional tab and
 * an untouched one are different things to a member deciding where to go next —
 * and because calling an optional tab "done" the moment one field is typed
 * would be a lie.
 */
export function wizardStates(s: WizardSignals): Record<WizardStepKey, StepState> {
  const contactCount = filled(s.contact) + filled(s.policy);
  const sections = s.personalization ? filled(s.personalization) : 0;
  return {
    cv: s.hasCv ? "done" : "empty",
    northstar: s.goalRole?.trim() ? "done" : "empty",
    watchlist: s.companies > 0 ? "done" : "empty",
    // Ten possible fields across contact + policy; five is a reasonable "enough".
    contact: contactCount === 0 ? "empty" : contactCount >= 5 ? "done" : "partial",
    targeting: sections === 0 ? "empty" : sections >= 8 ? "done" : "partial",
    review: "done",
  };
}

export interface WizardProgress { done: number; total: number; pct: number }

/** Progress over the REQUIRED tabs only — an optional tab cannot stall it. */
export function wizardProgress(states: Record<WizardStepKey, StepState>): WizardProgress {
  const required = (WIZARD_STEPS as readonly WizardStep[]).filter((s) => s.required);
  const done = required.filter((s) => states[s.key as WizardStepKey] === "done").length;
  return { done, total: required.length, pct: Math.round((done / required.length) * 100) };
}

/** The first required tab that still needs something, or null when all are done. */
export function firstUnfinishedStep(states: Record<WizardStepKey, StepState>): WizardStepKey | null {
  const step = (WIZARD_STEPS as readonly WizardStep[]).find(
    (s) => s.required && states[s.key as WizardStepKey] !== "done",
  );
  return (step?.key as WizardStepKey) ?? null;
}
