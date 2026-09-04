import type { Profile, CompassFormula } from "./types";

// The member's objective — every field feeds the goal statement on the Compass tab.
// All strings, all optional: the statement renders placeholders for blanks.
export interface Goal {
  role?: string;        // job title + seniority, e.g. "Senior Product Owner"
  salary?: string;      // yearly, before tax, e.g. "250,000"
  city?: string;        // e.g. "Auckland"
  subsector?: string;   // thriving industry subsector, e.g. "climate-tech SaaS"
  companyType?: string; // article-prefixed so it reads inline: "a startup"
}

export const GOAL_KEYS = ["role", "salary", "city", "subsector", "companyType"] as const;

// Option values are article-prefixed because they are dropped straight into the
// sentence: "I enjoy working for {companyType}, with flexible…".
export const COMPANY_TYPES = ["a startup", "an SME", "a scale-up", "a large enterprise"] as const;

export const EMPTY_GOAL: Goal = { role: "", salary: "", city: "", subsector: "", companyType: "" };

// Legacy onboarding wrote `profile.compass` (jobTitle / industry / geography /
// targetSalary / companyType with bare values). Map it once so existing members
// don't land on an empty statement.
const LEGACY_COMPANY: Record<string, string> = {
  startup: "a startup",
  small: "an SME",
  "mid-size": "a scale-up",
  large: "a large enterprise",
};

export function goalFromLegacy(c?: CompassFormula | null): Goal {
  if (!c) return { ...EMPTY_GOAL };
  return {
    role: c.jobTitle ?? "",
    salary: c.targetSalary ?? "",
    city: c.geography ?? "",
    subsector: c.industry ?? "",
    companyType: c.companyType ? (LEGACY_COMPANY[c.companyType] ?? c.companyType) : "",
  };
}

export function goalFromProfile(p?: Profile | null): Goal {
  if (p?.goal) return { ...EMPTY_GOAL, ...p.goal };
  return goalFromLegacy(p?.compass);
}

// Trim every field before persisting.
export function normalizeGoal(g: Goal): Goal {
  const out: Goal = {};
  for (const k of GOAL_KEYS) out[k] = (g[k] ?? "").trim();
  return out;
}
