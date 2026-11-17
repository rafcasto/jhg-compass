import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { profileFromSetup, profileToSetupPatch } from "@/lib/careerops/profile-file";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import type { CoachKey } from "./keys";
import { stripCoachData } from "./reset-data";

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

  // Every setup field the coach's data reached: gone when the stripped profile no longer produces it, replaced when it changed.
  const write: Record<string, unknown> = {};
  const removed: string[] = [];
  for (const k of Object.keys(before)) {
    if (!(k in after)) { write[k] = FieldValue.delete(); removed.push(k); }
    else if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) { write[k] = after[k]; removed.push(`${k} (part)`); }
  }
  // True North's goal lives on the intake side of the setup while in effect; a reset of that coach lets Compass's goal stand again.
  if (coach === "trueNorth") { write.intakeGoal = FieldValue.delete(); write.goalSource = FieldValue.delete(); removed.push("intakeGoal", "goalSource"); }
  if (setup) {
    const nextSetup = { ...setup } as Record<string, unknown>;
    for (const [k, v] of Object.entries(write)) { if (v instanceof FieldValue) delete nextSetup[k]; else nextSetup[k] = v; }
    write.profileYaml = buildSetupProfileYaml({ profile, setup: nextSetup as unknown as CareerOpsSetupV2, overrides: {} });
    write.updatedAt = Date.now();
    await db.doc(`users/${uid}/careerOps/setup`).set(write, { merge: true });
  }
  // What the portal derived for this coach, not the member's words — Coach 3's evidence. The connections stay: they are the member's own export.
  if (coach === "targetCompanies") await db.doc(`users/${uid}/coachEvidence/companies`).delete().catch(() => undefined);
  return { conversation: true, data: true, removed };
}
