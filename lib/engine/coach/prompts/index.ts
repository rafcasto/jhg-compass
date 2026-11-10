// The repo defaults for each coach's prompt (decision 6: repo default, admin override in
// config/engine/prompts/coach:<key>). A coach without a default is not ready (keys.ts).

import type { CoachKey } from "../keys";
import { NARRATIVE_PROMPT, NARRATIVE_PROMPT_VERSION } from "./narrative";

export interface CoachPrompt { text: string; version: number }

export const COACH_PROMPTS: Partial<Record<CoachKey, CoachPrompt>> = {
  narrative: { text: NARRATIVE_PROMPT, version: NARRATIVE_PROMPT_VERSION },
};

/** The override key in config/engine/prompts. */
export const coachPromptKey = (coach: CoachKey) => `coach:${coach}`;
