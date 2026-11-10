import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { fromMaletaYaml } from "@/lib/careerops/maleta";
import { PROFILE_VERSION, mergeProfile, profileFromSetup, profileToSetupPatch, profileToYaml, type ProfileFile } from "@/lib/careerops/profile-file";
import { validateProfileFile } from "@/lib/careerops/profile-schema";
import { buildPortalsYaml } from "@/lib/careerops/portals-yaml";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import { jhFileName, jhFilePreview, jhFileProfile, shapeJhFile } from "@/lib/jobhacking/profile-files";
import { BASE_OF, type ProfilePortal } from "@/lib/jobhacking/sections";
import type { Profile } from "@/lib/types";
import type { CoachKey } from "./keys";
import { foreignPaths } from "./tools";
import type { WriteNote } from "./transcript";

// update_profile, applied (docs/UX_COACH.md §4). The coach's patch goes down the exact
// path an uploaded file takes — validate against the schema, restrict to the coach's own
// keys, shape for its page, merge key by key, one setDoc — so the pages read the same
// whichever way the profile was written. Rebuilds profileYaml (and portalsYaml) because
// the Pi reads those strings (docs/UX_COACH.md §12).

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
}

const isoDay = (now: number) => new Date(now).toISOString().slice(0, 10);

export async function applyCoachPatch(input: CoachWriteInput): Promise<CoachWriteResult> {
  const { uid, coach, patch, portal } = input;
  const now = input.now ?? Date.now();
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new CoachWriteError("patch must be an object");

  const foreign = foreignPaths(coach, patch);
  if (foreign.length) throw new CoachWriteError(`These keys belong to another coach and were not written: ${foreign.join(", ")}`, foreign);

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

  const parsed = fromMaletaYaml(incoming);
  const shaped = shapeJhFile(coach, parsed, current);
  const merged = mergeProfile(current, shaped);
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
  const note: WriteNote = {
    labels: unique.map((r) => r.label),
    links: unique.map((r) => ({ label: r.label, href: r.href.startsWith(BASE_OF[portal]) ? r.href : r.href })),
    ...(input.progress ? { progress: input.progress } : {}),
  };
  return { note, stored: profileToYaml(stripToCoach(merged, shaped)) };
}

/** The merged profile cut down to the top-level sections this write touched — what the coach needs to see back. */
function stripToCoach(merged: ProfileFile, shaped: ProfileFile): ProfileFile {
  const out: ProfileFile = { version: merged.version };
  for (const k of Object.keys(shaped) as (keyof ProfileFile)[]) if (k !== "version" && merged[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = merged[k];
  return out;
}
