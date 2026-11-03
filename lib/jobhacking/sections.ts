// The JobHacking portal — docs/UX_JOBHACKING.md.
//
// Three pages, each a sectioned page in the Profile/Settings layout
// (components/profile/SectionsPage.tsx), plus Settings (the profile.yml upload):
//
//   /jobhacking/narrative    Contact details · Headline · Bridge story · Core competencies
//   /jobhacking/true-north   Target industry · Target roles · Seniority · Salary range · Location · Company type
//   /jobhacking/companies    Target companies
//   /jobhacking/settings     Upload profile.yml
//
// Same documents as Compass (decision F, 2026-11-03): users/{uid} and
// users/{uid}/careerOps/setup. A section here is another door onto the same
// field, never a copy. The mapping is in the doc's §2; nothing here reads a
// field the file does not carry.
//
// Pure — no React. Tested.

import type { CareerOpsSetupV2 } from "../careerops/types";
import { effectiveGoal } from "../careerops/intake";
import type { StepState } from "../careerops/intake-wizard";
import { companyTypePhrase, roleWithSeniority, type Goal } from "../goal";
import { sectionSummaries, type FileSectionKey } from "../profile-sections";
import type { Profile } from "../types";

export type JhPageKey = "narrative" | "true-north" | "companies";

export interface JhPage { key: JhPageKey; label: string; href: string; title: string; intro: string }

export const JH_PAGES = [
  { key: "narrative", label: "Narrative", href: "/jobhacking/narrative", title: "Narrative", intro: "Who you are: the contact block of every application, what you're best at, the one line under your name, and why you're moving." },
  { key: "true-north", label: "True North", href: "/jobhacking/true-north", title: "True North", intro: "What you're aiming at. Every section fills a blank in the statement." },
  { key: "companies", label: "Target companies", href: "/jobhacking/companies", title: "Target companies", intro: "The companies you're going after, their careers pages, and the job titles to include and exclude." },
] as const satisfies readonly JhPage[];

export const JH_HOME = JH_PAGES[0].href;
export const JH_SETTINGS_HREF = "/jobhacking/settings";

export interface JhSection {
  key: string;
  page: JhPageKey;
  /** Rail / row label — short. */
  label: string;
  /** The heading on the section itself. */
  title: string;
  /** One line under the heading: what this section is for. */
  ask: string;
}

export const JH_SECTIONS = [
  // ---- Profile ----
  { key: "contact", page: "narrative", label: "Contact details", title: "Contact details", ask: "Your name, phone, email, LinkedIn, location and portfolio — the header of every generated CV and the contact block of every application form." },
  { key: "headline", page: "narrative", label: "Headline", title: "Headline", ask: "One line under your name that says what you do and for whom." },
  // "Bridge story" is the JobHacking word for Compass's "Exit story" — same field, personalization.exitNarrative.
  { key: "story", page: "narrative", label: "Bridge story", title: "Bridge story", ask: "Why you're leaving and where you're heading — the frame for every summary, cover letter and interview answer." },
  { key: "competencies", page: "narrative", label: "Core competencies", title: "Core competencies", ask: "Your superpowers — the three to five things you do that the other candidates can't." },
  // ---- True North (order decided 2026-11-03: industry first, company type on its own at the end) ----
  { key: "industry", page: "true-north", label: "Target industry", title: "Target industry", ask: "The industry — and the sub-sector within it — you want to work in." },
  { key: "roles", page: "true-north", label: "Target roles", title: "Target roles", ask: "The job title you're going for, and the role archetypes behind it — what each one is really about and what a company is buying when it hires for it." },
  { key: "seniority", page: "true-north", label: "Seniority", title: "Seniority", ask: "The level you're applying at — Senior, Lead, Head of. It goes in front of the title in your statement." },
  { key: "salary", page: "true-north", label: "Salary range", title: "Salary range", ask: "The range you're aiming at, the floor below which you walk, and how you talk about your number." },
  { key: "location", page: "true-north", label: "Location", title: "Location", ask: "Where you'll be based, how flexible you are, and the rules on remote, hybrid and relocation." },
  { key: "company-type", page: "true-north", label: "Company type", title: "Company type", ask: "The kind of company you enjoy working for — startup, scale-up, enterprise, government." },
  // ---- Target companies ----
  { key: "companies", page: "companies", label: "Target companies", title: "Target companies", ask: "The companies on your list with the page that lists their jobs, plus the title keywords to include and exclude. A company without a careers page stays on the list until you add one." },
] as const satisfies readonly JhSection[];

export type JhSectionKey = (typeof JH_SECTIONS)[number]["key"];
export type JhSectionDef = JhSection & { key: JhSectionKey };

export const findJhPage = (key: string): JhPage | undefined => (JH_PAGES as readonly JhPage[]).find((p) => p.key === key);
export const findJhSection = (key: string): JhSectionDef | undefined => (JH_SECTIONS as readonly JhSectionDef[]).find((s) => s.key === key);

/** The sections one page renders, in order. */
export const jhSectionsFor = (page: JhPageKey): readonly JhSectionDef[] =>
  (JH_SECTIONS as readonly JhSectionDef[]).filter((s) => s.page === page);

/** Deep link to a section on its page. */
export const jhSectionHref = (key: JhSectionKey): string => `${findJhPage(findJhSection(key)!.page)!.href}?section=${key}`;

/** `?section=roles` → "roles"; unknown, absent or another page's key → null (the overview). */
export function parseJhSection(raw: string | null | undefined, sections: readonly JhSectionDef[] = JH_SECTIONS as readonly JhSectionDef[]): JhSectionKey | null {
  return sections.some((s) => s.key === raw) ? (raw as JhSectionKey) : null;
}

/**
 * Where an uploaded profile.yml's sections land in this portal — the links on
 * the "unpacked" status line. null: stored, but no JobHacking section shows it.
 */
export const JH_FILE_EDIT: Record<FileSectionKey, JhSectionKey | null> = {
  northstar: "roles", contact: "contact", targeting: "story", watchlist: "companies", notes: null, cv: null, artefacts: null,
};

// ---- what each row shows ----

export interface JhSummary { key: JhSectionKey; state: StepState; summary: string; count?: string }

export interface JhSignals { setup: CareerOpsSetupV2 | null | undefined; profile: Profile | null | undefined }

const NOT_SET = "Not set";
const join = (parts: (string | undefined | null | false)[], sep = " · ") => parts.map((p) => (p ? p.trim() : "")).filter(Boolean).join(sep);
const has = (v: unknown): boolean => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);
const clip = (s: string, max = 72): string => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const firstLine = (s: string | undefined): string => (s ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** done once the field that fills the statement is set; partial when only the supporting fields are. */
const stateOf = (lead: boolean, others: number): StepState => (lead ? "done" : others ? "partial" : "empty");

/** The goal the agents work from — Compass's, or the intake override (an uploaded profile.yml sets the latter). */
export const jhGoal = ({ setup, profile }: JhSignals): Goal =>
  effectiveGoal({ source: setup?.goalSource, compassGoal: profile?.goal, intakeGoal: setup?.intakeGoal }).goal;

/** Every section's row, all three pages. Filter by `jhSectionsFor(page)` to render one page. */
export function jhSectionSummaries(signals: JhSignals): JhSummary[] {
  const { setup } = signals;
  const g = jhGoal(signals);
  const p = setup?.personalization ?? {};
  const policy = setup?.policy ?? {};
  const roles = p.targetRoles ?? [];
  const rules = p.locationPolicy ?? [];
  const companies = setup?.portals?.companies ?? [];

  // Contact, headline, bridge story (Compass's exit story) and the company list are the same rows as the
  // Profile / Settings pages — one summary per field, wherever it is shown.
  const shared = new Map(sectionSummaries({ setup, profile: signals.profile }).map((r) => [r.key, r]));
  const borrow = (from: "contact" | "headline" | "story" | "companies", key: JhSectionKey): JhSummary => {
    const r = shared.get(from)!;
    return { key, state: r.state, summary: r.summary, count: r.count };
  };

  const competencies = p.crossCuttingAdvantage?.trim() ?? "";
  const salaryN = [g.salary, policy.minimumSalary, p.compTargets].filter(has).length;
  const locationN = [g.city, policy.locationFlexibility, rules.length].filter(has).length;

  return [
    borrow("contact", "contact"),
    borrow("headline", "headline"),
    borrow("story", "story"),
    { key: "competencies", state: competencies ? "done" : "empty", summary: competencies ? clip(firstLine(competencies)) : NOT_SET },
    {
      key: "roles", state: stateOf(!!g.role?.trim(), roles.length),
      summary: join([g.role, roles.length ? plural(roles.length, "archetype") : undefined]) || NOT_SET,
      count: roles.length ? String(roles.length) : undefined,
    },
    { key: "seniority", state: g.seniority?.trim() ? "done" : "empty", summary: g.seniority?.trim() || NOT_SET },
    {
      key: "salary", state: stateOf(!!g.salary?.trim(), salaryN),
      summary: join([g.salary, policy.minimumSalary && `floor ${policy.minimumSalary}`, p.compTargets && "comp notes"]) || NOT_SET,
      count: `${salaryN}/3`,
    },
    { key: "industry", state: g.subsector?.trim() ? "done" : "empty", summary: g.subsector?.trim() || NOT_SET },
    { key: "company-type", state: g.companyType?.trim() ? "done" : "empty", summary: g.companyType?.trim() || NOT_SET },
    {
      key: "location", state: stateOf(!!g.city?.trim(), locationN),
      summary: join([g.city, policy.locationFlexibility && clip(policy.locationFlexibility, 40), rules.length ? plural(rules.length, "rule") : undefined]) || NOT_SET,
      count: `${locationN}/3`,
    },
    {
      ...borrow("companies", "companies"),
      // The shared row counts every company; here a company with no careers page is worth a word.
      summary: companies.length
        ? join([shared.get("companies")!.summary, companies.some((c) => !c.careersUrl?.trim()) ? `${plural(companies.filter((c) => !c.careersUrl?.trim()).length, "company", "companies")} without a careers page` : undefined])
        : NOT_SET,
    },
  ];
}

/** The rows for one page's sections, in that page's order. */
export function jhRowsFor(sections: readonly JhSectionDef[], rows: JhSummary[]): JhSummary[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return sections.map((s) => byKey.get(s.key)!).filter(Boolean);
}

// ---- the True North statement ----
//
//   In 60 days, I'm working as [Target Role + Target Seniority], in [Target Industry].
//   I'm based in [Target Location] and I'm making [Target Salary] yearly before tax.
//   I enjoy working for [Target Company Type].
//
// Every blank maps to exactly one goal field; the statement never invents one.

export interface TrueNorthBlanks {
  /** "Senior Customer Success Manager" — seniority in front of the title, never doubled. */
  role: string;
  industry: string;
  location: string;
  salary: string;
  /** With its article, as it reads inline: "a Scale-up", "the Government". */
  companyType: string;
}

export const TRUE_NORTH_PLACEHOLDERS: Record<keyof TrueNorthBlanks, string> = {
  role: "[Target Role + Target Seniority]",
  industry: "[Target Industry]",
  location: "[Target Location]",
  salary: "[Target Salary]",
  companyType: "[Target Company Type]",
};

/** Which section fills each blank — the statement's values link there. */
export const TRUE_NORTH_SECTION: Record<keyof TrueNorthBlanks, JhSectionKey> = {
  role: "roles", industry: "industry", location: "location", salary: "salary", companyType: "company-type",
};

export function trueNorthBlanks(goal: Goal | null | undefined): TrueNorthBlanks {
  const g = goal ?? {};
  return {
    role: roleWithSeniority(g),
    industry: (g.subsector ?? "").trim(),
    location: (g.city ?? "").trim(),
    salary: (g.salary ?? "").trim(),
    companyType: companyTypePhrase(g.companyType),
  };
}

/** The statement as one line of text, blanks shown as their placeholders. */
export function trueNorthText(goal: Goal | null | undefined): string {
  const b = trueNorthBlanks(goal);
  const v = (k: keyof TrueNorthBlanks) => b[k] || TRUE_NORTH_PLACEHOLDERS[k];
  return `In 60 days, I'm working as ${v("role")}, in ${v("industry")}. I'm based in ${v("location")} and I'm making ${v("salary")} yearly before tax. I enjoy working for ${v("companyType")}.`;
}
