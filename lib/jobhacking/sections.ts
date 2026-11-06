// The JobHacking portal — docs/UX_JOBHACKING.md.
//
// Four pages, each a sectioned page in the Profile/Settings layout
// (components/profile/SectionsPage.tsx), plus Settings (the profile.yml upload):
//
//   /jobhacking/narrative    Contact details · Headline · Bridge story · Core competencies
//   /jobhacking/true-north   Target industry · Target roles · Seniority · Salary range · Location · Company type · Boundaries
//   /jobhacking/companies    Top 3 · Top 10 · Top 40 (the Packer's ranked lists, read-only) · Watchlist
//   /jobhacking/artefacts    Story Bank (proof points · stories · snapshots, edited on request) · Master CV · LinkedIn profile (read-only)
//   /jobhacking/settings     Upload the four Packer files (narrative · true-north · target-companies · artefacts)
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
import { listCompanies, listCount, listSummary, type CompanyListKey } from "./company-lists";
import { linkedinCount, linkedinSummary } from "./linkedin-profile";
import { storyBankCounts, storyBankSummary } from "./story-bank";
import { boundariesSummary, hasBoundaries } from "./workbook";

export type JhPageKey = "narrative" | "true-north" | "companies" | "artefacts";

export interface JhPage { key: JhPageKey; label: string; href: string; title: string; intro: string }

export const JH_PAGES = [
  { key: "narrative", label: "Narrative", href: "/jobhacking/narrative", title: "Narrative", intro: "Who you are: the contact block of every application, what you're best at, the one line under your name, and why you're moving." },
  { key: "true-north", label: "True North", href: "/jobhacking/true-north", title: "True North", intro: "What you're aiming at. Every section fills a blank in the statement." },
  { key: "companies", label: "Target companies", href: "/jobhacking/companies", title: "Target companies", intro: "The companies you're going after — your Top 3, your Top 10 and the whole ranked field, sunrise and sunset — plus the careers pages to watch and the job titles to include and exclude." },
  { key: "artefacts", label: "Artefacts", href: "/jobhacking/artefacts", title: "Artefacts", intro: "What you bring to every application: the stories and proof points behind every answer, the master CV every tailored CV starts from, and the LinkedIn profile to build from them." },
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
  // Boundaries (2026-11-07): the True North file's hard no's, culture must-haves, soft dislikes, notice period and never-apply list. Read-only — the coach writes them.
  { key: "boundaries", page: "true-north", label: "Boundaries", title: "Boundaries", ask: "What rules a role out before anyone scores it — hard no's, the culture you need, soft dislikes, your notice period, and the companies you will never apply to." },
  // ---- Target companies (decision 2026-11-05): the Packer's three ranked lists, read-only, then the watchlist ----
  { key: "top3", page: "companies", label: "Top 3", title: "Top 3", ask: "The three to go after first — where your research, outreach and tailored applications start this week." },
  { key: "top10", page: "companies", label: "Top 10", title: "Top 10", ask: "The ten to keep warm: your Top 3 and the next seven, so a stalled conversation never leaves you with nothing to work on." },
  { key: "top40", page: "companies", label: "Top 40", title: "Top 40", ask: "The whole field, ranked — every company your coach classified as sunrise (growing) or sunset (shrinking), with the industry and sub-sector each one sits in." },
  { key: "companies", page: "companies", label: "Watchlist", title: "Watchlist", ask: "The careers pages to watch — the page that lists each company's jobs — plus the title keywords to include and exclude. A company without a careers page stays on the list until you add one." },
  // ---- Artefacts (decision 2026-11-05): the story bank (read, edited on request) · the master CV · the LinkedIn profile to build, read-only ----
  { key: "story-bank", page: "artefacts", label: "Story Bank", title: "Story Bank", ask: "Your proof points — each result and the one number that proves it — the stories behind them, and the snapshots that point a story at one target company." },
  { key: "master-cv", page: "artefacts", label: "Master CV", title: "Master CV", ask: "The only source of truth about what you have done. Every tailored CV starts from it, and the Evaluator quotes it as evidence." },
  { key: "linkedin-profile", page: "artefacts", label: "LinkedIn profile", title: "LinkedIn profile", ask: "Your LinkedIn, section by section — headline, About, each role, Featured, skills, education, certifications — written to paste, each block against LinkedIn's limit." },
] as const satisfies readonly JhSection[];

/** Which profile.yml list a ranked section reads. `all` is the whole field, shown as Top 40. */
export const JH_LIST_OF: Record<"top3" | "top10" | "top40", CompanyListKey> = { top3: "top3", top10: "top10", top40: "all" };

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
  northstar: "roles", contact: "contact", targeting: "story", watchlist: "companies", companyLists: "top3", notes: null, cv: "master-cv", artefacts: "story-bank", linkedin: "linkedin-profile",
  narrative: "headline", jhg: "boundaries",
};

// ---- what each row shows ----

export interface JhSummary { key: JhSectionKey; state: StepState; summary: string; count?: string }

export interface JhSignals { setup: CareerOpsSetupV2 | null | undefined; profile: Profile | null | undefined }

const NOT_SET = "Not set";
/** For what the member cannot type in — only an uploaded profile.yml fills it. */
const NOT_IN_PROFILE = "Not in your profile yet";
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

/** Every section's row, all four pages. Filter by `jhSectionsFor(page)` to render one page. */
export function jhSectionSummaries(signals: JhSignals): JhSummary[] {
  const { setup } = signals;
  const g = jhGoal(signals);
  const p = setup?.personalization ?? {};
  const policy = setup?.policy ?? {};
  const roles = p.targetRoles ?? [];
  const rules = p.locationPolicy ?? [];
  const companies = setup?.portals?.companies ?? [];

  // Contact, headline, bridge story (Compass's exit story), the company list and the master CV are the same
  // rows as the Profile / Settings pages — one summary per field, wherever it is shown.
  const shared = new Map(sectionSummaries({ setup, profile: signals.profile }).map((r) => [r.key, r]));
  const borrow = (from: "contact" | "headline" | "story" | "companies" | "cv", key: JhSectionKey): JhSummary => {
    const r = shared.get(from)!;
    return { key, state: r.state, summary: r.summary, count: r.count };
  };

  const lists = setup?.companyLists;
  const competencies = p.crossCuttingAdvantage?.trim() ?? "";
  const superpowers = setup?.narrative?.superpowers ?? [];
  const jhg = setup?.jhg;
  const salaryN = [g.salary, policy.minimumSalary, p.compTargets].filter(has).length;
  const locationN = [g.city, policy.locationFlexibility, rules.length].filter(has).length;

  return [
    borrow("contact", "contact"),
    borrow("headline", "headline"),
    borrow("story", "story"),
    // The Narrative file's superpowers count too: the row quotes them when the prose is still empty.
    { key: "competencies", state: competencies ? "done" : superpowers.length ? "partial" : "empty", summary: competencies ? clip(firstLine(competencies)) : superpowers.length ? superpowers.join(", ") : NOT_SET, count: superpowers.length ? String(superpowers.length) : undefined },
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
    // Read, not filled in — the True North file's boundaries; "done" the moment the file carried any.
    { key: "boundaries", state: hasBoundaries(jhg) ? "done" : "empty", summary: boundariesSummary(jhg) || NOT_IN_PROFILE },
    {
      key: "location", state: stateOf(!!g.city?.trim(), locationN),
      summary: join([g.city, policy.locationFlexibility && clip(policy.locationFlexibility, 40), rules.length ? plural(rules.length, "rule") : undefined]) || NOT_SET,
      count: `${locationN}/3`,
    },
    // The ranked lists are read, not filled in: "done" the moment the file carried one, never "partial".
    {
      key: "top3", state: listCount(lists?.top3) ? "done" : "empty",
      summary: listCount(lists?.top3) ? clip(listCompanies(lists?.top3).map((c) => c.name).join(", ")) : NOT_IN_PROFILE,
      count: listCount(lists?.top3) ? String(listCount(lists?.top3)) : undefined,
    },
    { key: "top10", state: listCount(lists?.top10) ? "done" : "empty", summary: listSummary(lists?.top10) || NOT_IN_PROFILE, count: listCount(lists?.top10) ? String(listCount(lists?.top10)) : undefined },
    { key: "top40", state: listCount(lists?.all) ? "done" : "empty", summary: listSummary(lists?.all) || NOT_IN_PROFILE, count: listCount(lists?.all) ? String(listCount(lists?.all)) : undefined },
    {
      ...borrow("companies", "companies"),
      // The shared row counts every company; here a company with no careers page is worth a word.
      summary: companies.length
        ? join([shared.get("companies")!.summary, companies.some((c) => !c.careersUrl?.trim()) ? `${plural(companies.filter((c) => !c.careersUrl?.trim()).length, "company", "companies")} without a careers page` : undefined])
        : NOT_SET,
    },
    // The story bank is "done" the moment it has anything in it, never "partial"; empty says Not set — the member can add to it here.
    {
      key: "story-bank", state: storyBankCounts(setup).total ? "done" : "empty",
      summary: storyBankSummary(setup) || NOT_SET,
      count: storyBankCounts(setup).stories ? String(storyBankCounts(setup).stories) : undefined,
    },
    borrow("cv", "master-cv"),
    // Read, not filled in — like the story bank. The count is sections filled of LinkedIn's seven.
    {
      key: "linkedin-profile", state: linkedinSummary(setup?.linkedin) ? "done" : "empty",
      summary: linkedinSummary(setup?.linkedin) || NOT_IN_PROFILE,
      count: linkedinSummary(setup?.linkedin) ? linkedinCount(setup?.linkedin) : undefined,
    },
  ];
}

/**
 * The stored values behind one section — exactly the fields its editor shows
 * (docs/UX_JOBHACKING.md §2), as one comparable value. The upload preview
 * diffs these, so a row in the preview is a section on the page: nothing
 * more, nothing less (decision 2026-11-07).
 */
export function jhSectionFields(key: JhSectionKey, signals: JhSignals): unknown {
  const { setup } = signals;
  const g = jhGoal(signals);
  const c = setup?.contact ?? {};
  const p = setup?.personalization ?? {};
  const policy = setup?.policy ?? {};
  switch (key) {
    // Name and email are the account's (users/{uid}), shown in the same editor — so they count here too.
    case "contact": return { firstName: signals.profile?.firstName, lastName: signals.profile?.lastName, email: signals.profile?.email, phone: c.phone, linkedin: c.linkedin, github: c.github, location: c.location, portfolio: c.portfolio };
    case "headline": return c.title;
    case "story": return p.exitNarrative;
    case "competencies": return p.crossCuttingAdvantage;
    case "industry": return g.subsector;
    case "roles": return { role: g.role, archetypes: p.targetRoles };
    case "seniority": return g.seniority;
    case "salary": return { salary: g.salary, floor: policy.minimumSalary, compTargets: p.compTargets };
    case "location": return { city: g.city, flexibility: policy.locationFlexibility, rules: p.locationPolicy };
    case "company-type": return g.companyType;
    case "boundaries": return setup?.jhg?.trueNorth?.boundaries;
    case "top3": return setup?.companyLists?.top3;
    case "top10": return setup?.companyLists?.top10;
    case "top40": return setup?.companyLists?.all;
    case "companies": return setup?.portals;
    case "story-bank": return { proofPoints: setup?.narrative?.proofPoints, stories: setup?.stories, snapshots: setup?.snapshots };
    case "master-cv": return setup?.cvMarkdown;
    case "linkedin-profile": return setup?.linkedin;
  }
}

/** True when a section's value holds no text and no row — the state a row calls "empty". */
export function jhFieldsEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number" || typeof v === "boolean") return false;
  if (Array.isArray(v)) return v.every(jhFieldsEmpty);
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).every(jhFieldsEmpty);
  return false;
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
