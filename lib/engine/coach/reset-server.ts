import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { profileFromSetup, profileToSetupPatch } from "@/lib/careerops/profile-file";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import type { CoachKey } from "./keys";
import { DELETE, mergeDiff, stripCoachData, type MergeDiff } from "./reset-data";

// Start a coach over (docs/UX_COACH.md §7), now with its data (decision 2026-11-17): the conversation always; with `data`,
// what that coach wrote — its owned paths and its stamp — removed from careerOps/setup through the same profile ↔ setup
// mapping every write uses, the stored profile.yml rebuilt, and the coach's derived documents (Coach 3's evidence) gone.

export interface ResetCoachResult { conversation: boolean; data: boolean; removed: string[] }

export async function resetCoach(uid: string, coach: CoachKey, data: boolean): Promise<ResetCoachResult> {
  const db = adminDb();
  await db.doc(`users/${uid}/coachSessions/${coach}`).delete();
  if (!data) return { conversation: true, data: false, removed: [] };

  const [profileSnap, setupSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/careerOps/setup`).get()]);
  const profile = profileSnap.exists ? (profileSnap.data() as Profile) : null;
  const setup = setupSnap.exists ? (setupSnap.data() as CareerOpsSetupV2) : null;
  const current = profileFromSetup({ profile, setup });
  const stripped = stripCoachData(current, coach);
  const before = profileToSetupPatch(current).setup as Record<string, unknown>;
  const after = profileToSetupPatch(stripped).setup as Record<string, unknown>;

  // Every setup field the coach's data reached, at any depth: a merge write keeps a nested key it does not mention, so each
  // removed path is deleted explicitly (jhg.targetCompanies goes, jhg.narrative stays) and each changed leaf is written.
  const diff = mergeDiff(before, after) ?? {};
  const removed = removedPaths(diff);
  // True North's goal lives on the intake side of the setup while in effect; a reset of that coach lets Compass's goal stand again.
  if (coach === "trueNorth") { diff.intakeGoal = DELETE; diff.goalSource = DELETE; removed.push("intakeGoal", "goalSource"); }
  if (setup) {
    const write = toFieldValues(diff) as Record<string, unknown>;
    const nextSetup = applyDiff({ ...setup } as Record<string, unknown>, diff);
    write.profileYaml = buildSetupProfileYaml({ profile, setup: nextSetup as unknown as CareerOpsSetupV2, overrides: {} });
    write.updatedAt = Date.now();
    await db.doc(`users/${uid}/careerOps/setup`).set(write, { merge: true });
  }
  // What the portal derived for this coach, not the member's words — Coach 3's evidence. The connections stay: they are the member's own export.
  if (coach === "targetCompanies") await db.doc(`users/${uid}/coachEvidence/companies`).delete().catch(() => undefined);
  return { conversation: true, data: true, removed };
}

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The diff as Firestore takes it: the marker becomes FieldValue.delete(), nested objects stay nested (merge handles them). */
function toFieldValues(d: MergeDiff): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) out[k] = v === DELETE ? FieldValue.delete() : isPlain(v) && !(v instanceof FieldValue) && containsDelete(v as MergeDiff) ? toFieldValues(v as MergeDiff) : v;
  return out;
}
const containsDelete = (d: MergeDiff): boolean => Object.values(d).some((v) => v === DELETE || (isPlain(v) && containsDelete(v as MergeDiff)));

/** The document as it will read after the write — for the profile.yml rebuild. */
function applyDiff(doc: Record<string, unknown>, d: MergeDiff): Record<string, unknown> {
  for (const [k, v] of Object.entries(d)) {
    if (v === DELETE) delete doc[k];
    else if (isPlain(v) && isPlain(doc[k]) && containsDelete(v as MergeDiff)) doc[k] = applyDiff({ ...(doc[k] as Record<string, unknown>) }, v as MergeDiff);
    else doc[k] = v;
  }
  return doc;
}

/** The dotted paths a diff deletes — for the result line. */
function removedPaths(d: MergeDiff, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(d)) { const path = prefix ? `${prefix}.${k}` : k; if (v === DELETE) out.push(path); else if (isPlain(v) && containsDelete(v as MergeDiff)) out.push(...removedPaths(v as MergeDiff, path)); }
  return out;
}
