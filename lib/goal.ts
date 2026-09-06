import type { Profile, CompassFormula } from "./types";

// The member's objective — every field feeds the goal statement on the Compass
// tab AND onboarding step 2 (both render the same GoalFields / GoalStatement).
// All strings, all optional: the statement renders placeholders for blanks.
//
// Storage keys are kept stable so previously saved objectives keep rendering;
// the labels shown to members are the source of truth for meaning:
//   role        -> "Seniority level + Job title"
//   subsector   -> "Industry"
//   companyType -> "Company type" (one of COMPANY_TYPES)
//   city        -> "Geography (country, region, city, area)"
//   salary      -> "Salary range (compensation)"
export interface Goal {
  role?: string;        // e.g. "Senior Product Owner"
  subsector?: string;   // e.g. "climate-tech SaaS"
  companyType?: string; // e.g. "Startup (early stage)"
  city?: string;        // e.g. "Auckland, New Zealand"
  salary?: string;      // e.g. "180,000 – 220,000"
}

// Display order of the form fields — shared by Compass edit mode and onboarding.
export const GOAL_KEYS = ["role", "subsector", "companyType", "city", "salary"] as const;

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

export const EMPTY_GOAL: Goal = { role: "", subsector: "", companyType: "", city: "", salary: "" };

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
