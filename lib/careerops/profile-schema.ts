// The profile.yml schema check — the gate in front of the upload.
//
// Rule (docs/UX_PROFILE.md §2 Step 0): data may be missing, the shape may not
// be wrong. A file that fails here is refused before anything is shown; the
// review step never sees it. Unknown keys and wrong types are ERRORS with a
// path, because a typo like `goals:` must not vanish silently. Caps are
// WARNINGS: the importer truncates, and a long paragraph must not block the
// whole file.
//
// Hand-written in house style (no zod), pure, tested. Mirrors the shape in
// public/profile.example.yml and the Packer spec v2 §1–§7.

import { GOAL_KEYS } from "@/lib/goal";

export const PROFILE_SCHEMA_VERSION = 1;

export interface SchemaError { path: string; message: string }
export interface SchemaResult { ok: boolean; errors: SchemaError[]; warnings: string[] }

export const PROFILE_TOP_KEYS = ["version", "goal", "contact", "policy", "personalization", "watchlist", "notes", "cv"] as const;

const CONTACT_KEYS = ["title", "phone", "linkedin", "github", "portfolio"] as const;
const POLICY_STRING_KEYS = ["minimumSalary", "locationFlexibility", "visaStatus"] as const;
const PERSONALIZATION_KEYS = ["targetRoles", "adaptiveFraming", "exitNarrative", "crossCuttingAdvantage", "portfolio", "compTargets", "negotiationScripts", "locationPolicy"] as const;
const COMPANY_KEYS = ["name", "careersUrl", "enabled", "provider", "apiUrl"] as const;

/** Row caps, from coercePersonalization / the watchlist editor / the Packer spec. */
export const ROW_CAPS = { targetRoles: 8, adaptiveFraming: 8, negotiationScripts: 6, locationPolicy: 8, companies: 25, authorizedIn: 50 } as const;
/** Prose caps the importer truncates to. */
export const TEXT_CAPS = { exitNarrative: 1200, crossCuttingAdvantage: 600, compTargets: 800 } as const;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
// YAML `key:` with nothing after it is null — treat as absent, not as a type error.
const absent = (v: unknown) => v === undefined || v === null;

function closest(key: string, allowed: readonly string[]): string | undefined {
  const k = key.toLowerCase();
  return allowed.find((a) => a.toLowerCase() === k || a.toLowerCase() === k.replace(/s$/, "") || `${a.toLowerCase()}s` === k);
}

class Checker {
  errors: SchemaError[] = [];
  warnings: string[] = [];

  unknownKeys(obj: Record<string, unknown>, allowed: readonly string[], path: string) {
    for (const k of Object.keys(obj)) {
      if (allowed.includes(k)) continue;
      const hint = closest(k, allowed);
      this.errors.push({ path: path ? `${path}.${k}` : k, message: hint ? `unknown key (did you mean ${hint}?)` : "unknown key" });
    }
  }

  string(v: unknown, path: string): v is string {
    if (absent(v)) return false;
    if (typeof v !== "string") { this.errors.push({ path, message: `must be text, got ${describe(v)}` }); return false; }
    return true;
  }

  boolean(v: unknown, path: string) {
    if (absent(v)) return;
    if (typeof v !== "boolean") this.errors.push({ path, message: `must be true or false, got ${describe(v)}` });
  }

  stringList(v: unknown, path: string, cap?: number): v is string[] {
    if (absent(v)) return false;
    if (!Array.isArray(v)) { this.errors.push({ path, message: `must be a list of strings, got ${describe(v)}` }); return false; }
    let ok = true;
    v.forEach((x, i) => { if (!absent(x) && typeof x !== "string") { this.errors.push({ path: `${path}[${i}]`, message: `must be text, got ${describe(x)}` }); ok = false; } });
    if (cap && v.length > cap) this.warnings.push(`${path} has ${v.length} entries — only the first ${cap} are kept`);
    return ok;
  }

  /** A mapping whose keys are all in `allowed`. Returns the record, or null after recording the error. */
  mapping(v: unknown, path: string, allowed: readonly string[]): Record<string, unknown> | null {
    if (absent(v)) return null;
    if (!isRecord(v)) { this.errors.push({ path, message: `must be a group of fields, got ${describe(v)}` }); return null; }
    this.unknownKeys(v, allowed, path);
    return v;
  }

  rows(v: unknown, path: string, allowed: readonly string[], required: readonly string[], cap: number): void {
    if (absent(v)) return;
    if (!Array.isArray(v)) { this.errors.push({ path, message: `must be a list, got ${describe(v)}` }); return; }
    v.forEach((row, i) => {
      const p = `${path}[${i}]`;
      const r = this.mapping(row, p, allowed);
      if (!r) { if (!absent(row)) return; this.errors.push({ path: p, message: "empty entry" }); return; }
      for (const k of allowed) this.string(r[k], `${p}.${k}`);
      for (const k of required) if (absent(r[k]) || (typeof r[k] === "string" && !(r[k] as string).trim())) this.errors.push({ path: p, message: `missing ${k}` });
    });
    if (v.length > cap) this.warnings.push(`${path} has ${v.length} entries — only the first ${cap} are kept`);
  }

  textCap(v: unknown, path: string, cap: number) {
    if (typeof v === "string" && v.length > cap) this.warnings.push(`${path} is ${v.length} characters — trimmed to ${cap}`);
  }
}

function describe(v: unknown): string {
  if (v === null) return "nothing";
  if (Array.isArray(v)) return "a list";
  if (typeof v === "object") return "a group of fields";
  if (typeof v === "number") return `a number (${v})`;
  if (typeof v === "boolean") return `${v}`;
  return typeof v;
}

/**
 * Validate a parsed YAML document against the profile schema.
 * `ok` is false when there is at least one error; warnings never block.
 */
export function validateProfileFile(doc: unknown): SchemaResult {
  const c = new Checker();

  if (!isRecord(doc)) {
    return { ok: false, errors: [{ path: "", message: Array.isArray(doc) ? "the file is a list — a profile is a set of named sections starting with version: 1" : "the file is empty or not a set of named sections" }], warnings: [] };
  }

  // version — the one required key
  if (absent(doc.version)) c.errors.push({ path: "version", message: `missing — a profile starts with version: ${PROFILE_SCHEMA_VERSION}` });
  else if (typeof doc.version !== "number") c.errors.push({ path: "version", message: `must be the number ${PROFILE_SCHEMA_VERSION}, got ${describe(doc.version)}` });
  else if (doc.version > PROFILE_SCHEMA_VERSION) c.errors.push({ path: "version", message: `${doc.version} was written by a newer Packer — update Compass, or re-run the Packer with spec v2` });
  else if (doc.version !== PROFILE_SCHEMA_VERSION) c.errors.push({ path: "version", message: `must be ${PROFILE_SCHEMA_VERSION}, got ${doc.version}` });

  c.unknownKeys(doc, PROFILE_TOP_KEYS, "");

  // goal
  const goal = c.mapping(doc.goal, "goal", GOAL_KEYS);
  if (goal) {
    for (const k of GOAL_KEYS) c.string(goal[k], `goal.${k}`);
    if (!(typeof goal.role === "string" && goal.role.trim())) c.warnings.push("goal has no role — the North Star in the file will not count until it has a job title");
  }

  // contact
  const contact = c.mapping(doc.contact, "contact", CONTACT_KEYS);
  if (contact) for (const k of CONTACT_KEYS) c.string(contact[k], `contact.${k}`);

  // policy
  const policy = c.mapping(doc.policy, "policy", [...POLICY_STRING_KEYS, "needsSponsorship", "authorizedIn"]);
  if (policy) {
    for (const k of POLICY_STRING_KEYS) c.string(policy[k], `policy.${k}`);
    c.boolean(policy.needsSponsorship, "policy.needsSponsorship");
    c.stringList(policy.authorizedIn, "policy.authorizedIn", ROW_CAPS.authorizedIn);
  }

  // personalization — the eight sections
  const p = c.mapping(doc.personalization, "personalization", PERSONALIZATION_KEYS);
  if (p) {
    c.rows(p.targetRoles, "personalization.targetRoles", ["archetype", "axes", "buys"], ["archetype"], ROW_CAPS.targetRoles);
    c.rows(p.adaptiveFraming, "personalization.adaptiveFraming", ["role", "emphasize", "proof"], ["role", "emphasize"], ROW_CAPS.adaptiveFraming);
    for (const k of ["exitNarrative", "crossCuttingAdvantage", "compTargets"] as const) {
      c.string(p[k], `personalization.${k}`);
      c.textCap(p[k], `personalization.${k}`, TEXT_CAPS[k]);
    }
    const portfolio = c.mapping(p.portfolio, "personalization.portfolio", ["url", "description", "whenToShare"]);
    if (portfolio) {
      for (const k of ["url", "description", "whenToShare"] as const) c.string(portfolio[k], `personalization.portfolio.${k}`);
      if (typeof portfolio.url === "string" && portfolio.url.trim() && !/^https?:\/\//i.test(portfolio.url.trim())) {
        c.warnings.push("personalization.portfolio.url is not an absolute http(s) link — the portfolio section will be left out");
      }
    }
    c.stringList(p.negotiationScripts, "personalization.negotiationScripts", ROW_CAPS.negotiationScripts);
    c.stringList(p.locationPolicy, "personalization.locationPolicy", ROW_CAPS.locationPolicy);
  }

  // watchlist
  const w = c.mapping(doc.watchlist, "watchlist", ["companies", "positive", "negative"]);
  if (w) {
    if (!absent(w.companies)) {
      if (!Array.isArray(w.companies)) c.errors.push({ path: "watchlist.companies", message: `must be a list, got ${describe(w.companies)}` });
      else {
        w.companies.forEach((row, i) => {
          const path = `watchlist.companies[${i}]`;
          const r = c.mapping(row, path, COMPANY_KEYS);
          if (!r) { if (!absent(row)) return; c.errors.push({ path, message: "empty entry" }); return; }
          for (const k of ["name", "careersUrl", "provider", "apiUrl"] as const) c.string(r[k], `${path}.${k}`);
          c.boolean(r.enabled, `${path}.enabled`);
          if (!(typeof r.name === "string" && r.name.trim())) c.errors.push({ path, message: "missing name" });
          else if (!(typeof r.careersUrl === "string" && r.careersUrl.trim())) c.warnings.push(`${r.name} has no careers URL — the Scout needs the page that lists the jobs, so it is skipped`);
        });
        if (w.companies.length > ROW_CAPS.companies) c.warnings.push(`watchlist.companies has ${w.companies.length} entries — only the first ${ROW_CAPS.companies} are kept`);
      }
    }
    c.stringList(w.positive, "watchlist.positive");
    c.stringList(w.negative, "watchlist.negative");
  }

  c.string(doc.notes, "notes");
  c.string(doc.cv, "cv");

  return { ok: c.errors.length === 0, errors: c.errors, warnings: c.warnings };
}
