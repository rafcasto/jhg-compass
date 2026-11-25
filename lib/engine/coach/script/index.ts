// The script engine (docs/UX_SCRIPTED_COACH.md §7, §9): which step is in the slot, which are answered, what a step's
// answer must satisfy. Walks a script the way `COACH_PARTS` walks a coach — the current step is the first whose answer
// is not stored. Resume is free; "never ask what you already know" is the registry's contract. Pure — tested.

import type { ProfileFile } from "../../../careerops/profile-file";
import type { CoachKey } from "../keys";
import { COACH_PARTS } from "../parts";
import { TRUE_NORTH_SCRIPT } from "./true-north";
import type { CoachScript, FieldValue, JobLike, Step, StepContext, StepField, StepValues } from "./types";
import { asList, asRecord, asString, figure } from "./values";

export type { CoachScript, FieldKind, FieldOption, FieldValue, JobLike, Step, StepContext, StepField, StepJob, StepValues } from "./types";

/** The coaches that run as a script (decision C: 2 first; 3 · 1 · 5 · 6 follow; Coach 4 stays a conversation). */
export const SCRIPTS: Partial<Record<CoachKey, CoachScript>> = { trueNorth: TRUE_NORTH_SCRIPT };
export const scriptFor = (coach: CoachKey | null | undefined): CoachScript | null => (coach ? SCRIPTS[coach] ?? null : null);

export const EMPTY_CONTEXT: StepContext = { jobs: [] };

export const stepFields = (step: Step, p: ProfileFile): StepField[] => (typeof step.fields === "function" ? step.fields(p) : step.fields);
const isAvailable = (step: Step, p: ProfileFile, ctx: StepContext) => !step.available || step.available(p, ctx);

/**
 * A step is answered when the profile holds its answer — or, for a step the member may skip (*I don't know yet*; the
 * schema prunes an empty answer, so a skip leaves no mark), when any later step of the script is answered.
 */
export function stepDone(script: CoachScript, step: Step, p: ProfileFile, ctx: StepContext = EMPTY_CONTEXT): boolean {
  if (step.done(p, ctx)) return true;
  if (!step.skipValues) return false;
  const i = script.steps.indexOf(step);
  return script.steps.slice(i + 1).some((s) => s.done(p, ctx));
}

/** The step in the slot: the first not answered and available. null when the script has nothing left to ask — the conversation takes over. */
export function currentStep(script: CoachScript, p: ProfileFile, ctx: StepContext = EMPTY_CONTEXT): Step | null {
  for (const s of script.steps) {
    if (stepDone(script, s, p, ctx)) continue;
    if (!isAvailable(s, p, ctx)) return null;
    return s;
  }
  return null;
}

/**
 * A job step whose job is running and whose data has not landed — the slot shows the job line, not the next step and
 * not the conversation (the next step waits on this job; `currentStep` is null meanwhile).
 */
export function waitingOn(script: CoachScript, p: ProfileFile, ctx: StepContext): { step: Step; job: JobLike } | null {
  for (const s of script.steps) {
    if (!s.job) continue;
    const job = ctx.jobs.find((j) => j.type === s.job!.type && (j.status === "queued" || j.status === "running"));
    if (job && !s.done(p, EMPTY_CONTEXT)) return { step: s, job };
  }
  return null;
}

/** The most recent job of a job step's type — its line in the transcript once it ran, and the failure to show when it did not. */
export const latestJobFor = (step: Step, ctx: StepContext): JobLike | null =>
  step.job ? [...ctx.jobs].filter((j) => j.type === step.job!.type).sort((a, c) => (c.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? null : null;

/** The answered steps, in order — the transcript's record of decisions. A job step's record is its job line, not a block. */
export const completedSteps = (script: CoachScript, p: ProfileFile, ctx: StepContext = EMPTY_CONTEXT): Step[] =>
  script.steps.filter((s) => stepDone(script, s, p, ctx));

/** The answered step before this one — *‹ Back*. */
export function previousStep(script: CoachScript, step: Step, p: ProfileFile, ctx: StepContext = EMPTY_CONTEXT): Step | null {
  const i = script.steps.indexOf(step);
  for (let j = i - 1; j >= 0; j--) if (script.steps[j].kind !== "job" && stepDone(script, script.steps[j], p, ctx)) return script.steps[j];
  return null;
}

/** `3 / 5` — the step's place within its part. */
export function stepPosition(script: CoachScript, step: Step): { n: number; total: number; part: string } {
  const inPart = script.steps.filter((s) => s.part === step.part);
  return { n: inPart.indexOf(step) + 1, total: inPart.length, part: COACH_PARTS[script.coach][step.part]?.label ?? "" };
}

/** The first step of a part carries the part's aside. */
export const asideFor = (script: CoachScript, step: Step): string | undefined => (script.steps.find((s) => s.part === step.part) === step ? step.aside : undefined);

export const findStep = (script: CoachScript, id: string): Step | undefined => script.steps.find((s) => s.id === id);

// ---- values ----

export { asList, asRecord, asString, figure, splitList } from "./values";

const filled = (f: StepField, v: FieldValue | undefined): boolean => {
  if (f.kind === "chips" || f.kind === "multi") return asList(v).length >= (f.min ?? 1);
  if (f.kind === "bucket") { const r = asRecord(v); return (f.rows ?? []).every((row) => !!r[row]); }
  return asString(v).length > 0;
};

/** Field key → one line. Empty when the answer may be written. Required fields, caps and the step's own rules. */
export function validateStep(step: Step, values: StepValues, p: ProfileFile): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of stepFields(step, p)) {
    const v = values[f.key];
    if (!f.optional && !filled(f, v)) { out[f.key] = f.kind === "multi" ? `Pick at least ${f.min ?? 1}` : f.kind === "bucket" ? "Every row needs a choice" : "Needed"; continue; }
    if ((f.kind === "text" || f.kind === "textarea") && f.max && asString(v).length > f.max) out[f.key] = `${asString(v).length} characters — the cap is ${f.max}`;
    if ((f.kind === "chips" || f.kind === "multi") && f.max && asList(v).length > f.max) out[f.key] = `At most ${f.max}`;
    if (f.kind === "number" && asString(v) && figure(asString(v)) === null) out[f.key] = "A number";
  }
  if (step.validate) for (const [k, m] of Object.entries(step.validate(values))) if (!out[k]) out[k] = m;
  return out;
}

export const canContinue = (step: Step, values: StepValues, p: ProfileFile): boolean => Object.keys(validateStep(step, values, p)).length === 0;
