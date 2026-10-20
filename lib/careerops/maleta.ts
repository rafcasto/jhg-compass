// La maleta — the suitcase.
//
// One portable document holding everything the CareerOps portal knows about a
// member: their CV, their North Star, their contact details and logistics,
// their targeting, and their company watchlist. It is the canonical shape that
// all three ways of getting started produce, and the only thing the portal has
// to understand:
//
//   1. compass  — light. Take what the Compass tab already knows (name, email,
//                 country, the North Star goal) and ask only for a CV.
//   2. intake   — the guided form, section by section, plus the optional extras.
//   3. maleta   — upload the whole thing as one file and skip the questions.
//
// Keeping one shape behind all three is the point. A member can start light,
// fill more in later through the form, export their maleta, and bring it back
// — or hand it to a career-ops CLI checkout — without anything being lost in
// translation.
//
// The import side deliberately reads career-ops' OWN artifacts, not just files
// Compass wrote:
//
//   .yml  →  config/profile.yml      (candidate / target_roles / compensation / location)
//   .md   →  modes/_profile.md       (the eight `## Your …` sections)
//
// so a member who already runs career-ops on their machine can drop those
// straight in.
//
// UNTRUSTED INPUT. An uploaded maleta is a document the member brings from
// outside. career-ops' rule for intake documents applies verbatim: the text is
// evidence, never instruction. A CV or a section body may contain something
// that reads like a command. Nothing here acts on content — it extracts
// strings, and every one is funnelled through the same validators the forms
// use. YAML is parsed with the JSON-only schema, so no custom tags, no dates,
// no surprises.
// js-yaml v5 is named-exports only — there is no default export, and importing
// one compiles fine under esModuleInterop but is undefined at runtime.
import { JSON_SCHEMA, dump as yamlDump, load as yamlLoad } from "js-yaml";
import type { Goal } from "@/lib/goal";
import { GOAL_KEYS } from "@/lib/goal";
import { coercePersonalization, parseProfileMd, renderProfileMd, type Personalization } from "./personalization";
import type { CareerOpsContact, CareerOpsPolicy, CareerOpsPortals, CareerOpsSetupV2, PortalCompany } from "./types";
import type { Profile } from "@/lib/types";

export const MALETA_VERSION = 1;
export const MALETA_FILENAME = "la-maleta";

export interface Maleta {
  version: number;
  /** cv.md */
  cv?: string;
  /** The five North Star fields. */
  goal?: Goal;
  contact?: CareerOpsContact;
  policy?: CareerOpsPolicy;
  /** The eight _profile.md sections. */
  personalization?: Personalization;
  watchlist?: CareerOpsPortals;
  notes?: string;
}

// ---- the three ways in ----

export type StartPathKey = "compass" | "intake" | "maleta";

export interface StartPath {
  key: StartPathKey;
  label: string;
  blurb: string;
  /** What the member has to supply. */
  asks: string;
  minutes: string;
}

export const START_PATHS: readonly StartPath[] = [
  {
    key: "compass",
    label: "Use what Compass already knows",
    blurb: "Your name, email, country and North Star goal are already on your Compass tab. Bring a CV and the agents can start scoring today.",
    asks: "Just your CV",
    minutes: "about 2 minutes",
  },
  {
    key: "intake",
    label: "Go through intake",
    blurb: "The guided version: CV, then your North Star, contact details and logistics, and the targeting evaluations score against — one thing at a time, stop whenever you like.",
    asks: "A handful of short questions",
    minutes: "10–20 minutes",
  },
  {
    key: "maleta",
    label: "Upload la maleta",
    blurb: "Already have it written down? Drop in a maleta file, a career-ops config/profile.yml, or a modes/_profile.md and we'll read what's there.",
    asks: "One .md or .yml file",
    minutes: "under a minute",
  },
] as const;

export const findStartPath = (key: string): StartPath | undefined =>
  START_PATHS.find((p) => p.key === key);

// ---- building one from what we already have ----

const pruned = <T extends object>(o: T | null | undefined): T | undefined => {
  if (!o) return undefined;
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));
  return Object.keys(out).length ? (out as T) : undefined;
};

export function maletaFromSetup({ profile, setup }: { profile: Profile | null | undefined; setup: CareerOpsSetupV2 | null | undefined }): Maleta {
  const goal = (setup?.goalSource === "intake" ? setup?.intakeGoal : profile?.goal) ?? profile?.goal;
  return {
    version: MALETA_VERSION,
    cv: setup?.cvMarkdown?.trim() || undefined,
    goal: pruned(goal ?? undefined),
    contact: pruned(setup?.contact),
    policy: pruned(setup?.policy),
    personalization: pruned(coercePersonalization(setup?.personalization ?? {})),
    watchlist: setup?.portals?.companies?.length ? setup.portals : undefined,
    notes: setup?.notes?.trim() || undefined,
  };
}

// ---- export ----

/** The maleta as YAML. Key order mirrors career-ops' config/profile.example.yml. */
export function maletaToYaml(m: Maleta): string {
  const doc = {
    version: m.version || MALETA_VERSION,
    goal: m.goal,
    contact: m.contact,
    policy: m.policy,
    personalization: m.personalization,
    watchlist: m.watchlist,
    notes: m.notes,
    cv: m.cv,
  };
  const body = yamlDump(JSON.parse(JSON.stringify(doc)), { lineWidth: 100, noRefs: true, skipInvalid: true });
  return [
    "# La Maleta — everything CareerOps knows about you, in one file.",
    "# Exported by JobHacker Compass. Bring it back any time, or keep it with",
    "# your career-ops checkout. Safe to edit by hand.",
    `# version: ${m.version || MALETA_VERSION}`,
    "",
    body,
  ].join("\n");
}

/** The maleta as Markdown. The targeting half is a real career-ops _profile.md. */
export function maletaToMarkdown(m: Maleta): string {
  const out: string[] = [
    "# La Maleta",
    "",
    "<!-- Everything CareerOps knows about you, in one file. Exported by",
    `     JobHacker Compass (maleta version ${m.version || MALETA_VERSION}). Safe to edit by hand. -->`,
    "",
  ];

  if (m.goal) {
    out.push("## North Star", "");
    for (const k of GOAL_KEYS) if (m.goal[k]?.trim()) out.push(`- ${k}: ${m.goal[k]!.trim()}`);
    out.push("");
  }
  if (m.contact) {
    out.push("## Contact", "");
    for (const [k, v] of Object.entries(m.contact)) if (v) out.push(`- ${k}: ${v}`);
    out.push("");
  }
  if (m.policy) {
    out.push("## Logistics", "");
    for (const [k, v] of Object.entries(m.policy)) {
      if (v === undefined || v === "" ) continue;
      out.push(`- ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    }
    out.push("");
  }
  if (m.watchlist?.companies?.length) {
    out.push("## Watchlist", "");
    for (const c of m.watchlist.companies) out.push(`- ${c.name}: ${c.careersUrl}`);
    if (m.watchlist.positive?.length) out.push(`- include: ${m.watchlist.positive.join(", ")}`);
    if (m.watchlist.negative?.length) out.push(`- exclude: ${m.watchlist.negative.join(", ")}`);
    out.push("");
  }
  if (m.notes) out.push("## Notes", "", m.notes, "");

  // The eight sections, exactly as career-ops writes them — so this half of the
  // file IS a modes/_profile.md and can be used as one.
  if (m.personalization) out.push(renderProfileMd(m.personalization).replace(/^# .*\n/, "").trim(), "");

  // The CV is arbitrary markdown with its OWN `##` headings, which collide with
  // the headings this document is delimited by — an unfenced CV ends the CV
  // section at its first `## Experience`. Fence it, with a fence longer than
  // any backtick run inside it so a CV containing code blocks still round-trips.
  if (m.cv) {
    const cv = m.cv.trim();
    const longest = Math.max(0, ...(cv.match(/`+/g) ?? []).map((r) => r.length));
    const fence = "`".repeat(Math.max(3, longest + 1));
    out.push("## CV", "", `${fence}markdown`, cv, fence, "");
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ---- import ----

export type MaletaFormat = "yaml" | "markdown";

export interface MaletaParse {
  ok: boolean;
  format: MaletaFormat | null;
  maleta: Maleta;
  /** What was recognised, for the confirm step. */
  found: string[];
  /** Non-fatal notes: parts we ignored, or shapes we guessed at. */
  warnings: string[];
  error?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const strArr = (v: unknown): string[] | undefined => {
  const list = Array.isArray(v) ? v.map(str).filter(Boolean) as string[]
    : typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  return list?.length ? list.slice(0, 50) : undefined;
};

export const detectMaletaFormat = (text: string, filename?: string): MaletaFormat => {
  if (filename && /\.(ya?ml)$/i.test(filename)) return "yaml";
  if (filename && /\.(md|markdown)$/i.test(filename)) return "markdown";
  // No usable filename: a markdown heading is the clearest signal.
  return /^#{1,3}\s+\S/m.test(text) ? "markdown" : "yaml";
};

/** A career-ops config/profile.yml mapped onto the maleta shape. */
function fromCareerOpsProfileYaml(doc: Record<string, unknown>, warnings: string[]): Maleta {
  const c = (doc.candidate ?? {}) as Record<string, unknown>;
  const tr = (doc.target_roles ?? {}) as Record<string, unknown>;
  const comp = (doc.compensation ?? {}) as Record<string, unknown>;
  const loc = (doc.location ?? {}) as Record<string, unknown>;
  const prefs = (doc.preferences ?? {}) as Record<string, unknown>;
  const nar = (doc.narrative ?? {}) as Record<string, unknown>;

  const primary = strArr(tr.primary);
  if (primary && primary.length > 1) warnings.push(`Took "${primary[0]}" as your target role; profile.yml listed ${primary.length}.`);

  const goal: Goal = {
    role: primary?.[0],
    subsector: str(prefs.industry),
    companyType: str(prefs.company_type),
    city: str(loc.city) ?? str(c.location),
    salary: str(comp.target_range),
  };

  return {
    version: MALETA_VERSION,
    goal: pruned(goal),
    contact: pruned({
      title: str(c.title),
      phone: str(c.phone),
      linkedin: str(c.linkedin),
      github: str(c.github),
      portfolio: str(c.portfolio_url),
    } as CareerOpsContact),
    policy: pruned({
      minimumSalary: str(comp.minimum),
      locationFlexibility: str(comp.location_flexibility),
      visaStatus: str(loc.visa_status),
      needsSponsorship: loc.needs_sponsorship === true || undefined,
      authorizedIn: strArr(loc.authorized_in),
    } as CareerOpsPolicy),
    // profile.yml carries a little targeting of its own.
    personalization: pruned(coercePersonalization({
      exitNarrative: str(nar.exit_story),
      crossCuttingAdvantage: strArr(nar.superpowers)?.[0],
      compTargets: str(comp.target_range) && str(comp.minimum) ? `Target ${str(comp.target_range)}, walk-away ${str(comp.minimum)}.` : undefined,
    })),
    notes: str(doc.notes),
  };
}

/** A maleta YAML we wrote ourselves. */
function fromMaletaYaml(doc: Record<string, unknown>): Maleta {
  const g = (doc.goal ?? {}) as Record<string, unknown>;
  const w = (doc.watchlist ?? {}) as Record<string, unknown>;
  const companies = Array.isArray(w.companies)
    ? (w.companies as unknown[])
        .map((x) => (x && typeof x === "object" ? { name: str((x as PortalCompany).name) ?? "", careersUrl: str((x as PortalCompany).careersUrl) ?? "" } : null))
        .filter((x): x is PortalCompany => !!x?.name && !!x?.careersUrl)
        .slice(0, 25)
    : [];
  const contact = (doc.contact ?? {}) as Record<string, unknown>;
  const policy = (doc.policy ?? {}) as Record<string, unknown>;
  return {
    version: MALETA_VERSION,
    cv: str(doc.cv),
    goal: pruned(Object.fromEntries(GOAL_KEYS.map((k) => [k, str(g[k])])) as Goal),
    contact: pruned({
      title: str(contact.title), phone: str(contact.phone), linkedin: str(contact.linkedin),
      github: str(contact.github), portfolio: str(contact.portfolio),
    } as CareerOpsContact),
    policy: pruned({
      minimumSalary: str(policy.minimumSalary), locationFlexibility: str(policy.locationFlexibility),
      visaStatus: str(policy.visaStatus), needsSponsorship: policy.needsSponsorship === true || undefined,
      authorizedIn: strArr(policy.authorizedIn),
    } as CareerOpsPolicy),
    personalization: pruned(coercePersonalization(doc.personalization)),
    watchlist: companies.length ? { companies, positive: strArr(w.positive) ?? [], negative: strArr(w.negative) ?? [] } : undefined,
    notes: str(doc.notes),
  };
}

function parseMarkdown(text: string, warnings: string[]): Maleta {
  const withComments = text.replace(/<!--[\s\S]*?-->/g, "");

  // Pull the CV out FIRST, for the same reason the exporter fences it: its own
  // headings would otherwise be read as maleta sections.
  let clean = withComments;
  let cvFromSection: string | undefined;
  const cvHead = withComments.match(/^##\s+CV\s*$/mi);
  if (cvHead?.index !== undefined) {
    const after = withComments.slice(cvHead.index + cvHead[0].length);
    const fenced = after.match(/^\s*(`{3,})[\w-]*[ \t]*\n([\s\S]*?)\n\1[ \t]*$/m);
    if (fenced?.index !== undefined) {
      cvFromSection = fenced[2].trim();
      // Remove only the fenced region, so a CV in the middle of the file does
      // not swallow the sections after it.
      clean = withComments.slice(0, cvHead.index) + after.slice(fenced.index + fenced[0].length);
    } else {
      // Unfenced: everything to the end of the document is the CV.
      cvFromSection = after.trim();
      clean = withComments.slice(0, cvHead.index);
    }
  }

  // Sections are found by SPLITTING on the headings, not by a lazy match with a
  // terminator. The obvious regex wants `(?=^##\s|\Z)` to mean "next heading or
  // end of input" — but JavaScript has no \Z, so it is a literal "Z", and the
  // lazy group then stops at the first capital Z in the body. "visaStatus: NZ
  // citizen" truncated the whole Logistics section at the Z and silently
  // dropped every line after it.
  const parts = clean.split(/^##\s+(.+?)\s*$/m);
  const sections: { title: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ title: parts[i].trim(), body: (parts[i + 1] ?? "").trim() });
  }
  const grab = (heading: RegExp): string =>
    sections.find((sec) => heading.test(sec.title))?.body ?? "";
  const kv = (body: string, key: string) => body.match(new RegExp(`^-\\s*${key}\\s*:\\s*(.+)$`, "mi"))?.[1]?.trim();

  const goalBody = grab(/North Star/);
  const contactBody = grab(/Contact/);
  const policyBody = grab(/Logistics/);
  const watchBody = grab(/Watchlist/);
  const notes = grab(/Notes/);

  const companies = watchBody
    .split("\n")
    .map((l) => l.trim().match(/^-\s*(.+?)\s*:\s*(https?:\/\/\S+)$/))
    .filter(Boolean)
    .map((m) => ({ name: m![1], careersUrl: m![2] }))
    .slice(0, 25);

  // The eight sections are parsed by the module that renders them.
  const personalization = parseProfileMd(clean);
  if (!Object.keys(personalization).length && /##\s+Your /i.test(clean)) {
    warnings.push("Found targeting headings but no filled-in content — those sections were left as NOT SET.");
  }

  return {
    version: MALETA_VERSION,
    cv: cvFromSection || undefined,
    goal: pruned(Object.fromEntries(GOAL_KEYS.map((k) => [k, kv(goalBody, k)])) as Goal),
    contact: pruned({
      title: kv(contactBody, "title"), phone: kv(contactBody, "phone"), linkedin: kv(contactBody, "linkedin"),
      github: kv(contactBody, "github"), portfolio: kv(contactBody, "portfolio"),
    } as CareerOpsContact),
    policy: pruned({
      minimumSalary: kv(policyBody, "minimumSalary"), locationFlexibility: kv(policyBody, "locationFlexibility"),
      visaStatus: kv(policyBody, "visaStatus"),
      needsSponsorship: /^true$/i.test(kv(policyBody, "needsSponsorship") ?? "") || undefined,
      authorizedIn: strArr(kv(policyBody, "authorizedIn")),
    } as CareerOpsPolicy),
    personalization: pruned(personalization),
    watchlist: companies.length
      ? { companies, positive: strArr(kv(watchBody, "include")) ?? [], negative: strArr(kv(watchBody, "exclude")) ?? [] }
      : undefined,
    notes: notes || undefined,
  };
}

/** Human labels for what the file turned out to contain. */
export function maletaContents(m: Maleta): string[] {
  const found: string[] = [];
  if (m.cv) found.push("your CV");
  if (m.goal?.role) found.push(`North Star (${m.goal.role})`);
  if (m.contact) found.push(`contact details (${Object.keys(m.contact).length})`);
  if (m.policy) found.push("logistics");
  if (m.personalization) found.push(`targeting (${Object.keys(m.personalization).length}/8 sections)`);
  if (m.watchlist?.companies.length) found.push(`watchlist (${m.watchlist.companies.length} companies)`);
  if (m.notes) found.push("notes");
  return found;
}

export const MALETA_MAX_BYTES = 512 * 1024;

export function parseMaleta(text: string, filename?: string): MaletaParse {
  const warnings: string[] = [];
  const empty: MaletaParse = { ok: false, format: null, maleta: { version: MALETA_VERSION }, found: [], warnings };

  if (!text?.trim()) return { ...empty, error: "That file is empty." };
  if (text.length > MALETA_MAX_BYTES) {
    return { ...empty, error: `That file is ${Math.round(text.length / 1024)} kB — the limit is ${MALETA_MAX_BYTES / 1024} kB.` };
  }

  const format = detectMaletaFormat(text, filename);
  let maleta: Maleta;

  if (format === "yaml") {
    let doc: unknown;
    try {
      // JSON_SCHEMA: plain scalars, maps and lists only. No custom tags, no
      // implicit dates — an uploaded file cannot ask the parser for anything.
      doc = yamlLoad(text, { schema: JSON_SCHEMA });
    } catch (e) {
      return { ...empty, format, error: `That YAML didn't parse: ${e instanceof Error ? e.message.split("\n")[0] : "unknown error"}` };
    }
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      return { ...empty, format, error: "That YAML isn't a maleta — expected a document with keys like goal, contact or candidate." };
    }
    const rec = doc as Record<string, unknown>;
    const looksCareerOps = "candidate" in rec || "target_roles" in rec;
    maleta = looksCareerOps ? fromCareerOpsProfileYaml(rec, warnings) : fromMaletaYaml(rec);
    if (looksCareerOps) warnings.push("Read as a career-ops config/profile.yml. Your CV isn't in that file — add it separately.");
  } else {
    maleta = parseMarkdown(text, warnings);
  }

  const found = maletaContents(maleta);
  if (!found.length) {
    return {
      ...empty, format,
      error: format === "yaml"
        ? "Nothing recognisable in there. A maleta has keys like goal, contact, personalization — or use a career-ops config/profile.yml."
        : "Nothing recognisable in there. A maleta uses headings like ## North Star, ## CV, or the career-ops ## Your … sections.",
    };
  }
  return { ok: true, format, maleta, found, warnings };
}

// ---- applying one ----

export interface MaletaPatch {
  /** Merge onto users/{uid}/careerOps/setup. */
  setup: Partial<CareerOpsSetupV2>;
  /** The North Star to store as the intake goal, when the file carried one. */
  goal?: Goal;
}

/**
 * What to write. Only the parts the file actually carried — a maleta with no
 * watchlist must not wipe the watchlist the member already has, so absent means
 * "leave alone", never "clear".
 */
export function maletaToSetupPatch(m: Maleta): MaletaPatch {
  const setup: Partial<CareerOpsSetupV2> = {};
  if (m.cv) setup.cvMarkdown = m.cv;
  if (m.contact) setup.contact = m.contact;
  if (m.policy) setup.policy = m.policy;
  if (m.personalization) {
    setup.personalization = m.personalization;
    setup.profileMd = renderProfileMd(m.personalization);
  }
  if (m.watchlist?.companies.length) setup.portals = m.watchlist;
  if (m.notes) setup.notes = m.notes;
  // A goal in the file becomes the intake North Star, which overrides Compass —
  // the member brought it deliberately, so it should win.
  if (m.goal?.role?.trim()) {
    setup.goalSource = "intake";
    setup.intakeGoal = m.goal;
  }
  return { setup, goal: m.goal };
}
