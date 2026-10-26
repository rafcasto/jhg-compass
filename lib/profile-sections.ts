// The Profile page's sections — one registry the rail (desktop), the overview
// rows (mobile) and the upload diff all read from.
//
// Order = the order the agents care about = profile.yml key order = the intake
// wizard's steps, so the wizard and the Profile page describe the same things
// in the same words. State rules are the wizard's (wizardStates), not a second
// opinion.
//
// Reserved sections (cultureScreen, proofPoints, stories — docs/LA_MALETA.md)
// are registered with `available: false` and never rendered: a field the
// agents do not read yet is a broken promise. Flip the flag the day the worker
// reads them.
//
// Pure — no React. Tested.

import { effectiveGoal } from "./careerops/intake";
import { cvReadiness } from "./careerops/intake";
import { wizardStates, type StepState } from "./careerops/intake-wizard";
import { SECTIONS, SECTION_COPY } from "./careerops/personalization";
import type { CareerOpsSetupV2 } from "./careerops/types";
import type { Profile } from "./types";

export interface ProfileSection {
  key: string;
  /** Rail / row label — short. */
  label: string;
  /** The heading on the section itself. */
  title: string;
  /** One line under the heading: what this section is for. */
  ask: string;
  /** False = registered for later, never rendered. */
  available: boolean;
}

export const PROFILE_SECTIONS = [
  { key: "northstar", label: "North Star", title: "Your North Star goal", ask: "The role, industry, company type, place and salary every evaluation is scored against.", available: true },
  { key: "contact", label: "Contact & logistics", title: "Contact details and logistics", ask: "What lands on your generated CV and cover letters, and the salary floor, visa and location facts scoring weighs.", available: true },
  { key: "targeting", label: "Targeting", title: "What evaluations score against", ask: "Your target archetypes, how to frame you for each, your exit narrative and your edge.", available: true },
  { key: "watchlist", label: "Watchlist", title: "Your company watchlist", ask: "The careers pages the Scout checks, and the title keywords it includes and excludes.", available: true },
  { key: "notes", label: "Notes", title: "Notes for the agents", ask: "Hard no's, culture must-haves, never-apply companies, house rules — free text every agent reads.", available: true },
  { key: "cv", label: "CV", title: "Your CV", ask: "The only source of truth about what you have done. The Evaluator quotes it as evidence.", available: true },
  { key: "culture", label: "Culture screen", title: "Culture screen", ask: "Reserved.", available: false },
  { key: "proof", label: "Proof points", title: "Proof points", ask: "Reserved.", available: false },
  { key: "stories", label: "Stories", title: "Interview stories", ask: "Reserved.", available: false },
] as const satisfies readonly ProfileSection[];

export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number]["key"];
export type ActiveSectionKey = Exclude<ProfileSectionKey, "culture" | "proof" | "stories">;

/** The sections that render, in order. */
export const ACTIVE_SECTIONS = PROFILE_SECTIONS.filter((s) => s.available) as readonly (ProfileSection & { key: ActiveSectionKey })[];

export const DEFAULT_SECTION: ActiveSectionKey = "northstar";

/** `?section=targeting` → "targeting"; unknown, reserved or absent → null (the overview). */
export function parseSection(raw: string | null | undefined): ActiveSectionKey | null {
  return ACTIVE_SECTIONS.some((s) => s.key === raw) ? (raw as ActiveSectionKey) : null;
}

export const findSection = (key: string): ProfileSection | undefined =>
  (PROFILE_SECTIONS as readonly ProfileSection[]).find((s) => s.key === key);

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
}

const join = (parts: (string | undefined | null)[], sep = " · ") => parts.map((p) => p?.trim()).filter(Boolean).join(sep);
const NOT_SET = "Not set";

export function sectionSummaries({ setup, profile }: SectionSignals): SectionSummary[] {
  const goal = effectiveGoal({ source: setup?.goalSource, compassGoal: profile?.goal, intakeGoal: setup?.intakeGoal });
  const g = goal.goal;
  const states = wizardStates({
    hasCv: !!setup?.cvMarkdown?.trim(),
    goalRole: g.role ?? null,
    contact: setup?.contact,
    policy: setup?.policy,
    personalization: setup?.personalization,
    companies: setup?.portals?.companies?.length ?? 0,
  });

  const contact = setup?.contact ?? {};
  const policy = setup?.policy ?? {};
  const p = setup?.personalization ?? {};
  const filledSections = SECTIONS.filter((s) => {
    const v = (p as Record<string, unknown>)[s.id];
    return v !== undefined && v !== "" && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && v && !Array.isArray(v) && !Object.values(v).some(Boolean));
  });
  const companies = setup?.portals?.companies ?? [];
  const notes = setup?.notes?.trim() ?? "";
  const cv = setup?.cvMarkdown?.trim() ?? "";
  const readiness = cv ? cvReadiness(cv) : null;

  return [
    {
      key: "northstar", state: states.northstar,
      summary: join([g.role, g.city, g.salary]) || NOT_SET,
      count: g.role ? (goal.source === "intake" ? "profile" : "Compass") : undefined,
    },
    {
      key: "contact", state: states.contact,
      summary: join([contact.phone, contact.linkedin && "LinkedIn", policy.minimumSalary && `floor ${policy.minimumSalary}`, policy.authorizedIn?.length ? policy.authorizedIn.join(" / ") : undefined]) || NOT_SET,
    },
    {
      key: "targeting", state: states.targeting,
      summary: filledSections.length
        ? join(filledSections.slice(0, 3).map((s) => (s.id === "targetRoles" ? `${p.targetRoles!.length} ${p.targetRoles!.length === 1 ? "role" : "roles"}` : SECTION_COPY[s.id].label.toLowerCase())))
          + (filledSections.length > 3 ? ` +${filledSections.length - 3}` : "")
        : NOT_SET,
      count: `${filledSections.length}/${SECTIONS.length}`,
    },
    {
      key: "watchlist", state: states.watchlist,
      summary: companies.length ? companies.slice(0, 3).map((c) => c.name).join(", ") + (companies.length > 3 ? "…" : "") : NOT_SET,
      count: companies.length ? String(companies.length) : undefined,
    },
    {
      key: "notes", state: notes ? "done" : "empty",
      summary: notes ? notes.split("\n")[0] : NOT_SET,
    },
    {
      key: "cv", state: states.cv,
      summary: readiness ? `${readiness.words} words · ${readiness.scoreable ? "Ready to score" : "A bit thin"}` : NOT_SET,
    },
  ];
}

export interface ProfileProgress { done: number; total: number; pct: number }

/** Over every rendered section — the Profile page shows the whole picture, not just the required three. */
export function profileProgress(rows: SectionSummary[]): ProfileProgress {
  const done = rows.filter((r) => r.state === "done").length;
  return { done, total: rows.length, pct: rows.length ? Math.round((done / rows.length) * 100) : 0 };
}
