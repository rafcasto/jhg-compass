// The one registry of the member's profile pages — docs/UX_JOBHACKING.md,
// docs/UX_SETTINGS_HUB.md.
//
// Two portals render it. The JobHacking portal: four menu pages, each a
// sectioned page (components/profile/SectionsPage.tsx), plus Settings (the
// four-file upload). Compass (decision 2026-11-07): Settings is a hub whose
// areas are the same pages under /settings, plus the sections only Compass's
// agents read — flagged `only: "compass"` and filtered away for JobHacking,
// whose pages render exactly as specified.
//
//   /jobhacking/narrative    /settings/narrative    Contact details · Headline · Bridge story · Core competencies
//   /jobhacking/true-north   /settings/true-north   Target industry · Target roles · Seniority · Salary range · Location · Work rights* · Company type · Boundaries
//   /jobhacking/companies    /settings/companies    Top 3 · Top 10 · Top 40 (the Packer's ranked lists, read-only) · Watchlist
//   /jobhacking/artefacts    /settings/artefacts    Story Bank (edited on request) · Master CV · LinkedIn profile (read-only) · Portfolio / demo*
//                            /settings/agents*      Portal accounts (CareerOps only) · Notes for the agents
//   /jobhacking/settings     /settings              Upload the four Packer files (narrative · true-north · target-companies · artefacts)
//
//   * Compass only.
//
// The JobHacking shell's menu (decision 2026-11-08, docs/UX_JOBHACKING.md §9)
// is JH_NAV: two groups — JobHacker Compass (Narrative · True North · Target
// companies) and Artefacts (Story Bank · Master CV · LN) — over the same pages;
// the Artefacts rows are that page's sections.
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
import { type Goal, type TrueNorthBlanks } from "../goal";
import { sectionSummaries, type FileSectionKey } from "../profile-sections";
import type { Profile } from "../types";
import { listCompanies, listCount, listSummary, type CompanyListKey } from "./company-lists";
import { linkedinCount, linkedinSummary } from "./linkedin-profile";
import { storyBankCounts, storyBankSummary } from "./story-bank";
import { boundariesSummary, hasBoundaries } from "./workbook";

/** Which portal is rendering the registry. */
export type ProfilePortal = "compass" | "jobhacking";
export const JH_BASE = "/jobhacking";
export const SETTINGS_BASE = "/settings";
export const BASE_OF: Record<ProfilePortal, string> = { compass: SETTINGS_BASE, jobhacking: JH_BASE };

export type JhPageKey = "narrative" | "true-north" | "companies" | "artefacts" | "agents";

export interface JhPage {
  key: JhPageKey;
  label: string;
  /** Where the page lives on the portal that owns it (JobHacking; Settings for a Compass-only page). jhPageHref() for a given portal. */
  href: string;
  title: string;
  intro: string;
  /** Rendered by one portal only. */
  only?: ProfilePortal;
}

export const JH_PAGES = [
  { key: "narrative", label: "Narrative", href: "/jobhacking/narrative", title: "Narrative", intro: "Who you are: the contact block of every application, what you're best at, the one line under your name, and why you're moving." },
  { key: "true-north", label: "True North", href: "/jobhacking/true-north", title: "True North", intro: "What you're aiming at. Every section fills a blank in the statement." },
  { key: "companies", label: "Target companies", href: "/jobhacking/companies", title: "Target companies", intro: "The companies you're going after — your Top 3, your Top 10 and the whole ranked field, sunrise and sunset — plus the careers pages to watch and the job titles to include and exclude." },
  { key: "artefacts", label: "Artefacts", href: "/jobhacking/artefacts", title: "Artefacts", intro: "What you bring to every application: the stories and proof points behind every answer, the master CV every tailored CV starts from, and the LinkedIn profile to build from them." },
] as const satisfies readonly JhPage[];

/** Compass only: what the agents read that no coach file page shows (docs/UX_SETTINGS_HUB.md §1). */
export const AGENTS_PAGE = {
  key: "agents", label: "Agents", href: "/settings/agents", title: "Agents", only: "compass",
  intro: "What only the agents work from: the portal accounts they sign in with, and the notes every one of them reads before it acts.",
} as const satisfies JhPage;

/** Every page, both portals. */
export const ALL_PAGES: readonly JhPage[] = [...JH_PAGES, AGENTS_PAGE];
/** The pages one portal renders, in order. */
export const jhPagesFor = (portal: ProfilePortal): readonly JhPage[] => ALL_PAGES.filter((p) => !p.only || p.only === portal);
/** A page's URL on a portal: /jobhacking/true-north · /settings/true-north. */
export const jhPageHref = (key: JhPageKey, base: string = JH_BASE): string => `${base}/${key}`;

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
  /** Rendered by one portal only (the Compass agents' fields, docs/UX_SETTINGS_HUB.md §1). */
  only?: ProfilePortal;
  /** Needs the CareerOps worker (the member must have the portal switched on). */
  requires?: "careerOps";
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
  // Work rights (Compass only, 2026-11-07): visa, where work rights are held, sponsorship — kept out of the JobHacking Location section (decision D).
  { key: "work-rights", page: "true-north", label: "Work rights", title: "Right to work", ask: "Your visa status, the countries where you already hold work rights, and whether you need sponsorship — when you do, a posting that won't sponsor is a hard blocker.", only: "compass" },
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
  // Compass only (2026-11-07): an artefact the agents can point to.
  { key: "portfolio", page: "artefacts", label: "Portfolio / demo", title: "Portfolio or demo", ask: "A live demo, dashboard or public project the agents can point to, and when it's worth sharing.", only: "compass" },
  // ---- Agents (Compass only, 2026-11-07): what only the agents read ----
  { key: "accounts", page: "agents", label: "Portal accounts", title: "Career portal accounts", ask: "The candidate accounts you created on Workday, SuccessFactors and other portals, so the agents can read the whole application form. Encrypted in your browser.", only: "compass", requires: "careerOps" },
  { key: "notes", page: "agents", label: "Notes for the agents", title: "Notes for the agents", ask: "Hard no's, never-apply companies, CV house rules — free text every agent reads before it acts.", only: "compass" },
] as const satisfies readonly JhSection[];

/** Which profile.yml list a ranked section reads. `all` is the whole field, shown as Top 40. */
export const JH_LIST_OF: Record<"top3" | "top10" | "top40", CompanyListKey> = { top3: "top3", top10: "top10", top40: "all" };

export type JhSectionKey = (typeof JH_SECTIONS)[number]["key"];
export type JhSectionDef = JhSection & { key: JhSectionKey };

export const findJhPage = (key: string): JhPage | undefined => ALL_PAGES.find((p) => p.key === key);
export const findJhSection = (key: string): JhSectionDef | undefined => (JH_SECTIONS as readonly JhSectionDef[]).find((s) => s.key === key);

export interface PortalOptions {
  /** Which portal is rendering — JobHacking by default, so the portal's own pages read exactly as specified. */
  portal?: ProfilePortal;
  /** The member has the CareerOps portal switched on — unlocks sections that need the worker. */
  careerOps?: boolean;
}

/** The sections one page renders on one portal, in order. */
export const jhSectionsFor = (page: JhPageKey, { portal = "jobhacking", careerOps = false }: PortalOptions = {}): readonly JhSectionDef[] =>
  (JH_SECTIONS as readonly JhSectionDef[]).filter((s) => s.page === page && (!s.only || s.only === portal) && (!s.requires || careerOps));

/** Deep link to a section on its page: /jobhacking/true-north?section=salary · /settings/true-north?section=salary. */
export const jhSectionHref = (key: JhSectionKey, base: string = JH_BASE): string => `${jhPageHref(findJhSection(key)!.page, base)}?section=${key}`;

/** `?section=roles` → "roles"; unknown, absent or another page's key → null (the overview). */
export function parseJhSection(raw: string | null | undefined, sections: readonly JhSectionDef[] = JH_SECTIONS as readonly JhSectionDef[]): JhSectionKey | null {
  return sections.some((s) => s.key === raw) ? (raw as JhSectionKey) : null;
}

// ---- the JobHacking shell's menu (decision 2026-11-08, docs/UX_JOBHACKING.md §9) ----
//
// Two groups, not four flat rows. **JobHacker Compass** is who you are and
// where you're going — Narrative · True North · Target companies — and
// **Artefacts** is what you bring — Story Bank · Master CV · LN. The Artefacts
// rows are that page's sections: on desktop the sidebar is the page's rail, so
// the page renders without one (`jhSectionsInMenu`); on mobile the bottom bar
// keeps the four pages and the Artefacts overview rows stay the sub-menu, as on
// every sectioned page. A menu row may carry a shorter label than its section
// (LN for LinkedIn profile — Rafael's call, 2026-11-08); the section's own
// label and heading are untouched. The registry itself is unchanged — Artefacts
// is still one page for the share link, the upload preview and the Settings hub.

export type JhNavGroupKey = "compass" | "artefacts";
export interface JhNavItem {
  key: string;
  label: string;
  href: string;
  page: JhPageKey;
  /** Set when the row is a section of its page, not the page itself. */
  section?: JhSectionKey;
}
export interface JhNavGroup { key: JhNavGroupKey; label: string; items: readonly JhNavItem[] }

const navPage = (key: JhPageKey): JhNavItem => { const p = findJhPage(key)!; return { key: p.key, label: p.label, href: p.href, page: p.key }; };
const navSection = (s: JhSectionDef): JhNavItem => ({ key: s.key, label: JH_NAV_LABEL[s.key] ?? s.label, href: jhSectionHref(s.key), page: s.page, section: s.key });

/** The menu's shorter word for a section, where it has one. */
const JH_NAV_LABEL: Partial<Record<JhSectionKey, string>> = { "linkedin-profile": "LN" };

export const JH_NAV: readonly JhNavGroup[] = [
  { key: "compass", label: "JobHacker Compass", items: [navPage("narrative"), navPage("true-north"), navPage("companies")] },
  { key: "artefacts", label: "Artefacts", items: jhSectionsFor("artefacts").map(navSection) },
];

/** True when a page's sections are rows of the shell's menu — on desktop the sidebar is its rail. */
export const jhSectionsInMenu = (page: JhPageKey): boolean => JH_NAV.some((g) => g.items.some((i) => i.page === page && !!i.section));

/**
 * Whether a menu row is the lit one for a URL. A page row: its path. A section
 * row: its page's path and the open section — the first of its page when
 * `?section=` is absent or unknown, since that is the section the page opens on.
 */
export function jhNavActive(item: JhNavItem, pathname: string, section: string | null | undefined): boolean {
  const href = jhPageHref(item.page);
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false;
  if (!item.section) return true;
  const rows = JH_NAV.flatMap((g) => g.items).filter((i) => i.page === item.page && i.section);
  const open = rows.find((i) => i.section === section) ?? rows[0];
  return open.key === item.key;
}

/**
 * Where an uploaded profile.yml's sections land in this portal — the links on
 * the "unpacked" status line. null: stored, but no JobHacking section shows it.
 */
export const JH_FILE_EDIT: Record<FileSectionKey, JhSectionKey | null> = {
  northstar: "roles", contact: "contact", targeting: "story", watchlist: "companies", companyLists: "top3", notes: "notes", cv: "master-cv", artefacts: "story-bank", linkedin: "linkedin-profile",
  narrative: "headline", jhg: "boundaries",
};

/** The link for a file section on one portal — null when that portal has no section showing it (notes is Compass only). */
export function jhFileEditHref(key: FileSectionKey, portal: ProfilePortal = "jobhacking"): string | null {
  const section = JH_FILE_EDIT[key];
  if (!section) return null;
  const def = findJhSection(section)!;
  if (def.only && def.only !== portal) return null;
  return jhSectionHref(section, BASE_OF[portal]);
}

// ---- what each row shows ----

export interface JhSummary { key: JhSectionKey; state: StepState; summary: string; count?: string }

export interface JhSignals {
  setup: CareerOpsSetupV2 | null | undefined;
  profile: Profile | null | undefined;
  /** Portal accounts in the vault (users/{uid}/careerOpsVault) — the Compass-only Agents · Portal accounts row. */
  accounts?: number;
}

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
  const shared = new Map(sectionSummaries({ setup, profile: signals.profile, accounts: signals.accounts ?? 0 }).map((r) => [r.key, r]));
  const borrow = (from: "contact" | "headline" | "story" | "companies" | "cv" | "portfolio" | "accounts" | "notes", key: JhSectionKey): JhSummary => {
    const r = shared.get(from)!;
    return { key, state: r.state, summary: r.summary, count: r.count };
  };

  const lists = setup?.companyLists;
  const competencies = p.crossCuttingAdvantage?.trim() ?? "";
  const superpowers = setup?.narrative?.superpowers ?? [];
  const jhg = setup?.jhg;
  const salaryN = [g.salary, policy.minimumSalary, p.compTargets].filter(has).length;
  // A zero-length list is nothing set — `has` keeps numbers, so pass undefined for an empty one.
  const locationN = [g.city, policy.locationFlexibility, rules.length || undefined].filter(has).length;
  const rightsN = [policy.visaStatus, policy.authorizedIn?.length || undefined, policy.needsSponsorship].filter(has).length;

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
    // Compass only — the visa line leads; the countries and the sponsorship flag support it.
    {
      key: "work-rights", state: stateOf(!!policy.visaStatus?.trim(), rightsN),
      summary: join([policy.visaStatus && clip(policy.visaStatus, 40), policy.authorizedIn?.length ? policy.authorizedIn.join(" / ") : undefined, policy.needsSponsorship && "needs sponsorship"]) || NOT_SET,
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
    borrow("portfolio", "portfolio"),
    borrow("accounts", "accounts"),
    borrow("notes", "notes"),
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
    // Target roles carries the framing per archetype; Salary range the negotiation scripts (decision 2026-11-07, docs/UX_SETTINGS_HUB.md §1).
    case "roles": return { role: g.role, archetypes: p.targetRoles, framing: p.adaptiveFraming };
    case "seniority": return g.seniority;
    case "salary": return { salary: g.salary, floor: policy.minimumSalary, compTargets: p.compTargets, scripts: p.negotiationScripts };
    case "location": return { city: g.city, flexibility: policy.locationFlexibility, rules: p.locationPolicy };
    case "work-rights": return { visaStatus: policy.visaStatus, authorizedIn: policy.authorizedIn, needsSponsorship: policy.needsSponsorship };
    case "company-type": return g.companyType;
    case "boundaries": return setup?.jhg?.trueNorth?.boundaries;
    case "top3": return setup?.companyLists?.top3;
    case "top10": return setup?.companyLists?.top10;
    case "top40": return setup?.companyLists?.all;
    case "companies": return setup?.portals;
    case "story-bank": return { proofPoints: setup?.narrative?.proofPoints, stories: setup?.stories, snapshots: setup?.snapshots };
    case "master-cv": return setup?.cvMarkdown;
    case "linkedin-profile": return setup?.linkedin;
    case "portfolio": return p.portfolio;
    // The vault is not in the file.
    case "accounts": return null;
    case "notes": return setup?.notes;
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

// ---- the hub's rows (Compass → Settings, docs/UX_SETTINGS_HUB.md §2) ----

export interface JhAreaRow { key: JhPageKey; state: StepState; summary: string; count: string }

/**
 * One row per page of a portal: done when every section is, partial from the
 * first, else empty; the summary quotes the first section that has anything
 * (the row shows data, not a description); the count is done/total.
 */
export function jhAreaRows(signals: JhSignals, opts: PortalOptions = {}): JhAreaRow[] {
  const rows = jhSectionSummaries(signals);
  return jhPagesFor(opts.portal ?? "jobhacking").map((page) => {
    const mine = jhRowsFor(jhSectionsFor(page.key, opts), rows);
    const done = mine.filter((r) => r.state === "done").length;
    const started = mine.filter((r) => r.state !== "empty");
    const state: StepState = mine.length && done === mine.length ? "done" : started.length ? "partial" : "empty";
    return { key: page.key, state, summary: started[0]?.summary ?? NOT_SET, count: `${done}/${mine.length}` };
  });
}

/** The rows for one page's sections, in that page's order. */
export function jhRowsFor(sections: readonly JhSectionDef[], rows: JhSummary[]): JhSummary[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return sections.map((s) => byKey.get(s.key)!).filter(Boolean);
}

// ---- the True North statement ----
//
// The sentence itself lives in lib/goal (one statement for the Compass tab,
// onboarding and True North — decision 2026-11-07); re-exported here so the
// portal's imports read as one module.
export { TRUE_NORTH_PLACEHOLDERS, TRUE_NORTH_ORDER, trueNorthBlanks, trueNorthText, type TrueNorthBlanks } from "../goal";

/** Which section fills each blank — the statement's values link there. */
export const TRUE_NORTH_SECTION: Record<keyof TrueNorthBlanks, JhSectionKey> = {
  role: "roles", industry: "industry", location: "location", salary: "salary", companyType: "company-type",
};

