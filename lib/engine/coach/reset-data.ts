// Start a coach over, data included (decision 2026-11-17): the conversation goes (as before) and so does what that coach
// wrote — its owned paths (COACH_OWNED_PATHS, the same list the write path enforces) and its progress stamp. Nothing another
// coach wrote moves: a shared path (notes, contact.linkedin) is cleared only for the coach that is reset. Pure. Tested.

import type { ProfileFile } from "../../careerops/profile-file";
import type { CoachKey } from "./keys";
import { COACH_OWNED_PATHS } from "./tools";

/** The profile without this coach's keys and stamp. */
export function stripCoachData(profile: ProfileFile, coach: CoachKey): ProfileFile {
  const out = structuredClone(profile) as unknown as Record<string, unknown>;
  for (const path of COACH_OWNED_PATHS[coach] ?? []) deletePath(out, path.split("."));
  deletePath(out, ["jhg", "progress", coach]);
  prune(out);
  return out as unknown as ProfileFile;
}

function deletePath(obj: Record<string, unknown>, parts: string[]): void {
  const [head, ...rest] = parts;
  if (!(head in obj)) return;
  if (!rest.length) { delete obj[head]; return; }
  const next = obj[head];
  if (next && typeof next === "object" && !Array.isArray(next)) deletePath(next as Record<string, unknown>, rest);
}

/** Empty objects left by a deletion go too — an empty `jhg: {}` would read as a workbook. `version` always stays. */
function prune(obj: Record<string, unknown>): void {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) { prune(v as Record<string, unknown>); if (!Object.keys(v as object).length && k !== "version") delete obj[k]; }
  }
}

/** The marker the server turns into FieldValue.delete() — a merge write keeps a nested key it does not mention, so removals must be explicit at every depth. */
export const DELETE = Symbol("delete");
export type MergeDiff = { [k: string]: unknown | typeof DELETE | MergeDiff };

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * What to write, with merge, so a document shaped like `before` reads like `after`: keys gone → DELETE (recursing into objects
 * both sides have, so `jhg.targetCompanies` is deleted while `jhg.narrative` stays), changed leaves → their new value, arrays whole.
 * `null` when nothing differs.
 */
export function mergeDiff(before: Record<string, unknown>, after: Record<string, unknown>): MergeDiff | null {
  const out: MergeDiff = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[k], a = after[k];
    if (!(k in after)) { out[k] = DELETE; continue; }
    if (!(k in before)) { out[k] = a; continue; }
    if (isPlain(b) && isPlain(a)) { const d = mergeDiff(b, a); if (d) out[k] = d; continue; }
    if (JSON.stringify(b) !== JSON.stringify(a)) out[k] = a;
  }
  return Object.keys(out).length ? out : null;
}

/** The page sections a reset clears, in the member's words — for the confirmation. */
export const RESET_CLEARS: Record<CoachKey, string> = {
  narrative: "contact details, headline, core competencies, bridge story and the Narrative workbook",
  trueNorth: "the goal statement, target roles, industries, salary range, location, company type, boundaries, the postings and the True North workbook",
  targetCompanies: "the Top 40, Top 10, Top 3, the watchlist's companies, the notes and the Target companies workbook",
  storyBank: "the stories, proof points, snapshots, framing and the story facts",
  masterCv: "the Master CV, its house rules and the title",
  linkedin: "the LinkedIn profile sections",
};
