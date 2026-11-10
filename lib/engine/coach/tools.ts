// The one tool a coach has: update_profile (docs/UX_COACH.md §4). Its input schema is
// the coach's own keys, closed (strict: true), so the API itself refuses a key the coach
// does not own and the model sees exactly what it may write. Pure — tested.

import type { CoachKey } from "./keys";

export const UPDATE_PROFILE = "update_profile";

/** JSON Schema fragments, closed. */
const str = (description: string, maxLength?: number) => ({ type: "string", description, ...(maxLength ? { maxLength } : {}) });
const list = (description: string, min?: number, max?: number) => ({ type: "array", items: { type: "string" }, description, ...(min ? { minItems: min } : {}), ...(max ? { maxItems: max } : {}) });
const obj = (properties: Record<string, unknown>, description?: string) => ({ type: "object", properties, additionalProperties: false, ...(description ? { description } : {}) });

/** What each coach may write — profile.yml paths, in the schema's own shape (profile-schema.md §1–2). */
export const COACH_PATCH_SCHEMAS: Partial<Record<CoachKey, Record<string, unknown>>> = {
  narrative: obj({
    contact: obj({
      phone: str("The phone recruiters should use, as typed"),
      linkedin: str("Their LinkedIn URL exactly as it is today"),
      portfolio: str("Portfolio or GitHub Pages — absolute http(s) URL, or leave out"),
      github: str("GitHub profile URL, or leave out"),
    }, "Contact details"),
    personalization: obj({
      exitNarrative: str("The bridge story: 3–4 sentences from where they come from to where they go next, in their words. ≤ 1,200 characters.", 1200),
    }),
    narrative: obj({
      headline: str("One sentence a recruiter understands in 10 seconds: 'I help [who] achieve [outcome] through [competency 1], [2] and [3]'. ≤ 220 characters, no final full stop.", 220),
      superpowers: list("Core competencies: 3–5 short noun phrases in the market's own words, strongest first", 1, 5),
    }),
    jhg: obj({
      identity: obj({
        fullName: str("Full name as the member types it"),
        email: str("The email recruiters should use"),
        city: str("City"),
        country: str("Country"),
        location: str("'{city}, {country}'"),
        timezone: str("IANA time zone the member confirmed, e.g. Pacific/Auckland"),
        outputLanguage: str("ISO code of the language their documents are written in, default en"),
        alternateEmails: list("Other emails that are also them"),
        twitter: str("X/Twitter handle or URL, only if used professionally"),
        preferredChannel: { type: "string", enum: ["email", "phone", "either"], description: "How recruiters should reach them" },
        contactNote: str("One line recruiters should know before contacting them"),
      }),
      narrative: obj({
        leadSkills: list("The three skills behind the competencies, in the member's own words, rank order", 1, 3),
        bridgeStoryOneLine: str("The bridge story in one sentence: 'I was X, I did Y, now I do Z because W'"),
      }),
    }),
  }),
};

export const COACH_OWNED_PATHS: Partial<Record<CoachKey, readonly string[]>> = {
  narrative: ["contact.phone", "contact.linkedin", "contact.portfolio", "contact.github", "personalization.exitNarrative", "narrative.headline", "narrative.superpowers", "jhg.identity", "jhg.narrative"],
};

/** The tool definition for a coach — null for a coach whose schema is not written yet. */
export function updateProfileTool(coach: CoachKey) {
  const patch = COACH_PATCH_SCHEMAS[coach];
  if (!patch) return null;
  return {
    name: UPDATE_PROFILE,
    description: "Write what the member has just confirmed into their profile. Call it right after each yes — a confirmed table or an approved draft — with only the keys that changed; the portal merges key by key and never drops a field you leave out. Set progress to 'complete' at hand-over, once your checks pass; 'in_progress' at a save point. The result tells you what the page now shows.",
    strict: true as const,
    input_schema: {
      type: "object" as const,
      properties: {
        patch: patch,
        progress: { type: "string", enum: ["in_progress", "complete"], description: "Only at a save point or the hand-over" },
      },
      required: ["patch"],
      additionalProperties: false,
    },
  };
}

/** The paths in a patch that this coach does not own — a non-empty list refuses the write. */
export function foreignPaths(coach: CoachKey, patch: unknown, prefix = ""): string[] {
  const owned = COACH_OWNED_PATHS[coach] ?? [];
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const isOwned = owned.some((o) => o === path || path.startsWith(`${o}.`));
    if (isOwned) continue;
    const isParent = owned.some((o) => o.startsWith(`${path}.`));
    if (isParent) { out.push(...foreignPaths(coach, v, path)); continue; }
    out.push(path);
  }
  return out;
}
