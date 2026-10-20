// CareerOps intake — the portal's onboarding contract, as a pure module.
//
// Every tool in the portal works from three things: the CV (the only source of
// truth about the member), the North Star goal set on the Compass tab, and the
// companies the Scout watches. Intake collects them one at a time instead of
// handing a first-timer the whole Setup screen at once.
//
// Pattern credit: career-ops' own first-run intake
// (github.com/career-ops-hq/career-ops — `web/src/lib/cv/quality.ts`,
// `web/src/components/cv/cv-ingest.tsx`, `modes/intake.md`). Two rules carried
// over verbatim:
//   1. Readiness is ADVISORY. A thin CV earns an amber hint, never a blocked
//      save — a rough paste is still enough for a first score.
//   2. Propose, then confirm. The parsed CV is shown back for review and edit
//      before anything is written.
//
// No React, no Firebase imports: the URL/step/readiness logic is unit-testable
// and every screen reads its step list from here.

import type { Goal } from "@/lib/goal";
import type { GoalSource } from "./types";

/** Files we can read in the browser with zero help: plain text and Markdown. */
export const TEXT_CV_RE = /\.(md|markdown|txt)$/i;

export const isTextCvFile = (name: string): boolean => TEXT_CV_RE.test(name);

// ---- step 1: is this CV rich enough to score against? ----

export interface CvReadiness {
  words: number;
  hasExperience: boolean;
  hasSkills: boolean;
  /** Advisory only — never gates the save. */
  scoreable: boolean;
  hint?: string;
}

/**
 * Deterministic, zero-token "is this CV good enough?" signal. Drives a green
 * check vs an amber hint on the review step.
 */
export function cvReadiness(md: string): CvReadiness {
  const text = (md || "").trim();
  const words = text ? text.split(/\s+/).length : 0;
  // A heading we recognise, or a date range that reads like a role tenure.
  const hasExperience =
    /(^|\n)#{1,3}\s*(experience|work|employment|career|empleo|experiencia)/i.test(text) ||
    /\b(19|20)\d\d\s*[-–—]\s*((19|20)\d\d|present|now|current|actualidad)/i.test(text);
  const hasSkills = /(^|\n)#{1,3}\s*(skills|technologies|tools|competenc|habilidad)/i.test(text);
  const scoreable = words >= 80 && (hasExperience || hasSkills || words >= 200);

  let hint: string | undefined;
  if (!scoreable) {
    hint = words < 40
      ? "That's very short — add your roles, dates and numbers for real matches. You can still save it."
      : "Looks thin — add a role or two (with dates and results) and the Evaluator has more to quote. You can still save it.";
  }
  return { words, hasExperience, hasSkills, scoreable, hint };
}

// ---- which North Star is in effect ----

export const DEFAULT_GOAL_SOURCE: GoalSource = "compass";

/** Anything but an explicit "intake" means the Compass tab stays in charge. */
export const resolveGoalSource = (raw: unknown): GoalSource =>
  raw === "intake" ? "intake" : DEFAULT_GOAL_SOURCE;

/** A goal is only usable if it names a role — everything downstream keys off it. */
export const hasGoalRole = (goal: Goal | null | undefined): boolean => !!goal?.role?.trim();

export interface GoalResolutionInput {
  /** setup.goalSource — the member's choice. */
  source: unknown;
  /** profile.goal — what the Compass tab holds. */
  compassGoal: Goal | null | undefined;
  /** setup.intakeGoal — what intake captured. */
  intakeGoal: Goal | null | undefined;
}

export interface GoalResolution {
  /** The source actually in effect (not merely the one chosen). */
  source: GoalSource;
  /** The goal the agents should be given. */
  goal: Goal;
  /** True when intake's goal is standing in front of the Compass one. */
  overriding: boolean;
  /** True when "intake" was chosen but had no role, so Compass carried it. */
  fellBack: boolean;
}

const EMPTY: Goal = {};

/**
 * Decide which North Star the agents work from. Either process can drive at any
 * stage, and switching back is lossless because neither goal is written over
 * the other — intake's goal lives on the CareerOps setup doc, Compass's on the
 * profile.
 *
 * One safety rule: choosing intake and then leaving it blank must not strand
 * the agents with no goal at all, so an intake goal with no role falls back to
 * Compass and says it did.
 */
export function effectiveGoal({ source, compassGoal, intakeGoal }: GoalResolutionInput): GoalResolution {
  if (resolveGoalSource(source) === "intake") {
    if (hasGoalRole(intakeGoal)) {
      return { source: "intake", goal: intakeGoal as Goal, overriding: true, fellBack: false };
    }
    return { source: "compass", goal: compassGoal ?? EMPTY, overriding: false, fellBack: true };
  }
  return { source: "compass", goal: compassGoal ?? EMPTY, overriding: false, fellBack: false };
}

/** The other option, for the "switch to…" control. */
export const otherGoalSource = (s: GoalSource): GoalSource => (s === "intake" ? "compass" : "intake");

export const GOAL_SOURCE_LABELS: Record<GoalSource, string> = {
  compass: "Your Compass North Star",
  intake: "A North Star set here in intake",
};

// ---- the intake checklist ----

export type IntakeStepKey = "cv" | "northstar" | "watchlist" | "answers";

/** What intake knows about the member, from Firestore. */
export interface IntakeSignals {
  /** setup.cvMarkdown has real content. */
  hasCv: boolean;
  /** The role from whichever North Star is in effect (see effectiveGoal). */
  goalRole?: string | null;
  /** Which source that role came from, so the step can say where to change it. */
  goalSource?: GoalSource;
  /** setup.portals.companies.length */
  companies: number;
  /** How many standard answers are saved. */
  answers: number;
}

export interface IntakeStep {
  key: IntakeStepKey;
  label: string;
  /** One line on why the portal needs it. */
  detail: string;
  href: string;
  done: boolean;
  /** Optional steps count toward nothing — the portal works without them. */
  optional: boolean;
}

export const INTAKE_HREF = "/careerops/intake";

/**
 * The four things intake asks for, in the order the portal needs them. Only
 * the first three are required: without a CV, a goal and at least one watched
 * company no tool can produce anything. Standard answers only matter once the
 * member reaches the Apply screen.
 */
export function intakeSteps(s: IntakeSignals): IntakeStep[] {
  const fromIntake = resolveGoalSource(s.goalSource) === "intake";
  return [
    {
      key: "cv",
      label: "Your CV",
      detail: "The only source of truth about you. Every agent quotes lines from it as evidence.",
      href: INTAKE_HREF,
      done: s.hasCv,
      optional: false,
    },
    {
      key: "northstar",
      label: "Your North Star goal",
      detail: s.goalRole
        ? `Target role: ${s.goalRole}. ${fromIntake ? "Set here in intake — it overrides your Compass goal." : "Change it any time on the Compass tab."}`
        : "Set the role, industry, geography and salary you're aiming at — scoring is relative to it.",
      // Send them where the goal in effect actually lives.
      href: fromIntake ? INTAKE_HREF : "/compass",
      done: !!s.goalRole?.trim(),
      optional: false,
    },
    {
      key: "watchlist",
      label: "Companies to watch",
      detail: "Careers pages the Scout checks for new postings. Zero tokens — it reads the public boards.",
      href: "/careerops/setup",
      done: s.companies > 0,
      optional: false,
    },
    {
      key: "answers",
      label: "Standard answers",
      detail: "The questions every application form asks. Answer once and the Apply screen reuses them.",
      href: "/careerops/setup",
      done: s.answers > 0,
      optional: true,
    },
  ];
}

export interface IntakeProgress { done: number; total: number; pct: number }

/** Progress over the REQUIRED steps only, so an optional step can never stall it. */
export function intakeProgress(steps: IntakeStep[]): IntakeProgress {
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  const total = required.length;
  return { done, total, pct: total === 0 ? 100 : Math.round((done / total) * 100) };
}

/** Intake is over once every required step is done. */
export const intakeComplete = (steps: IntakeStep[]): boolean =>
  steps.every((s) => s.optional || s.done);

/** The next thing to do, or null when intake is complete. */
export const nextIntakeStep = (steps: IntakeStep[]): IntakeStep | null =>
  steps.find((s) => !s.optional && !s.done) ?? steps.find((s) => !s.done) ?? null;
