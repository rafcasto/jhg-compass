"use client";

import { COMPANY_TYPES, GOAL_KEYS, type Goal } from "@/lib/goal";

// The ONE objective form. Rendered in Compass edit mode and in onboarding step 2
// so the two can never drift: same fields, same labels, same order, same options.
// Field order (GOAL_KEYS): role, subsector (industry), companyType, city
// (geography), salary (range).

export const GOAL_LABELS: Record<(typeof GOAL_KEYS)[number], string> = {
  role: "Seniority level + Job title",
  subsector: "Industry",
  companyType: "Company type",
  city: "Geography (country, region, city, area)",
  salary: "Salary range (compensation)",
};

const PLACEHOLDERS: Record<(typeof GOAL_KEYS)[number], string> = {
  role: "e.g. Senior Product Owner",
  subsector: "e.g. climate-tech SaaS",
  companyType: "Select…",
  city: "e.g. Auckland, New Zealand",
  salary: "e.g. 180,000 – 220,000",
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
    <div
      className="grid gap-4"
      style={variant === "compass" ? { gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" } : undefined}
    >
      <div>
        <label htmlFor={`${idPrefix}-role`} className={labelCls}>{GOAL_LABELS.role}</label>
        <input id={`${idPrefix}-role`} className={fieldCls} value={value.role ?? ""} onChange={set("role")}
          placeholder={PLACEHOLDERS.role} autoComplete="organization-title" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-subsector`} className={labelCls}>{GOAL_LABELS.subsector}</label>
        <input id={`${idPrefix}-subsector`} className={fieldCls} value={value.subsector ?? ""} onChange={set("subsector")}
          placeholder={PLACEHOLDERS.subsector} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-companyType`} className={labelCls}>{GOAL_LABELS.companyType}</label>
        <select id={`${idPrefix}-companyType`} className={fieldCls} value={value.companyType ?? ""} onChange={set("companyType")}>
          <option value="">{PLACEHOLDERS.companyType}</option>
          {COMPANY_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-city`} className={labelCls}>{GOAL_LABELS.city}</label>
        <input id={`${idPrefix}-city`} className={fieldCls} value={value.city ?? ""} onChange={set("city")}
          placeholder={PLACEHOLDERS.city} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-salary`} className={labelCls}>{GOAL_LABELS.salary}</label>
        <input id={`${idPrefix}-salary`} className={`${fieldCls} text-rb-green-dark font-medium`} value={value.salary ?? ""}
          onChange={set("salary")} placeholder={PLACEHOLDERS.salary} />
      </div>
    </div>
  );
}
