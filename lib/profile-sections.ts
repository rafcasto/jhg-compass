// What both portals share about the member's profile — docs/UX_PROFILE.md,
// docs/UX_SETTINGS_HUB.md:
//
//   • the storage sections of profile.yml (FILE_SECTIONS) — the grouping the
//     upload review of a whole profile.yml diffs at;
//   • one summary row per stored field group (sectionSummaries) — the line a
//     list row quotes, and the state glyph beside it.
//
// The PAGES — which section is shown where, on JobHacking and on Compass →
// Settings — are lib/jobhacking/sections.ts (one registry, decision
// 2026-11-07; the two-page Profile / Settings registry that lived here was
// retired with the Profile page).
//
// Pure — no React. Tested.

import { cvReadiness, effectiveGoal } from "./careerops/intake";
import type { StepState } from "./careerops/intake-wizard";
import { SECTION_COPY } from "./careerops/personalization";
import type { CareerOpsSetupV2 } from "./careerops/types";
import type { Profile } from "./types";

/** The stored field groups a row summarises — the keys the registry borrows by. */
export type ActiveSectionKey =
  | "contact" | "headline" | "story" | "northstar" | "logistics" | "targeting"
  | "cv" | "companies" | "accounts" | "archetypes" | "portfolio" | "notes";

// ---- the file's sections ----
//
// profile.yml is grouped by storage (goal · contact+policy · personalization ·
// watchlist · notes · cv · …). The upload review of a whole profile.yml diffs
// the file at that level; where a member goes afterwards is jhFileEditHref()
// in lib/jobhacking/sections.

export const FILE_SECTIONS = {
  northstar: { label: "North Star" },
  contact: { label: "Contact & logistics" },
  targeting: { label: "Targeting" },
  watchlist: { label: "Target companies" },
  companyLists: { label: "Company lists" },
  notes: { label: "Notes" },
  cv: { label: "Master CV" },
  artefacts: { label: "Stories & proof points" },
  linkedin: { label: "LinkedIn profile" },
  // narrative.headline · superpowers — the Narrative file's positioning line (2026-11-07).
  narrative: { label: "Narrative headline & superpowers" },
  // jhg — the JobHackers workbook behind the four files (2026-11-07). Read beside the sections it explains.
  jhg: { label: "Workbook" },
} as const satisfies Record<string, { label: string }>;

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

/** Every storage row. The registry (lib/jobhacking/sections) borrows the ones it shows and adds its own. */
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

/** Member-facing name of one of the eight targeting sub-sections, for summaries and diffs. */
export const targetingLabel = (id: keyof typeof SECTION_COPY): string => SECTION_COPY[id].label.toLowerCase();
