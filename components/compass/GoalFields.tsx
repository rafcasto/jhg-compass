"use client";

import { COMPANY_TYPES, GOAL_KEYS, type Goal } from "@/lib/goal";

// The ONE objective form. Rendered in Compass edit mode and in onboarding step 2
// so the two can never drift: same fields, same labels, same order, same options.
// Field order (GOAL_KEYS) is the order of the statement: role (job title),
// seniority, subsector (industry), city (location), salary (range), companyType.
// Labels are True North's (2026-11-07) so the two editors of the one goal read
// the same. Seniority became its own field on 2026-11-03 (JobHacking True
// North); a title typed with the level in it still reads fine —
// roleWithSeniority() never doubles it up.

export const GOAL_LABELS: Record<(typeof GOAL_KEYS)[number], string> = {
  role: "Job title",
  seniority: "Seniority level",
  subsector: "Industry / sub-sector",
  city: "Location",
  salary: "Salary range",
  companyType: "Company type",
};

const PLACEHOLDERS: Record<(typeof GOAL_KEYS)[number], string> = {
  role: "e.g. Customer Success Manager",
  seniority: "e.g. Senior",
  subsector: "e.g. HR tech SaaS",
  city: "e.g. Melbourne, Australia",
  salary: "e.g. AUD 140,000–165,000",
  companyType: "Select…",
};

interface Props {
  value: Goal;
  onChange: (next: Goal) => void;
  // "compass" -> .clabel/.cfield (Compass tab design); "onboarding" -> .label/.field
  variant?: "compass" | "onboarding";
  idPrefix?: string;
}

export default function GoalFields({ value, onChange, variant = "compass", idPrefix = "goal" }: Props) {
  const labelCls = variant === "compass" ? "clabel" : "label";
  const fieldCls = variant === "compass" ? "cfield" : "field";
  const set = (k: (typeof GOAL_KEYS)[number]) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });

  return (
    <div className={`grid gap-4 ${variant === "compass" ? "sm:grid-cols-2" : ""}`}>
      {/* Title + level on one row, then industry + location, then money + company type — the statement's order, a clean 3×2. */}
      <div>
        <label htmlFor={`${idPrefix}-role`} className={labelCls}>{GOAL_LABELS.role}</label>
        <input id={`${idPrefix}-role`} className={fieldCls} value={value.role ?? ""} onChange={set("role")}
          placeholder={PLACEHOLDERS.role} autoComplete="organization-title" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-seniority`} className={labelCls}>{GOAL_LABELS.seniority}</label>
        <input id={`${idPrefix}-seniority`} className={fieldCls} value={value.seniority ?? ""} onChange={set("seniority")}
          placeholder={PLACEHOLDERS.seniority} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-subsector`} className={labelCls}>{GOAL_LABELS.subsector}</label>
        <input id={`${idPrefix}-subsector`} className={fieldCls} value={value.subsector ?? ""} onChange={set("subsector")}
          placeholder={PLACEHOLDERS.subsector} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-city`} className={labelCls}>{GOAL_LABELS.city}</label>
        <input id={`${idPrefix}-city`} className={fieldCls} value={value.city ?? ""} onChange={set("city")}
          placeholder={PLACEHOLDERS.city} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-salary`} className={labelCls}>{GOAL_LABELS.salary}</label>
        <input id={`${idPrefix}-salary`} className={fieldCls} value={value.salary ?? ""}
          onChange={set("salary")} placeholder={PLACEHOLDERS.salary} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-companyType`} className={labelCls}>{GOAL_LABELS.companyType}</label>
        <select id={`${idPrefix}-companyType`} className={fieldCls} value={value.companyType ?? ""} onChange={set("companyType")}>
          <option value="">{PLACEHOLDERS.companyType}</option>
          {COMPANY_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );
}
