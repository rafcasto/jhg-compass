// The repo defaults for each coach's prompt (decision 6: repo default, admin override in
// config/engine/prompts/coach:<key>), and the knowledge file each one carries — a second
// cached system block, the Gem's knowledge attachment.

import type { CoachKey } from "../keys";
import { NARRATIVE_PROMPT, NARRATIVE_PROMPT_VERSION } from "./narrative";
import { TRUE_NORTH_PROMPT, TRUE_NORTH_PROMPT_VERSION } from "./true-north";
import { TARGET_COMPANIES_PROMPT, TARGET_COMPANIES_PROMPT_VERSION } from "./target-companies";
import { STORY_BANK_PROMPT, STORY_BANK_PROMPT_VERSION } from "./story-bank";
import { MASTER_CV_PROMPT, MASTER_CV_PROMPT_VERSION } from "./master-cv";
import { LINKEDIN_PROMPT, LINKEDIN_PROMPT_VERSION } from "./linkedin";
import { GROWTH_SOURCE_DIRECTORY } from "./knowledge/growth-sources";
import { VALUE_PROOF_LIBRARY } from "./knowledge/value-proof";

export interface CoachPrompt { text: string; version: number; knowledge?: string }

export const COACH_PROMPTS: Record<CoachKey, CoachPrompt> = {
  narrative: { text: NARRATIVE_PROMPT, version: NARRATIVE_PROMPT_VERSION },
  trueNorth: { text: TRUE_NORTH_PROMPT, version: TRUE_NORTH_PROMPT_VERSION, knowledge: GROWTH_SOURCE_DIRECTORY },
  targetCompanies: { text: TARGET_COMPANIES_PROMPT, version: TARGET_COMPANIES_PROMPT_VERSION, knowledge: GROWTH_SOURCE_DIRECTORY },
  storyBank: { text: STORY_BANK_PROMPT, version: STORY_BANK_PROMPT_VERSION, knowledge: VALUE_PROOF_LIBRARY },
  masterCv: { text: MASTER_CV_PROMPT, version: MASTER_CV_PROMPT_VERSION, knowledge: VALUE_PROOF_LIBRARY },
  linkedin: { text: LINKEDIN_PROMPT, version: LINKEDIN_PROMPT_VERSION },
};

/** The override key in config/engine/prompts. */
export const coachPromptKey = (coach: CoachKey) => `coach:${coach}`;
