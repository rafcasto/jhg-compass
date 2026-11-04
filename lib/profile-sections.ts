// The sections of the member's profile — one registry that the Profile page,
// the Settings page, their rails (desktop), their overview rows (mobile) and
// the upload diff all read from. docs/UX_PROFILE.md §7.
//
// Two pages, one profile.yml:
//
//   /profile   WHO AM I            contact details · headline · exit story
//              WHAT'S MY TARGET    target role & market · salary floor & location · comp & location policy
//              WHAT VALUE DO I CREATE  (reserved — stories, proof bank)
//   /settings  what the agents work from: master CV · target companies ·
//              portal accounts · archetypes & core competencies · portfolio / demo · notes
//
// The grouping is the JobHackers vocabulary (Profile / North Star / Artefacts);
// the keys are the storage model's. The export is still the whole file: a
// section's page says where it is EDITED, not where it is stored.
//
// Reserved sections (proof points, stories, culture screen) are registered
// with `available: false` and never rendered: a field the agents do not read
// yet is a broken promise. Flip the flag the day the worker reads them.
//
// Pure — no React. Tested.

import { cvReadiness, effectiveGoal } from "./careerops/intake";
import type { StepState } from "./careerops/intake-wizard";
import { SECTION_COPY } from "./careerops/personalization";
import type { CareerOpsSetupV2 } from "./careerops/types";
import type { Profile } from "./types";

export type PageKey = "profile" | "settings";
export type GroupKey = "who" | "target" | "value";

export interface SectionGroup {
  key: GroupKey;
  /** The JobHackers name — the eyebrow above the group. */
  eyebrow: string;
  /** The question the group answers. */
  label: string;
}

export const GROUPS = [
  { key: "who", eyebrow: "Profile", label: "Who am I" },
  { key: "target", eyebrow: "North Star", label: "What's my target" },
  { key: "value", eyebrow: "Artefacts", label: "What value do I create" },
] as const satisfies readonly SectionGroup[];

export interface ProfileSection {
  key: string;
  /** Where it is edited. */
  page: PageKey;
  /** Profile-page sections sit in one of the three groups; Settings is flat. */
  group?: GroupKey;
  /** Rail / row label — short. */
  label: string;
  /** The heading on the section itself. */
  title: string;
  /** One line under the heading: what this section is for. */
  ask: string;
  /** False = registered for later, never rendered. */
  available: boolean;
  /** Needs the CareerOps worker (the member must have the portal switched on). */
  requires?: "careerOps";
}

export const PROFILE_SECTIONS = [
  // ---- /profile · Who am I ----
  { key: "contact", page: "profile", group: "who", label: "Contact details", title: "Contact details", ask: "Your name, phone, email, LinkedIn, location and portfolio — the header of every generated CV and cover letter, and the contact block of every application form.", available: true },
  { key: "headline", page: "profile", group: "who", label: "Headline", title: "Headline", ask: "Your lane statement: one line under your name that says what you do and for whom. It opens every CV and summary the agents write.", available: true },
  { key: "story", page: "profile", group: "who", label: "Exit story", title: "Exit story", ask: "Why you're leaving and where you're heading — the frame for every summary, cover letter and interview answer.", available: true },
  // ---- /profile · What's my target ----
  { key: "northstar", page: "profile", group: "target", label: "Target role & market", title: "Target role and market", ask: "Role, industry, company type, geography and salary range — the North Star every evaluation is scored against.", available: true },
  { key: "logistics", page: "profile", group: "target", label: "Salary floor & location", title: "Salary floor, location and right to work", ask: "The number below which you walk, how flexible you are on location, your visa status and where you already hold work rights.", available: true },
  { key: "targeting", page: "profile", group: "target", label: "Comp & location policy", title: "Comp targets and location policy", ask: "What the market pays for your target roles, what you say when an offer comes in low, and where you will and won't work.", available: true },
  { key: "culture", page: "profile", group: "target", label: "Culture screen", title: "Culture screen", ask: "Reserved.", available: false },
  // ---- /profile · What value do I create (reserved until the worker reads them) ----
  { key: "stories", page: "profile", group: "value", label: "Stories", title: "Interview stories", ask: "Reserved.", available: false },
  { key: "proof", page: "profile", group: "value", label: "Proof bank", title: "Proof bank", ask: "Reserved.", available: false },
  // ---- /settings ----
  { key: "cv", page: "settings", label: "Master CV", title: "Your master CV", ask: "The only source of truth about what you have done. Every tailored CV starts from it, and the Evaluator quotes it as evidence.", available: true },
  { key: "companies", page: "settings", label: "Target companies", title: "Target companies", ask: "The companies you're targeting and their careers pages — where the Scout looks — plus the title keywords it includes and excludes.", available: true },
  { key: "accounts", page: "settings", label: "Portal accounts", title: "Career portal accounts", ask: "The candidate accounts you created on Workday, SuccessFactors and other portals, so the agents can read the whole application form. Encrypted in your browser.", available: true, requires: "careerOps" },
  { key: "archetypes", page: "settings", label: "Archetypes", title: "Role archetypes and core competencies", ask: "The role archetypes the Evaluator scores fit against, how to frame you for each one, and the core competencies that cut across all of them.", available: true },
  { key: "portfolio", page: "settings", label: "Portfolio / demo", title: "Portfolio or demo", ask: "A live demo, dashboard or public project the agents can point to, and when it's worth sharing.", available: true },
  { key: "notes", page: "settings", label: "Notes for the agents", title: "Notes for the agents", ask: "Hard no's, never-apply companies, CV house rules — free text every agent reads before it acts.", available: true },
] as const satisfies readonly ProfileSection[];

export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number]["key"];
export type ActiveSectionKey = Exclude<ProfileSectionKey, "culture" | "stories" | "proof">;
export type ActiveSection = ProfileSection & { key: ActiveSectionKey };

/** Every section that can render, both pages, in order. */
export const ACTIVE_SECTIONS = PROFILE_SECTIONS.filter((s) => s.available) as readonly ActiveSection[];

export interface PageOptions {
  /** The member has the CareerOps portal switched on — unlocks sections that need the worker. */
  careerOps?: boolean;
}

/** The sections one page renders, in order. */
export function sectionsFor(page: PageKey, opts: PageOptions = {}): readonly ActiveSection[] {
  return ACTIVE_SECTIONS.filter((s) => s.page === page && (!s.requires || opts.careerOps));
}

/** The groups a page's sections fall into, in order, each with the sections it holds. Settings has one unnamed group. */
export function groupedSections(sections: readonly ActiveSection[]): { group: SectionGroup | null; sections: ActiveSection[] }[] {
  const out: { group: SectionGroup | null; sections: ActiveSection[] }[] = [];
  for (const s of sections) {
    const group = s.group ? (GROUPS as readonly SectionGroup[]).find((g) => g.key === s.group) ?? null : null;
    const last = out[out.length - 1];
    if (last && last.group?.key === group?.key) last.sections.push(s);
    else out.push({ group, sections: [s] });
  }
  return out;
}

/** What the desktop rail opens when the URL names no section. */
export const DEFAULT_SECTION: Record<PageKey, ActiveSectionKey> = { profile: "contact", settings: "cv" };

export const PAGE_HREF: Record<PageKey, string> = { profile: "/profile", settings: "/settings" };

export const findSection = (key: string): ProfileSection | undefined =>
  (PROFILE_SECTIONS as readonly ProfileSection[]).find((s) => s.key === key);

/**
 * `?section=story` → "story"; unknown, reserved or absent → null (the overview).
 * With `sections` given, anything outside that list is also null — a Settings
 * URL cannot open a Profile section, and `accounts` needs CareerOps.
 */
export function parseSection(raw: string | null | undefined, sections: readonly ActiveSection[] = ACTIVE_SECTIONS): ActiveSectionKey | null {
  return sections.some((s) => s.key === raw) ? (raw as ActiveSectionKey) : null;
}

/** Deep link to a section on whichever page edits it. */
export const sectionHref = (key: ActiveSectionKey): string => `${PAGE_HREF[findSection(key)?.page ?? "profile"]}?section=${key}`;

// ---- the file's sections ----
//
// profile.yml is grouped by storage (goal · contact+policy · personalization ·
// watchlist · notes · cv). The upload review diffs the file at that level, so
// each file section names the page section a member goes to afterwards.

export const FILE_SECTIONS = {
  northstar: { label: "North Star", edit: "northstar" },
  contact: { label: "Contact & logistics", edit: "contact" },
  targeting: { label: "Targeting", edit: "story" },
  watchlist: { label: "Target companies", edit: "companies" },
  // The Packer's ranked lists — read on JobHacking → Target companies (JH_FILE_EDIT), no Compass page shows them.
  companyLists: { label: "Company lists", edit: null },
  notes: { label: "Notes", edit: "notes" },
  cv: { label: "Master CV", edit: "cv" },
  // Read on JobHacking → Artefacts → Story Bank (JH_FILE_EDIT), edited nowhere — no Compass page shows them.
  artefacts: { label: "Stories & proof points", edit: null },
  // Read on JobHacking → Artefacts → LinkedIn profile (JH_FILE_EDIT), edited nowhere.
  linkedin: { label: "LinkedIn profile", edit: null },
} as const satisfies Record<string, { label: string; edit: ActiveSectionKey | null }>;

export type FileSectionKey = keyof typeof FILE_SECTIONS;

// ---- what each row shows ----

export interface SectionSummary {
  key: ActiveSectionKey;
  state: StepState;
  /** One line quoting the data, or "Not set". */
  summary: string;
  /** A small count for the row's right edge, when one makes sense. */
  count?: string;
}

export interface SectionSignals {
  setup: CareerOpsSetupV2 | null | undefined;
  profile: Profile | null | undefined;
  /** Portal accounts in the vault (users/{uid}/careerOpsVault). */
  accounts?: number;
}

const join = (parts: (string | undefined | null | false)[], sep = " · ") => parts.map((p) => (p ? p.trim() : "")).filter(Boolean).join(sep);
const NOT_SET = "Not set";
const has = (v: unknown): boolean => v !== undefined && v !== null && v !== "" && v !== false && !(Array.isArray(v) && !v.length);
const filled = (o: object | null | undefined): number => (o ? Object.values(o).filter(has).length : 0);
/** "done" once `enough` of `total` fields are set; "partial" from the first one. */
const stateOf = (n: number, enough: number): StepState => (n === 0 ? "empty" : n >= enough ? "done" : "partial");
const clip = (s: string, max = 72): string => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const firstLine = (s: string | undefined): string => (s ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const host = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

/** Every active section's row, both pages. Filter by `sectionsFor(page)` to render one page. */
export function sectionSummaries({ setup, profile, accounts = 0 }: SectionSignals): SectionSummary[] {
  const goal = effectiveGoal({ source: setup?.goalSource, compassGoal: profile?.goal, intakeGoal: setup?.intakeGoal });
  const g = goal.goal;
  const contact = setup?.contact ?? {};
  const policy = setup?.policy ?? {};
  const p = setup?.personalization ?? {};
  const companies = setup?.portals?.companies ?? [];
  const notes = setup?.notes?.trim() ?? "";
  const cv = setup?.cvMarkdown?.trim() ?? "";
  const readiness = cv ? cvReadiness(cv) : null;

  // Name and email come from the account, so a signed-in member always has two of the six.
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const contactN = [fullName, profile?.email, contact.phone, contact.linkedin, contact.location, contact.portfolio].filter(has).length; // of 6
  const headline = contact.title?.trim() ?? "";
  const exitStory = p.exitNarrative?.trim() ?? "";
  const logisticsN = filled(policy);                                 // of 5
  const targetingN = [p.compTargets, p.negotiationScripts, p.locationPolicy].filter(has).length; // of 3
  const archetypesN = [p.targetRoles, p.adaptiveFraming, p.crossCuttingAdvantage].filter(has).length; // of 3
  const roles = p.targetRoles ?? [];

  return [
    {
      // "done" needs the phone and at least one link or the location on top of the account's name and email.
      key: "contact", state: stateOf(contactN, 4),
      summary: join([fullName, contact.phone, contact.location && clip(contact.location, 32), contact.linkedin && "LinkedIn", contact.portfolio && "portfolio"]) || NOT_SET,
    },
    {
      key: "headline", state: headline ? "done" : "empty",
      summary: headline ? clip(headline) : NOT_SET,
    },
    {
      key: "story", state: exitStory ? "done" : "empty",
      summary: exitStory ? clip(firstLine(exitStory)) : NOT_SET,
    },
    {
      key: "northstar", state: g.role?.trim() ? "done" : "empty",
      summary: join([g.role, g.city, g.salary]) || NOT_SET,
      count: g.role ? (goal.source === "intake" ? "profile" : "Compass") : undefined,
    },
    {
      key: "logistics", state: stateOf(logisticsN, 3),
      summary: join([policy.minimumSalary && `floor ${policy.minimumSalary}`, policy.locationFlexibility && clip(policy.locationFlexibility, 40), policy.visaStatus && clip(policy.visaStatus, 40), policy.authorizedIn?.length ? policy.authorizedIn.join(" / ") : undefined]) || NOT_SET,
    },
    {
      key: "targeting", state: stateOf(targetingN, 3),
      summary: join([p.compTargets && clip(p.compTargets, 40), p.negotiationScripts?.length ? plural(p.negotiationScripts.length, "script") : undefined, p.locationPolicy?.length ? plural(p.locationPolicy.length, "location rule") : undefined]) || NOT_SET,
      count: `${targetingN}/3`,
    },
    {
      key: "cv", state: cv ? "done" : "empty",
      summary: readiness ? `${readiness.words} words · ${readiness.scoreable ? "Ready to score" : "A bit thin"}` : NOT_SET,
    },
    {
      key: "companies", state: companies.length ? "done" : "empty",
      summary: companies.length ? companies.slice(0, 3).map((c) => c.name).join(", ") + (companies.length > 3 ? "…" : "") : NOT_SET,
      count: companies.length ? String(companies.length) : undefined,
    },
    {
      key: "accounts", state: accounts ? "done" : "empty",
      summary: accounts ? `${plural(accounts, "account")} saved · encrypted for the worker` : NOT_SET,
      count: accounts ? String(accounts) : undefined,
    },
    {
      key: "archetypes", state: stateOf(archetypesN, 2),
      summary: roles.length
        ? join([roles.slice(0, 3).map((r) => r.archetype).join(", ") + (roles.length > 3 ? "…" : ""), p.adaptiveFraming?.length ? `${plural(p.adaptiveFraming.length, "framing")}` : undefined, has(p.crossCuttingAdvantage) && "competencies"])
        : p.adaptiveFraming?.length || has(p.crossCuttingAdvantage) ? join([p.adaptiveFraming?.length ? plural(p.adaptiveFraming.length, "framing") : undefined, has(p.crossCuttingAdvantage) && "competencies", "no archetypes yet"]) : NOT_SET,
      count: roles.length ? String(roles.length) : undefined,
    },
    {
      key: "portfolio", state: p.portfolio?.url ? "done" : "empty",
      summary: p.portfolio?.url ? join([host(p.portfolio.url), p.portfolio.description && clip(p.portfolio.description, 48)]) : NOT_SET,
    },
    {
      key: "notes", state: notes ? "done" : "empty",
      summary: notes ? clip(firstLine(notes)) : NOT_SET,
    },
  ];
}

/** The rows for one page's sections, in that page's order. */
export function rowsFor(sections: readonly ActiveSection[], rows: SectionSummary[]): SectionSummary[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return sections.map((s) => byKey.get(s.key)!).filter(Boolean);
}

export interface ProfileProgress { done: number; total: number; pct: number }

/** Over every rendered section of a page — the whole picture, not just the required three. */
export function profileProgress(rows: SectionSummary[]): ProfileProgress {
  const done = rows.filter((r) => r.state === "done").length;
  return { done, total: rows.length, pct: rows.length ? Math.round((done / rows.length) * 100) : 0 };
}

/** Member-facing name of one of the eight targeting sub-sections, for summaries and diffs. */
export const targetingLabel = (id: keyof typeof SECTION_COPY): string => SECTION_COPY[id].label.toLowerCase();
