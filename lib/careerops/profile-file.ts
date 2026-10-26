// profile.yml — the member's whole profile as one file.
//
// This is the "profile" face of lib/careerops/maleta.ts (the earlier name,
// retired — see CLAUDE.md). It owns the strict path the Profile page uses:
//
//   read   .yml only → JSON_SCHEMA parse → validateProfileFile → map → contents
//   write  profileToYaml, with a header that says what the file is
//
// The legacy readers (career-ops config/profile.yml, modes/_profile.md) are
// deliberately not reachable from here: a strict validator needs one shape.
//
// UNTRUSTED INPUT, as ever: strings are extracted, never obeyed.

import { JSON_SCHEMA, dump as yamlDump, load as yamlLoad } from "js-yaml";
import {
  MALETA_MAX_BYTES,
  MALETA_VERSION,
  fromMaletaYaml,
  maletaContents,
  maletaFromSetup,
  maletaToSetupPatch,
  type Maleta,
  type MaletaPatch,
} from "./maleta";
import { validateProfileFile, type SchemaError } from "./profile-schema";

export type ProfileFile = Maleta;
export type ProfilePatch = MaletaPatch;

export const PROFILE_VERSION = MALETA_VERSION;
export const PROFILE_FILENAME = "profile.yml";
export const PROFILE_MAX_BYTES = MALETA_MAX_BYTES;
export const PROFILE_ACCEPT = ".yml,.yaml,application/yaml,application/x-yaml,text/yaml";
export const isProfileFileName = (name: string): boolean => /\.ya?ml$/i.test(name);

export const profileFromSetup = maletaFromSetup;
export const profileToSetupPatch = maletaToSetupPatch;
export const profileContents = maletaContents;

/** The profile as YAML. Key order mirrors the Packer spec (goal first, CV last). */
export function profileToYaml(p: ProfileFile): string {
  const doc = {
    version: p.version || PROFILE_VERSION,
    goal: p.goal,
    contact: p.contact,
    policy: p.policy,
    personalization: p.personalization,
    watchlist: p.watchlist,
    notes: p.notes,
    cv: p.cv,
  };
  const body = yamlDump(JSON.parse(JSON.stringify(doc)), { lineWidth: 100, noRefs: true, skipInvalid: true });
  return [
    "# Your JobHacker Compass profile — everything the agents know about you, in one file.",
    "# Upload it again any time; anything the file doesn't mention is left as it is.",
    `# version: ${p.version || PROFILE_VERSION}`,
    "",
    body,
  ].join("\n");
}

export interface ProfileFileParse {
  ok: boolean;
  profile: ProfileFile;
  /** What was recognised, for the review step. */
  found: string[];
  /** Non-fatal: caps that will trim, companies without a URL, a goal with no role. */
  warnings: string[];
  /** Schema errors with a path. Non-empty exactly when the shape is wrong. */
  errors: SchemaError[];
  /** One line for anything that is not a schema error: wrong extension, too big, not YAML, empty. */
  error?: string;
}

const empty = (text: string = ""): ProfileFileParse => ({ ok: false, profile: { version: PROFILE_VERSION }, found: [], warnings: [], errors: [], error: text });

/**
 * Read a profile.yml. Refuses anything that is not a .yml/.yaml in the
 * `version: 1` schema; a shape error lists every problem with its path.
 */
export function parseProfileFile(text: string, filename?: string): ProfileFileParse {
  if (filename && !isProfileFileName(filename)) return empty("A profile is a .yml file. Export yours from the Profile page, or download the example and fill it in.");
  if (!text?.trim()) return empty("That file is empty.");
  if (text.length > PROFILE_MAX_BYTES) return empty(`That file is ${Math.round(text.length / 1024)} kB — the limit is ${PROFILE_MAX_BYTES / 1024} kB.`);

  let doc: unknown;
  try {
    doc = yamlLoad(text, { schema: JSON_SCHEMA });
  } catch (e) {
    return empty(`That YAML didn't parse: ${e instanceof Error ? e.message.split("\n")[0] : "unknown error"}`);
  }

  const schema = validateProfileFile(doc);
  if (!schema.ok) return { ...empty(), errors: schema.errors, warnings: schema.warnings, error: undefined };

  const profile = fromMaletaYaml(doc as Record<string, unknown>);
  const found = profileContents(profile);
  if (!found.length) return { ...empty("The file is valid but has nothing in it — no section to unpack."), warnings: schema.warnings };
  return { ok: true, profile, found, warnings: schema.warnings, errors: [] };
}
