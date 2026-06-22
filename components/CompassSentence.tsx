"use client";

import type { CompassFormula } from "@/lib/types";
import { useContent } from "@/lib/firestore/content";

// Renders the admin-editable goal-statement template with the user's variable inputs
// in bold italic. The template lives in content (goal.template) so admins can reword
// it; tokens like {jobTitle} are swapped for the user's answers. Used on the Compass
// tab and in onboarding so the wording stays in one place.
const TOKENS = new Set(["jobTitle", "industry", "targetSalary", "geography", "companyType", "minSalary"]);

function V({ value }: { value?: string }) {
  return <strong className="font-bold italic">{value?.trim() || "________"}</strong>;
}

export default function CompassSentence({ c }: { c: CompassFormula }) {
  const { t } = useContent();
  const tpl = t("goal.template");
  const vars: Record<string, string | undefined> = {
    jobTitle: c.jobTitle, industry: c.industry, targetSalary: c.targetSalary,
    geography: c.geography, companyType: c.companyType, minSalary: c.minSalary,
  };

  const nodes: React.ReactNode[] = [];
  const re = /\{(\w+)\}|\n/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(tpl))) {
    if (m.index > last) nodes.push(tpl.slice(last, m.index));
    if (m[0] === "\n") nodes.push(<br key={`br${i}`} />);
    else if (TOKENS.has(m[1])) nodes.push(<V key={`v${i}`} value={vars[m[1]]} />);
    else nodes.push(m[0]); // unknown token — render literally
    last = m.index + m[0].length;
    i++;
  }
  if (last < tpl.length) nodes.push(tpl.slice(last));

  return <>{nodes}</>;
}
