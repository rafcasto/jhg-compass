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

export const PROFILE_TOP_KEYS = ["version", "goal", "contact", "policy", "personalization", "watchlist", "companyLists", "notes", "cv", "narrative", "stories", "snapshots", "linkedin", "jhg"] as const;

// `location` is in the storage model (CareerOpsContact → candidate.location) and in every export; the file must take it back.
const CONTACT_KEYS = ["title", "phone", "linkedin", "github", "portfolio", "location"] as const;
const POLICY_STRING_KEYS = ["minimumSalary", "locationFlexibility", "visaStatus"] as const;
const PERSONALIZATION_KEYS = ["targetRoles", "adaptiveFraming", "exitNarrative", "crossCuttingAdvantage", "portfolio", "compTargets", "negotiationScripts", "locationPolicy"] as const;
const COMPANY_KEYS = ["name", "careersUrl", "enabled", "provider", "apiUrl"] as const;
// companyLists — the Packer's ranked lists (added 2026-11-05). `all` is the whole field, shown as "Top 40".
export const COMPANY_LIST_KEYS = ["top3", "top10", "all"] as const;
export const COMPANY_TREND_KEYS = ["sunrise", "sunset", "unclassified"] as const;
const RANKED_KEYS = ["rank", "name", "industry", "subSector", "companyType", "careersUrl", "careersUrlStatus", "scores"] as const;
export const CAREERS_URL_STATUSES = ["confirmed", "opened_by_coach", "corrected", "none"] as const;
/** The Packer's scores on a ranked company — each 1–5, `total` their sum. */
export const SCORE_KEYS = ["growth", "interest", "access", "proof", "total"] as const;
// The artefact rows as the Packer writes them since 2026-11-07: STAR-R stories, snapshots with their context, proof points with a URL.
export const PROOF_POINT_KEYS = ["name", "heroMetric", "url"] as const;
export const STORY_KEYS = ["id", "title", "situation", "task", "action", "result", "reflection", "provenance"] as const;
export const SNAPSHOT_KEYS = ["company", "storyId", "title", "context", "challenge", "role", "activities", "results", "relevance", "keyDecisions"] as const;
const SNAPSHOT_LIST_KEYS = ["activities", "results", "keyDecisions"] as const;
export const NARRATIVE_KEYS = ["proofPoints", "headline", "superpowers"] as const;
// jhg — the JobHackers workbook the Packer files carry (added 2026-11-07; six files since 2026-11-09). One spec per block, checked like the rest.
export const JHG_KEYS = ["progress", "identity", "narrative", "trueNorth", "targetCompanies", "artefacts"] as const;
export const JHG_FILE_KEYS = ["narrative", "trueNorth", "targetCompanies", "storyBank", "masterCv", "linkedin"] as const;
// linkedin — one block per LinkedIn section (added 2026-11-05). Text limits are LinkedIn's own; a block over
// its limit is kept whole and said once — the panel shows it as over, which is the point of knowing the limit.
export const LINKEDIN_KEYS = ["headline", "about", "experience", "featured", "skills", "education", "certifications"] as const;
export const LINKEDIN_FEATURED_KINDS = ["link", "post", "article", "document"] as const;
const LINKEDIN_EXPERIENCE_KEYS = ["title", "company", "location", "start", "end", "description", "skills"] as const;
export const LINKEDIN_LIMITS = { headline: 220, about: 2600, description: 2000, skills: 50, roleSkills: 5 } as const;

/** Row caps, from coercePersonalization / the watchlist editor / the Packer spec. */
export const ROW_CAPS = { targetRoles: 8, adaptiveFraming: 8, negotiationScripts: 6, locationPolicy: 8, companies: 25, authorizedIn: 50, proofPoints: 50, stories: 50, snapshots: 50, rankedCompanies: 50, experience: 20, featured: 10, education: 10, certifications: 20, jhgRows: 100 } as const;
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

  unknownKeys(obj: Record<string, unknown>, allowed: readonly string[], path: string, lenient = false) {
    for (const k of Object.keys(obj)) {
      if (allowed.includes(k)) continue;
      const hint = closest(k, allowed);
      const where = path ? `${path}.${k}` : k;
      // The workbook is the Packer's and grows with it: a key this version does not know is kept and said, not refused.
      if (lenient) this.warnings.push(`${where} is new to Compass — kept as it is, not shown yet`);
      else this.errors.push({ path: where, message: hint ? `unknown key (did you mean ${hint}?)` : "unknown key" });
    }
  }

  string(v: unknown, path: string): v is string {
    if (absent(v)) return false;
    if (typeof v !== "string") { this.errors.push({ path, message: `must be text, got ${describe(v)}` }); return false; }
    return true;
  }

  number(v: unknown, path: string) {
    if (absent(v)) return;
    if (typeof v !== "number" || !Number.isFinite(v)) this.errors.push({ path, message: `must be a number, got ${describe(v)}` });
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
  mapping(v: unknown, path: string, allowed: readonly string[], lenient = false): Record<string, unknown> | null {
    if (absent(v)) return null;
    if (!isRecord(v)) { this.errors.push({ path, message: `must be a group of fields, got ${describe(v)}` }); return null; }
    this.unknownKeys(v, allowed, path, lenient);
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

  /** A mapping against a declared shape: every key named, every value the kind it says. `lenient`: an unknown key is a warning, kept. */
  shape(v: unknown, path: string, spec: Shape, lenient = false): void {
    const m = this.mapping(v, path, Object.keys(spec), lenient);
    if (!m) return;
    for (const [k, kind] of Object.entries(spec)) this.kind(m[k], path ? `${path}.${k}` : k, kind, lenient);
  }

  private kind(v: unknown, path: string, kind: Kind, lenient = false): void {
    if (absent(v)) return;
    if (kind === "string") { this.string(v, path); return; }
    if (kind === "number") { this.number(v, path); return; }
    if (kind === "string[]") { this.stringList(v, path); return; }
    if ("map" in kind) { this.shape(v, path, kind.map, lenient); return; }
    if ("record" in kind) {
      const m = this.mapping(v, path, kind.keys, lenient);
      if (m) for (const k of kind.keys) this.kind(m[k], `${path}.${k}`, kind.record, lenient);
      return;
    }
    // rows
    if (!Array.isArray(v)) { this.errors.push({ path, message: `must be a list, got ${describe(v)}` }); return; }
    v.forEach((row, i) => {
      const p = `${path}[${i}]`;
      const r = this.mapping(row, p, Object.keys(kind.rows), lenient);
      if (!r) { if (!absent(row)) return; this.errors.push({ path: p, message: "empty entry" }); return; }
      for (const [k, kk] of Object.entries(kind.rows)) this.kind(r[k], `${p}.${k}`, kk, lenient);
      for (const k of kind.required ?? []) if (absent(r[k]) || (typeof r[k] === "string" && !(r[k] as string).trim())) this.errors.push({ path: p, message: `missing ${k}` });
    });
    if (v.length > ROW_CAPS.jhgRows) this.warnings.push(`${path} has ${v.length} entries — only the first ${ROW_CAPS.jhgRows} are kept`);
  }
}

// A tiny declarative shape language for the workbook: enough to say "a list of rows with these string keys",
// no more. Hand-written on purpose (house style — no zod), and read by the coercer in maleta.ts too.
export type Kind = "string" | "number" | "string[]" | { map: Shape } | { rows: Shape; required?: readonly string[] } | { record: Kind; keys: readonly string[] };
export type Shape = Record<string, Kind>;

export const SCORES_SHAPE: Shape = Object.fromEntries(SCORE_KEYS.map((k) => [k, "number"]));
const SUB_SECTOR_ROW: Shape = { name: "string", growthSignal: "string", source: "string", outlook: "string", confirmed: "string" };

export const JHG_SHAPE: Shape = {
  progress: { record: { map: { status: "string", updated: "string" } }, keys: JHG_FILE_KEYS },
  identity: { map: { fullName: "string", email: "string", city: "string", country: "string", location: "string", timezone: "string", outputLanguage: "string", alternateEmails: "string[]", preferredChannel: "string", contactNote: "string" } },
  narrative: { map: { leadSkills: "string[]", bridgeStoryOneLine: "string" } },
  trueNorth: { map: {
    boundaries: { map: {
      currency: "string", salaryLower: "string", salaryUpper: "string", salaryFloor: "string",
      authorizedIn: "string[]", needsSponsorship: "string", visaStatus: "string",
      willWorkIn: "string", exclude: "string", remote: "string", localHybrid: "string", relocate: "string", remoteTravel: "string",
      hardNos: "string[]", cultureMustHaves: "string[]", deprioritizeIfAbsent: "string", softDislikes: "string[]",
      noticePeriodDays: "number", excludeLevels: "string[]", neverApply: "string[]", negotiationLines: "string[]",
    } },
    postings: { rows: { title: "string", company: "string", location: "string", url: "string", phrases: "string[]", verified: "string" }, required: ["title"] },
    keepers: "string[]",
    titles: { map: { target: "string[]", analog: "string[]", exclude: "string[]" } },
    clusters: { rows: { name: "string", titles: "string[]", axes: "string[]", buys: "string", level: "string", fit: "string" }, required: ["name"] },
    industries: { rows: { name: "string", subSectors: { rows: SUB_SECTOR_ROW, required: ["name"] } }, required: ["name"] },
    companyType: "string",
  } },
  targetCompanies: { map: {
    companies: { rows: {
      rank: "number", name: "string", companyType: "string", inspiredBy: "string", industry: "string", subSector: "string", outlook: "string", location: "string", website: "string",
      growthSignal: "string", growthSource: "string", knownContact: "string", careersUrl: "string", careersUrlStatus: "string", scores: { map: SCORES_SHAPE },
    }, required: ["name"] },
    // Sub-sectors the coach looked at beyond the True North industries (the Packer, 2026-11-07).
    extraSubSectors: { rows: { ...SUB_SECTOR_ROW, industry: "string" }, required: ["name"] },
    challenges: { rows: { company: "string", challenge: "string", resolution: "string" }, required: ["company"] },
    top10: { rows: { rank: "number", name: "string", careersUrl: "string", careersUrlStatus: "string", careersUrlNote: "string", hiringAuthorityTitle: "string", knownPerson: "string", thesis: "string", businessProblem: "string", sayItLoud: "string" }, required: ["name"] },
    top3: { rows: { name: "string", whyNow: "string", firstMove: "string", byDate: "string" }, required: ["name"] },
  } },
  artefacts: { map: {
    storyFacts: { rows: { id: "string", title: "string", role: "string", leadSkill: "string", numbers: "string[]", sourceStatus: "string", sourceNote: "string" }, required: ["title"] },
    currentDomain: "string",
    cvHouseRules: "string[]",
    lockedSections: "string[]",
    languageLearning: { rows: { language: "string", currentLevel: "string", targetLevel: "string", targetDate: "string", sentence: "string", countries: "string[]" }, required: ["language"] },
    linkedinPublicUrl: "string",
  } },
};

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
          // Kept (decision 2026-11-03): the member fills the URL in later under Target companies; the Scout skips it until then.
          else if (!(typeof r.careersUrl === "string" && r.careersUrl.trim())) c.warnings.push(`${r.name} has no careers URL — kept, but the Scout skips it until you add the page that lists the jobs`);
        });
        if (w.companies.length > ROW_CAPS.companies) c.warnings.push(`watchlist.companies has ${w.companies.length} entries — only the first ${ROW_CAPS.companies} are kept`);
      }
    }
    c.stringList(w.positive, "watchlist.positive");
    c.stringList(w.negative, "watchlist.negative");
  }

  // companyLists — top3 · top10 · all, each sunrise · sunset · unclassified, rows ranked by the Packer
  const lists = c.mapping(doc.companyLists, "companyLists", COMPANY_LIST_KEYS);
  if (lists) {
    for (const k of COMPANY_LIST_KEYS) {
      const list = c.mapping(lists[k], `companyLists.${k}`, COMPANY_TREND_KEYS);
      if (!list) continue;
      for (const t of COMPANY_TREND_KEYS) {
        const rows = list[t];
        const path = `companyLists.${k}.${t}`;
        if (absent(rows)) continue;
        if (!Array.isArray(rows)) { c.errors.push({ path, message: `must be a list, got ${describe(rows)}` }); continue; }
        rows.forEach((row, i) => {
          const p = `${path}[${i}]`;
          const r = c.mapping(row, p, RANKED_KEYS);
          if (!r) { if (!absent(row)) return; c.errors.push({ path: p, message: "empty entry" }); return; }
          c.number(r.rank, `${p}.rank`);
          for (const f of ["name", "industry", "subSector", "companyType", "careersUrl", "careersUrlStatus"] as const) c.string(r[f], `${p}.${f}`);
          c.shape(r.scores, `${p}.scores`, SCORES_SHAPE);
          if (!(typeof r.name === "string" && r.name.trim())) c.errors.push({ path: p, message: "missing name" });
          // A status outside the four is a value, not a shape: kept as unknown, said once.
          else if (typeof r.careersUrlStatus === "string" && !(CAREERS_URL_STATUSES as readonly string[]).includes(r.careersUrlStatus)) {
            c.warnings.push(`${p}.careersUrlStatus is "${r.careersUrlStatus}" — expected confirmed, opened_by_coach, corrected or none; ignored`);
          }
        });
        if (rows.length > ROW_CAPS.rankedCompanies) c.warnings.push(`${path} has ${rows.length} entries — only the first ${ROW_CAPS.rankedCompanies} are kept`);
      }
    }
  }

  c.string(doc.notes, "notes");
  c.string(doc.cv, "cv");

  // artefacts — narrative.proofPoints · stories · snapshots (Packer spec; added 2026-11-03), plus the
  // narrative headline and superpowers, STAR-R stories and snapshot context (the four-file Packer, 2026-11-07)
  const nar = c.mapping(doc.narrative, "narrative", NARRATIVE_KEYS);
  if (nar) {
    c.rows(nar.proofPoints, "narrative.proofPoints", PROOF_POINT_KEYS, ["name"], ROW_CAPS.proofPoints);
    c.string(nar.headline, "narrative.headline");
    c.stringList(nar.superpowers, "narrative.superpowers");
  }
  c.rows(doc.stories, "stories", STORY_KEYS, ["title"], ROW_CAPS.stories);
  if (!absent(doc.snapshots)) {
    if (!Array.isArray(doc.snapshots)) c.errors.push({ path: "snapshots", message: `must be a list, got ${describe(doc.snapshots)}` });
    else {
      doc.snapshots.forEach((row, i) => {
        const path = `snapshots[${i}]`;
        const r = c.mapping(row, path, SNAPSHOT_KEYS);
        if (!r) { if (!absent(row)) return; c.errors.push({ path, message: "empty entry" }); return; }
        for (const k of SNAPSHOT_KEYS) if (!(SNAPSHOT_LIST_KEYS as readonly string[]).includes(k)) c.string(r[k], `${path}.${k}`);
        for (const k of SNAPSHOT_LIST_KEYS) c.stringList(r[k], `${path}.${k}`);
        if (!(typeof r.company === "string" && r.company.trim())) c.errors.push({ path, message: "missing company" });
      });
      if (doc.snapshots.length > ROW_CAPS.snapshots) c.warnings.push(`snapshots has ${doc.snapshots.length} entries — only the first ${ROW_CAPS.snapshots} are kept`);
    }
  }

  // jhg — the workbook block each of the four files carries (added 2026-11-07). The Packer's, so a key
  // this version does not know is a warning and kept, never a refusal of the whole file.
  c.shape(doc.jhg, "jhg", JHG_SHAPE, true);

  // linkedin — headline · about · experience · featured · skills · education · certifications (added 2026-11-05)
  const li = c.mapping(doc.linkedin, "linkedin", LINKEDIN_KEYS);
  if (li) {
    const overLimit = (v: unknown, path: string, limit: number) => {
      if (typeof v === "string" && v.length > limit) c.warnings.push(`${path} is ${v.length} characters — LinkedIn allows ${limit}; kept whole and shown as over the limit`);
    };
    c.string(li.headline, "linkedin.headline"); overLimit(li.headline, "linkedin.headline", LINKEDIN_LIMITS.headline);
    c.string(li.about, "linkedin.about"); overLimit(li.about, "linkedin.about", LINKEDIN_LIMITS.about);
    if (!absent(li.experience)) {
      if (!Array.isArray(li.experience)) c.errors.push({ path: "linkedin.experience", message: `must be a list, got ${describe(li.experience)}` });
      else {
        li.experience.forEach((row, i) => {
          const p = `linkedin.experience[${i}]`;
          const r = c.mapping(row, p, LINKEDIN_EXPERIENCE_KEYS);
          if (!r) { if (!absent(row)) return; c.errors.push({ path: p, message: "empty entry" }); return; }
          for (const k of ["title", "company", "location", "start", "end", "description"] as const) c.string(r[k], `${p}.${k}`);
          c.stringList(r.skills, `${p}.skills`, LINKEDIN_LIMITS.roleSkills);
          for (const k of ["title", "company"] as const) if (absent(r[k]) || (typeof r[k] === "string" && !(r[k] as string).trim())) c.errors.push({ path: p, message: `missing ${k}` });
          overLimit(r.description, `${p}.description`, LINKEDIN_LIMITS.description);
        });
        if (li.experience.length > ROW_CAPS.experience) c.warnings.push(`linkedin.experience has ${li.experience.length} entries — only the first ${ROW_CAPS.experience} are kept`);
      }
    }
    c.rows(li.featured, "linkedin.featured", ["kind", "title", "url"], ["title"], ROW_CAPS.featured);
    if (Array.isArray(li.featured)) li.featured.forEach((row, i) => {
      const kind = isRecord(row) ? row.kind : undefined;
      if (typeof kind === "string" && !(LINKEDIN_FEATURED_KINDS as readonly string[]).includes(kind)) c.warnings.push(`linkedin.featured[${i}].kind is "${kind}" — expected link, post, article or document; ignored`);
    });
    c.stringList(li.skills, "linkedin.skills", LINKEDIN_LIMITS.skills);
    c.rows(li.education, "linkedin.education", ["school", "degree", "field", "start", "end"], ["school"], ROW_CAPS.education);
    c.rows(li.certifications, "linkedin.certifications", ["name", "issuer", "issued", "url"], ["name"], ROW_CAPS.certifications);
  }

  return { ok: c.errors.length === 0, errors: c.errors, warnings: c.warnings };
}
