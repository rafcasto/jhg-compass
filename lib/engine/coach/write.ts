import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { fromMaletaYaml } from "@/lib/careerops/maleta";
import { PROFILE_VERSION, mergeProfile, profileFromSetup, profileToSetupPatch, profileToYaml, type ProfileFile } from "@/lib/careerops/profile-file";
import { validateProfileFile } from "@/lib/careerops/profile-schema";
import { buildPortalsYaml } from "@/lib/careerops/portals-yaml";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2, JhgCompany, JhgTargetCompanies } from "@/lib/careerops/types";
import { deriveCompanyLists } from "./lists";
import { deriveTrueNorth } from "./derive-true-north";
import { jhFileName, jhFilePreview, jhFileProfile, shapeJhFile } from "@/lib/jobhacking/profile-files";
import { BASE_OF, type ProfilePortal } from "@/lib/jobhacking/sections";
import type { Profile } from "@/lib/types";
import { coachChecks, failedChecks, rankCompanies, readinessLine, type Check } from "./checks";
import { allCoachesComplete, coachStates, type CoachKey } from "./keys";
import { grantJobSearchOnCompletion } from "@/lib/server/grants";
import { foreignPaths } from "./tools";
import type { WriteNote } from "./transcript";

// update_profile, applied (docs/UX_COACH.md §4). The coach's patch goes down the exact
// path an uploaded file takes — validate against the schema, restrict to the coach's own
// keys, shape for its page, merge key by key, one setDoc — so the pages read the same
// whichever way the profile was written. Rebuilds profileYaml (and portalsYaml) because
// the Pi reads those strings (docs/UX_COACH.md §12).
//
// Code checks, the model converses (docs/COACH_ASSESSMENT_2026-11-16.md §1.3): the Top-40 totals and
// ranks are computed here, never by the model; at a save point or a hand-over the coach's checks run
// against the merged profile and come back in the result; a hand-over with a failed check is stored
// as in_progress — the rail's ✓ waits until the checks pass.

export class CoachWriteError extends Error {
  constructor(message: string, public details: string[] = []) { super(message); this.name = "CoachWriteError"; }
}

export interface CoachWriteInput {
  uid: string;
  coach: CoachKey;
  patch: Record<string, unknown>;
  progress?: "in_progress" | "complete";
  /** Which portal the member is on — the links in the status line go there. */
  portal: ProfilePortal;
  now?: number;
}

export interface CoachWriteResult {
  note: WriteNote;
  /** The coach's part of the profile as it now stands — the tool result the coach reads. */
  stored: string;
  /** What the validator changed on the way in (a trimmed string, a cut list) — the coach sees it and fixes it with the member. */
  warnings: string[];
  /** The hand-over checks against the merged profile — run when progress was given; empty otherwise. */
  checks: Check[];
  /** The progress actually stored: a hand-over with failed checks stays in_progress. */
  progress?: "in_progress" | "complete";
  /** One sentence on the job search's readiness — on a hand-over. */
  readiness?: string;
  /** This hand-over completed the sixth coach and switched the Job Search portal on (decision 2026-11-25). */
  jobSearchGranted?: boolean;
}

/** The readiness sentence at 6 of 6, when the portal has just been switched on — the hand-off said where it happens. */
export const SIX_OF_SIX_LINE = "All six complete — your job search is switched on. Open it from the portal switcher.";

const isoDay = (now: number) => new Date(now).toISOString().slice(0, 10);

export async function applyCoachPatch(input: CoachWriteInput): Promise<CoachWriteResult> {
  const { uid, coach, patch, portal } = input;
  const now = input.now ?? Date.now();
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new CoachWriteError("patch must be an object");

  const foreign = foreignPaths(coach, patch);
  if (foreign.length) throw new CoachWriteError(`These keys belong to another coach and were not written: ${foreign.join(", ")}`, foreign);
  // Totals and ranks are the portal's (audit #7): the model sends the four scores, code does the arithmetic.
  const tcIn = coach === "targetCompanies" ? ((patch.jhg as Record<string, unknown> | undefined)?.targetCompanies as Record<string, unknown> | undefined) : undefined;
  if (tcIn && Array.isArray(tcIn.companies)) tcIn.companies = rankCompanies(tcIn.companies as JhgCompany[]);

  const db = adminDb();
  const [profileSnap, setupSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/careerOps/setup`).get()]);
  const profile = profileSnap.exists ? (profileSnap.data() as Profile) : null;
  const setup = setupSnap.exists ? (setupSnap.data() as CareerOpsSetupV2) : null;
  const current = profileFromSetup({ profile, setup });

  // The patch as a coach file would carry it: version, the keys, and this coach's own stamp.
  const existingStamp = setup?.jhg?.progress?.[coach];
  const jhgIn = (patch.jhg && typeof patch.jhg === "object" ? patch.jhg : {}) as Record<string, unknown>;
  const incoming: Record<string, unknown> = {
    version: PROFILE_VERSION,
    ...patch,
    jhg: { ...jhgIn, progress: { [coach]: { status: input.progress ?? (existingStamp?.status === "complete" ? "complete" : "in_progress"), updated: isoDay(now) } } },
  };
  const schema = validateProfileFile(incoming);
  if (!schema.ok) throw new CoachWriteError("The write did not match the profile schema", schema.errors.map((e) => `${e.path}: ${e.message}`));

  mergeOwnBlocks(incoming, current, coach);
  // The North Star is code's, from the working material, on every write (lib/engine/coach/derive-true-north.ts) — never the model's.
  if (coach === "trueNorth") {
    const derived = deriveTrueNorth((incoming.jhg as Record<string, unknown>).trueNorth as Parameters<typeof deriveTrueNorth>[0], current.jhg?.identity);
    for (const [k, v] of Object.entries(derived)) {
      const cur = incoming[k];
      incoming[k] = typeof v === "string" ? v : { ...(cur && typeof cur === "object" ? (cur as Record<string, unknown>) : {}), ...(v as Record<string, unknown>) };
    }
  }
  // The page's lists are code's, from the working material, on every write (lib/engine/coach/lists.ts) — not the model's at hand-over.
  if (coach === "targetCompanies") {
    const tc = (incoming.jhg as Record<string, unknown>).targetCompanies as JhgTargetCompanies | undefined;
    const lists = deriveCompanyLists(tc, current.companyLists);
    if (lists) incoming.companyLists = lists;
    // The Scout's watchlist is the Top 10 in rank order, a careers URL only when the member confirmed or corrected it; the notes end
    // with the Top 3 — both the prompt's "derived" rules, in code (decision 2026-11-25). Never the model's.
    const top10 = tc?.top10 ?? [];
    if (top10.length) incoming.watchlist = { ...((incoming.watchlist as Record<string, unknown> | undefined) ?? {}), companies: top10.map((t) => ({ name: t.name, ...(t.careersUrl && (t.careersUrlStatus === "confirmed" || t.careersUrlStatus === "corrected") ? { careersUrl: t.careersUrl } : {}) })) };
    const top3 = tc?.top3 ?? [];
    if (top3.length) {
      const base = (typeof incoming.notes === "string" ? incoming.notes : current.notes ?? "").split("\n").filter((l) => l.trim() && !/^Top 3 right now:/.test(l));
      incoming.notes = [...base, `Top 3 right now: ${top3.map((t) => t.name).join(", ")}`].join("\n");
    }
  }
  const parsed = fromMaletaYaml(incoming);
  const shaped = shapeJhFile(coach, parsed, current);
  let merged = mergeProfile(current, shaped);

  // The checks run on what will be stored. A hand-over that fails one is stored as in_progress.
  const checks = input.progress ? coachChecks(coach, merged, now) : [];
  const failed = failedChecks(checks);
  let progress = input.progress;
  if (progress === "complete" && failed.length) {
    progress = "in_progress";
    const stamp = (shaped.jhg?.progress ?? {}) as Record<string, { status?: string; updated?: string }>;
    if (stamp[coach]) stamp[coach] = { ...stamp[coach], status: existingStamp?.status === "complete" ? "complete" : "in_progress" };
    merged = mergeProfile(current, shaped);
  }
  const step = profileToSetupPatch(merged).setup;
  const after: Partial<CareerOpsSetupV2> = { ...(setup ?? {}), ...step };
  const rows = jhFilePreview(coach, shaped, setup, after, profile, { portal });
  const name = jhFileName(coach, shaped);
  const accountAfter = jhFileProfile(coach, shaped, profile);

  const write: Record<string, unknown> = { ...step, profileYaml: buildSetupProfileYaml({ profile: accountAfter, setup, overrides: step }), updatedAt: now };
  if (step.portals) write.portalsYaml = buildPortalsYaml(step.portals);
  await db.doc(`users/${uid}/careerOps/setup`).set(write, { merge: true });
  // First and last name are the account's, not the profile's (docs/UX_JOBHACKING.md §4).
  const nameChanged = !!name && (name.firstName !== (profile?.firstName ?? "") || name.lastName !== (profile?.lastName ?? ""));
  if (name && nameChanged) await db.doc(`users/${uid}`).set(name, { merge: true });

  const changed = rows.filter((r) => r.inFile && r.kind !== "keep");
  const seen = new Set<string>();
  const unique = changed.filter((r) => !seen.has(r.key) && seen.add(r.key));
  // The hand-off (decision 2026-11-25): the sixth completion switches Job Search on, by code, once — never a flag the member waits on.
  const sixOfSix = progress === "complete" && allCoachesComplete(coachStates(merged.jhg?.progress as Parameters<typeof coachStates>[0]));
  const jobSearchGranted = sixOfSix ? await grantJobSearchOnCompletion(uid) : false;
  const readiness = progress === "complete" ? (sixOfSix ? SIX_OF_SIX_LINE : readinessLine(merged).line) : undefined;
  const note: WriteNote = {
    labels: unique.map((r) => r.label),
    links: unique.map((r) => ({ label: r.label, href: r.href.startsWith(BASE_OF[portal]) ? r.href : r.href })),
    ...(progress ? { progress } : {}),
    ...(readiness ? { readiness } : {}),
  };
  return { note, stored: profileToYaml(stripToCoach(merged, shaped)), warnings: schema.warnings, checks, progress, readiness, ...(jobSearchGranted ? { jobSearchGranted } : {}) };
}

/** The merged profile cut down to the top-level sections this write touched — what the coach needs to see back. */
function stripToCoach(merged: ProfileFile, shaped: ProfileFile): ProfileFile {
  const out: ProfileFile = { version: merged.version };
  for (const k of Object.keys(shaped) as (keyof ProfileFile)[]) if (k !== "version" && merged[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = merged[k];
  return out;
}

/** The jhg working block each coach owns; storyBank and masterCv share `artefacts`, which mergeProfile already merges by key. */
const JHG_BLOCK: Partial<Record<CoachKey, "narrative" | "trueNorth" | "targetCompanies">> = { narrative: "narrative", trueNorth: "trueNorth", targetCompanies: "targetCompanies" };

/**
 * mergeProfile replaces a coach's jhg working block and the `linkedin` map whole (they belong to one
 * owner — right for a file, wrong for a conversation that writes them in parts). So before the merge,
 * what the coach sends is laid over what is stored, one key deep: Part B's postings never wipe Part A's
 * boundaries; the About section never wipes the Headline. A list or a nested map is still taken whole.
 */
function mergeOwnBlocks(incoming: Record<string, unknown>, current: ProfileFile, coach: CoachKey): void {
  const block = JHG_BLOCK[coach];
  const jhgIn = incoming.jhg as Record<string, unknown>;
  if (block && jhgIn[block] && typeof jhgIn[block] === "object") {
    const stored = (current.jhg as Record<string, unknown> | undefined)?.[block];
    if (stored && typeof stored === "object") jhgIn[block] = { ...(stored as Record<string, unknown>), ...(jhgIn[block] as Record<string, unknown>) };
  }
  if (coach === "linkedin" && incoming.linkedin && typeof incoming.linkedin === "object" && current.linkedin) {
    incoming.linkedin = { ...(current.linkedin as unknown as Record<string, unknown>), ...(incoming.linkedin as Record<string, unknown>) };
  }
}
