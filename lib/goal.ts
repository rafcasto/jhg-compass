import type { Profile, CompassFormula } from "./types";

// The member's objective — every field feeds the goal statement on the Compass
// tab AND onboarding step 2 (both render the same GoalFields / GoalStatement).
// All strings, all optional: the statement renders placeholders for blanks.
//
// Storage keys are kept stable so previously saved objectives keep rendering;
// the labels shown to members are the source of truth for meaning:
//   role        -> "Job title"
//   seniority   -> "Seniority level" (added 2026-11-03 for the JobHacking portal's
//                  True North; older goals carry it inside `role`, e.g. "Senior PO")
//   subsector   -> "Industry"
//   companyType -> "Company type" (one of COMPANY_TYPES)
//   city        -> "Geography (country, region, city, area)"
//   salary      -> "Salary range (compensation)"
export interface Goal {
  role?: string;        // e.g. "Product Owner"
  seniority?: string;   // e.g. "Senior"
  subsector?: string;   // e.g. "climate-tech SaaS"
  companyType?: string; // e.g. "Startup (early stage)"
  city?: string;        // e.g. "Auckland, New Zealand"
  salary?: string;      // e.g. "180,000 – 220,000"
}

// Display order of the form fields — shared by Compass edit mode and onboarding.
// The order of the statement (2026-11-07): title + level, industry, location,
// salary, company type.
export const GOAL_KEYS = ["role", "seniority", "subsector", "city", "salary", "companyType"] as const;
export type GoalKey = (typeof GOAL_KEYS)[number];

export const COMPANY_TYPES = [
  "Multinational Company (MNC)",
  "Family Business",
  "Scaleup (established)",
  "Startup (early stage)",
  "Small Business",
  "Government",
  "Not-For-Profit Organisation (NPO)",
] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

// How each option reads inline in the statement: "I enjoy working for {phrase}".
const COMPANY_ARTICLE: Record<CompanyType, string> = {
  "Multinational Company (MNC)": "a",
  "Family Business": "a",
  "Scaleup (established)": "a",
  "Startup (early stage)": "a",
  "Small Business": "a",
  "Government": "the",
  "Not-For-Profit Organisation (NPO)": "a",
};
export function companyTypePhrase(value?: string): string {
  const v = value?.trim();
  if (!v) return "";
  const article = COMPANY_ARTICLE[v as CompanyType];
  return article ? `${article} ${v}` : v;
}

/** "Senior" + "Product Owner" → "Senior Product Owner"; either half alone is returned as is. */
export function roleWithSeniority(g: Pick<Goal, "role" | "seniority">): string {
  const role = (g.role ?? "").trim(), sen = (g.seniority ?? "").trim();
  if (sen && role && !role.toLowerCase().startsWith(sen.toLowerCase())) return `${sen} ${role}`;
  return role || sen;
}

export const EMPTY_GOAL: Goal = { role: "", seniority: "", subsector: "", companyType: "", city: "", salary: "" };

// Older values written by the legacy onboarding (`profile.compass`, bare
// values) and by the first Compass-tab release (article-prefixed values).
// Mapped on read so existing members don't land on a blank / stale option.
const LEGACY_COMPANY: Record<string, CompanyType> = {
  startup: "Startup (early stage)",
  "a startup": "Startup (early stage)",
  small: "Small Business",
  "an SME": "Small Business",
  "mid-size": "Scaleup (established)",
  "a scale-up": "Scaleup (established)",
  large: "Multinational Company (MNC)",
  "a large enterprise": "Multinational Company (MNC)",
};
export function normalizeCompanyType(value?: string): string {
  const v = (value ?? "").trim();
  return LEGACY_COMPANY[v] ?? v;
}

export function goalFromLegacy(c?: CompassFormula | null): Goal {
  if (!c) return { ...EMPTY_GOAL };
  return {
    role: c.jobTitle ?? "",
    subsector: c.industry ?? "",
    companyType: normalizeCompanyType(c.companyType),
    city: c.geography ?? "",
    salary: c.targetSalary ?? "",
  };
}

export function goalFromProfile(p?: Profile | null): Goal {
  if (p?.goal) return { ...EMPTY_GOAL, ...p.goal, companyType: normalizeCompanyType(p.goal.companyType) };
  return goalFromLegacy(p?.compass);
}

// Trim every field before persisting.
export function normalizeGoal(g: Goal): Goal {
  const out: Goal = {};
  for (const k of GOAL_KEYS) out[k] = (g[k] ?? "").trim();
  out.companyType = normalizeCompanyType(out.companyType);
  return out;
}

// ---- the statement ----
//
// One sentence everywhere — the Compass tab, onboarding step 2, JobHacking →
// True North and Settings → True North (decision 2026-11-07: the Compass goal
// statement reads as the True North statement):
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

/** The blanks in the order they appear in the statement. */
export const TRUE_NORTH_ORDER: readonly (keyof TrueNorthBlanks)[] = ["role", "industry", "location", "salary", "companyType"];

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
