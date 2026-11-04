// JobHacking → Artefacts → LinkedIn profile — docs/UX_JOBHACKING.md §3d.
//
// The LinkedIn profile as the member builds it, one block per LinkedIn section,
// each shown against LinkedIn's own limit with a Copy button. The Packer writes
// profile.yml `linkedin`; the member reads and pastes. Read-only, like the
// story bank; nothing here invents a field. Pure — no React. Tested.

import { LINKEDIN_LIMITS } from "../careerops/profile-schema";
import type { LinkedinExperience, LinkedinProfile } from "../careerops/types";

export { LINKEDIN_LIMITS };

export type LinkedinSectionKey = keyof LinkedinProfile;

export interface LinkedinSectionDef { key: LinkedinSectionKey; label: string }

/** LinkedIn's own order, top of the profile to the bottom. */
export const LINKEDIN_SECTIONS = [
  { key: "headline", label: "Headline" },
  { key: "about", label: "About" },
  { key: "experience", label: "Experience" },
  { key: "featured", label: "Featured" },
  { key: "skills", label: "Skills" },
  { key: "education", label: "Education" },
  { key: "certifications", label: "Licenses & certifications" },
] as const satisfies readonly LinkedinSectionDef[];

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const rows = <T,>(v: readonly T[] | null | undefined): T[] => (Array.isArray(v) ? v.filter(Boolean) : []);

/** The sections the file carries something for, in LinkedIn's order. */
export function linkedinPresent(p: LinkedinProfile | null | undefined): LinkedinSectionDef[] {
  if (!p) return [];
  return LINKEDIN_SECTIONS.filter((s) => {
    const v = p[s.key];
    return Array.isArray(v) ? v.length > 0 : text(v) !== "";
  });
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Headline · About · 3 roles · 12 skills · 1 certification" — only what the file carries; "" when nothing. */
export function linkedinSummary(p: LinkedinProfile | null | undefined): string {
  if (!p) return "";
  return linkedinPresent(p).map((s) => {
    switch (s.key) {
      case "headline": case "about": return s.label;
      case "experience": return plural(rows(p.experience).length, "role");
      case "featured": return plural(rows(p.featured).length, "featured item");
      case "skills": return plural(rows(p.skills).length, "skill");
      case "education": return plural(rows(p.education).length, "school");
      case "certifications": return plural(rows(p.certifications).length, "certification");
    }
  }).join(" · ");
}

/** "5/7" — how many of LinkedIn's sections the file fills. */
export const linkedinCount = (p: LinkedinProfile | null | undefined): string => `${linkedinPresent(p).length}/${LINKEDIN_SECTIONS.length}`;

/** Length against a LinkedIn limit — the one red state on the panel is `over`. */
export interface Measure { length: number; limit: number; over: boolean }
export const measure = (s: string | undefined, limit: number): Measure => ({ length: (s ?? "").length, limit, over: (s ?? "").length > limit });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2022-03" → "Mar 2022"; "2015" → "2015"; anything else as written. */
export function monthYear(v: string | undefined): string {
  const t = text(v);
  const m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (m) { const i = Number(m[2]) - 1; return i >= 0 && i < 12 ? `${MONTHS[i]} ${m[1]}` : t; }
  return t;
}

/** "Mar 2022 – Present", "2012 – 2015", "Jun 2019". An empty end on a role is Present; on a school it is left out. */
export function dateRange(start: string | undefined, end: string | undefined, { presentWhenOpen = true } = {}): string {
  const s = monthYear(start), e = monthYear(end);
  if (!s && !e) return "";
  if (!e) return presentWhenOpen ? `${s} – Present` : s;
  if (!s) return e;
  return `${s} – ${e}`;
}

/** The role's heading as LinkedIn shows it: "Delivery Lead · FreightDesk Software". */
export const roleLine = (e: LinkedinExperience): string => [text(e.title), text(e.company)].filter(Boolean).join(" · ");

/** The role's quiet line: "Mar 2022 – Present · Wellington, New Zealand". */
export const roleMeta = (e: LinkedinExperience): string => [dateRange(e.start, e.end), text(e.location)].filter(Boolean).join(" · ");

/** The skills list as LinkedIn takes it — one per line is what the Skills form accepts fastest. */
export const skillsText = (skills: readonly string[] | undefined): string => rows(skills).map((s) => s.trim()).filter(Boolean).join("\n");
