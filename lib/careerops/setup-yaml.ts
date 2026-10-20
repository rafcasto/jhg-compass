// ONE place that turns the CareerOps setup document into the agents' profile.yml.
//
// Why this exists: profile.yml is rebuilt from four different screens (intake's
// CV save, the North Star chooser, the contact/policy card, and the full Setup
// screen). Each used to assemble the `buildProfileYaml` arguments itself, and
// every one of them was a chance to forget a field — which is exactly what
// happened twice: the Setup screen rebuilt from the Compass goal and reverted
// an intake override, and nothing ever passed the contact fields the Pi worker
// reads. A screen now says WHAT CHANGED and this decides what the file says.
import type { Profile } from "@/lib/types";
import { buildProfileYaml } from "./profile-yaml";
import { effectiveGoal } from "./intake";
import { renderProfileMd } from "./personalization";
import type { CareerOpsSetupV2 } from "./types";

/** The slice of the setup document that reaches profile.yml. */
export type SetupYamlFields = Pick<CareerOpsSetupV2, "goalSource" | "intakeGoal" | "contact" | "policy" | "notes" | "personalization">;

export interface SetupYamlInput {
  profile: Profile | null | undefined;
  /** What is already saved. */
  setup: CareerOpsSetupV2 | null | undefined;
  /** The edits a screen is about to write, if any. Each key overrides `setup`. */
  overrides?: Partial<SetupYamlFields>;
}

/**
 * The fields as they WILL be once `overrides` is saved — so a screen can render
 * a preview and write the file from the same source of truth.
 */
export function resolveSetupFields({ setup, overrides = {} }: Pick<SetupYamlInput, "setup" | "overrides">): SetupYamlFields {
  const pick = <K extends keyof SetupYamlFields>(k: K): SetupYamlFields[K] =>
    k in overrides ? overrides[k] : setup?.[k];
  return {
    goalSource: pick("goalSource"),
    intakeGoal: pick("intakeGoal"),
    contact: pick("contact"),
    policy: pick("policy"),
    notes: pick("notes"),
    personalization: pick("personalization"),
  };
}

/** profile.yml for this member, from everything Compass knows about them. */
export function buildSetupProfileYaml({ profile, setup, overrides }: SetupYamlInput): string {
  const f = resolveSetupFields({ setup, overrides });
  const goal = effectiveGoal({ source: f.goalSource, compassGoal: profile?.goal, intakeGoal: f.intakeGoal });
  return buildProfileYaml({
    profile,
    goal: goal.goal,
    notes: f.notes ?? "",
    contact: f.contact,
    policy: f.policy,
    personalization: f.personalization,
  });
}

/**
 * The rendered modes/_profile.md for this member.
 *
 * NOTE: the Pi worker does not read this yet — its prompt builders take `cv`
 * and `profileYaml` only (careerops-worker/lib/prompts). The sections that have
 * a profile.yml home (exit_story, superpowers, dashboard) therefore DO reach
 * the agents today via buildSetupProfileYaml; the rest are stored ready for a
 * worker change. Storing it now means the member only fills it in once.
 */
export function buildSetupProfileMd({ setup, overrides }: Pick<SetupYamlInput, "setup" | "overrides">): string {
  return renderProfileMd(resolveSetupFields({ setup, overrides }).personalization);
}

/**
 * Everything a whole-document `setDoc` must carry so an unrelated save cannot
 * drop it. Keys the member has never set stay absent rather than being written
 * as undefined (Firestore rejects undefined) or as defaults.
 */
export function preserveSetupFields(setup: CareerOpsSetupV2 | null | undefined): Partial<SetupYamlFields> {
  const out: Partial<SetupYamlFields> = {};
  if (setup?.goalSource) out.goalSource = setup.goalSource;
  if (setup?.intakeGoal) out.intakeGoal = setup.intakeGoal;
  if (setup?.contact) out.contact = setup.contact;
  if (setup?.policy) out.policy = setup.policy;
  if (setup?.personalization) out.personalization = setup.personalization;
  return out;
}
