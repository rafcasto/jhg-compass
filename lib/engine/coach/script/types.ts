// The scripted coach (decision C, docs/DECISION_PROFILE_INTERFACE_2026-11-25.md; the panel in docs/UX_SCRIPTED_COACH.md):
// a coach's conversation replaced by predefined steps, one decision each, read from and written to the same profile keys
// the model's conversation writes. Pure contract — no React, no Firebase — so a script is tested like `parts.ts`.
//
// A step is the question, its fields, how to read the stored answer back, the patch it writes (through
// `applyCoachPatch`, like every write), and one line for the transcript. The engine (`index.ts`) walks a script the way
// `COACH_PARTS` walks a coach: the current step is the first whose answer is not stored.

import type { ProfileFile } from "../../../careerops/profile-file";
import type { EngineJobType } from "../../keys";
import type { CoachKey } from "../keys";
import type { JhSectionKey } from "../../../jobhacking/sections";

/** The widget a field renders as (docs/UX_SCRIPTED_COACH.md §3). */
export type FieldKind =
  | "text"      // one line
  | "textarea"  // a cap over 200
  | "number"    // the member's own formatting, kept as a string; validated as a number
  | "pick"      // ≤ 4 options: a Segmented; more: a native select
  | "chips"     // a free list — typed text stays local, the parsed list is emitted (KeywordArea's rule)
  | "multi"     // checkbox rows over options code built, min / max
  | "bucket";   // one row per item, one of `options` per row

export interface FieldOption { value: string; label: string; hint?: string }

export interface StepField {
  key: string;
  label: string;
  kind: FieldKind;
  /** pick · bucket: the choices; multi: the rows to tick. */
  options?: FieldOption[];
  /** bucket: the rows, each gets one of `options`. */
  rows?: string[];
  placeholder?: string;
  help?: string;
  optional?: boolean;
  /** text / textarea: the character cap; chips / multi: the most items. */
  max?: number;
  /** multi: the fewest items. */
  min?: number;
}

/** A field's value: a string, a list, or (bucket) item → choice. */
export type FieldValue = string | string[] | Record<string, string>;
export type StepValues = Record<string, FieldValue | undefined>;

/** What a step needs to know beyond the profile: the member's recent engine jobs (a job step waits on one). */
export interface JobLike { id: string; type: string; status: string; createdAt?: number; endedAt?: number; result?: unknown; error?: string }
export interface StepContext { jobs: readonly JobLike[] }

export interface StepJob {
  type: EngineJobType;
  /** The job's payload from the step's values — titles, boards, region. */
  payload: (values: StepValues, p: ProfileFile) => Record<string, unknown>;
  /** The button's word: *Read the postings*. */
  action: string;
}

export interface Step {
  id: string;
  /** Index into COACH_PARTS[coach] — the Part line while this step is in the slot. */
  part: number;
  /** The one bold line. */
  question: string;
  /** ≤ 2 lines, mute. */
  help?: string;
  /** The prompt's own line, said once — on the first step of a part. */
  aside?: string;
  /** "fields" (default) · "review" (points at the page, writes a save point) · "job" (starts an engine job, waits on it). */
  kind?: "fields" | "review" | "job";
  /** The fields — static, or built from the stored profile (keepers from the postings' phrases). */
  fields: StepField[] | ((p: ProfileFile) => StepField[]);
  /** *I don't know yet*: the step may be answered with its `skipValues`. */
  skipValues?: StepValues;
  /** The sections this step writes — the write line and its View › link. */
  sections: JhSectionKey[];
  /** Shown only once the profile holds what it needs (titles need postings). Default: always. */
  available?: (p: ProfileFile, ctx: StepContext) => boolean;
  /** The stored profile holds this step's answer. */
  done: (p: ProfileFile, ctx: StepContext) => boolean;
  /** The stored answer, for Back / Change — empty when none. */
  read: (p: ProfileFile) => StepValues;
  /** The write — the coach's own keys, in the schema's shape. */
  patch: (values: StepValues, p: ProfileFile) => Record<string, unknown>;
  /** The member's block in the transcript, in the answer's own words. */
  summary: (values: StepValues) => string;
  /** Cross-field rules — field key → one line. Required fields are checked by the engine. */
  validate?: (values: StepValues) => Record<string, string>;
  /** A review step's save point. */
  progress?: "in_progress" | "complete";
  /** A job step. */
  job?: StepJob;
  /** The primary's word when not *Continue*. */
  action?: string;
}

export interface CoachScript {
  coach: CoachKey;
  steps: readonly Step[];
}
