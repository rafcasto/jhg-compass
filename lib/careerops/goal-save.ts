// One goal, wherever it is edited — decision 2026-11-07.
//
// The goal has two homes (intake.ts): the Compass goal on users/{uid}, and the
// intake override on the CareerOps setup document, which an uploaded
// true-north.yml sets (goalSource: "intake"). Until today the Compass tab's
// statement read only its own home, so a job title saved on JobHacking → True
// North after an upload never reached it, and a Compass edit never reached the
// True North statement. Now every statement reads the goal IN EFFECT
// (`goalInEffect`) and every save writes the home in effect (`goalWrites`), so
// the Compass tab, True North and the agents' profile.yml move together.
// Pure — no Firestore here; the screens do the writes. Tested.

import { effectiveGoal, resolveGoalSource } from "./intake";
import { EMPTY_GOAL, goalFromProfile, normalizeGoal, type Goal } from "../goal";
import type { CareerOpsSetupV2 } from "./types";
import type { Profile } from "../types";

export interface GoalHomes {
  setup: CareerOpsSetupV2 | null | undefined;
  profile: Profile | null | undefined;
}

/** The goal every statement shows — the upload's while it is in effect, else the Compass one (legacy onboarding fields included). */
export function goalInEffect({ setup, profile }: GoalHomes): Goal {
  const r = effectiveGoal({ source: setup?.goalSource, compassGoal: goalFromProfile(profile), intakeGoal: setup?.intakeGoal });
  return { ...EMPTY_GOAL, ...r.goal };
}

export interface GoalWrites {
  /** Merged onto the setup document (empty when the Compass goal is the one in effect). */
  setupPatch: Partial<Pick<CareerOpsSetupV2, "goalSource" | "intakeGoal" | "goalUpdatedAt">>;
  /** Merged onto users/{uid}; null when the intake goal is the one in effect. */
  profilePatch: Pick<Profile, "goal" | "goalUpdatedAt"> | null;
  /** The account as it will read once written — for building the agents' profile.yml. */
  nextProfile: Profile | null | undefined;
  /** The goal as written: trimmed, company type normalised. */
  goal: Goal;
}

/** What a save of `goal` writes, and where: the home in effect, never the other. */
export function goalWrites({ setup, profile }: GoalHomes, goal: Goal, now = Date.now()): GoalWrites {
  const next = normalizeGoal({ ...EMPTY_GOAL, ...goal });
  if (resolveGoalSource(setup?.goalSource) === "intake") {
    return { setupPatch: { goalSource: "intake", intakeGoal: next, goalUpdatedAt: now }, profilePatch: null, nextProfile: profile, goal: next };
  }
  return { setupPatch: {}, profilePatch: { goal: next, goalUpdatedAt: now }, nextProfile: { ...(profile ?? { email: "" }), goal: next }, goal: next };
}
