// Company lists — the Packer's ranked target companies, as JobHacking →
// Target companies shows them (docs/UX_JOBHACKING.md §2, §3b).
//
//   profile.yml companyLists.top3 · top10 · all   →   Top 3 · Top 10 · Top 40
//   each split sunrise · sunset · unclassified, rows ranked by the Packer.
//
// Read-only: the member reads these, the coach's Packer writes them. Nothing
// here feeds the Scout's watchlist. Pure — no React. Tested.

import type { CompanyList, CompanyLists, CompanyTrend, RankedCompany } from "../careerops/types";

export type CompanyListKey = keyof CompanyLists;

export const COMPANY_LISTS = [
  { key: "top3", label: "Top 3" },
  { key: "top10", label: "Top 10" },
  { key: "all", label: "Top 40" },
] as const satisfies readonly { key: CompanyListKey; label: string }[];

export const companyListLabel = (key: CompanyListKey): string => COMPANY_LISTS.find((l) => l.key === key)!.label;

export interface TrendInfo { key: CompanyTrend; label: string; /** One line for the member, the first time they see the word. */ blurb: string }

/** In the order the page shows them: growing first, then shrinking, then whatever the coach has not called yet. */
export const TRENDS = [
  { key: "sunrise", label: "Sunrise", blurb: "Growing — where the next roles open." },
  { key: "sunset", label: "Sunset", blurb: "Shrinking or standing still — apply with a reason." },
  { key: "unclassified", label: "Not yet classified", blurb: "Your coach hasn't called these yet." },
] as const satisfies readonly TrendInfo[];

export interface TrendGroup extends TrendInfo { companies: RankedCompany[] }

/** The non-empty trend groups of one list, companies in rank order (no rank → after the ranked ones, file order kept). */
export function listGroups(list: CompanyList | null | undefined): TrendGroup[] {
  if (!list) return [];
  return (TRENDS as readonly TrendInfo[])
    .map((t) => ({ ...t, companies: byRank(list[t.key] ?? []) }))
    .filter((g) => g.companies.length > 0);
}

const byRank = (rows: readonly RankedCompany[]): RankedCompany[] =>
  rows.map((r, i) => ({ r, i })).sort((a, b) => (a.r.rank ?? Infinity) - (b.r.rank ?? Infinity) || a.i - b.i).map((x) => x.r);

/** Every company in a list, across trends. */
export const listCompanies = (list: CompanyList | null | undefined): RankedCompany[] => listGroups(list).flatMap((g) => g.companies);
export const listCount = (list: CompanyList | null | undefined): number => listCompanies(list).length;

/** The Packer writes lower-case tokens ("scaleup", "established"); the page reads them as words. */
const TYPE_LABELS: Record<string, string> = {
  scaleup: "Scale-up", "scale-up": "Scale-up", startup: "Startup", "start-up": "Startup", established: "Established",
  enterprise: "Enterprise", mnc: "MNC", multinational: "Multinational", government: "Government", smb: "Small business", sme: "Small business",
  "family business": "Family business", "small business": "Small business", nonprofit: "Non-profit", "non-profit": "Non-profit",
};
export function companyTypeLabel(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  if (!t) return "";
  return TYPE_LABELS[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

export interface Facet { name: string; n: number }
export interface Facets {
  /** Industries present, most common first. */
  industries: Facet[];
  /** Company types present, most common first, as labels. */
  types: Facet[];
}

/** What a group is made of — the shape of the list without reading every row. */
export function facets(companies: readonly RankedCompany[]): Facets {
  const tally = (pick: (c: RankedCompany) => string): Facet[] => {
    const m = new Map<string, number>();
    for (const c of companies) { const k = pick(c); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  };
  return { industries: tally((c) => (c.industry ?? "").trim()), types: tally((c) => companyTypeLabel(c.companyType)) };
}

/** Industry · sub-sector on one line, for a row's second line. */
export const industryLine = (c: RankedCompany): string => [c.industry, c.subSector].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "40 companies · 37 sunrise · 2 sunset · 1 not yet classified" — the overview row's line. Empty list → "". */
export function listSummary(list: CompanyList | null | undefined): string {
  const groups = listGroups(list);
  const n = groups.reduce((s, g) => s + g.companies.length, 0);
  if (!n) return "";
  if (groups.length === 1) return `${plural(n, "company", "companies")} · all ${groups[0].label.toLowerCase()}`;
  return [plural(n, "company", "companies"), ...groups.map((g) => `${g.companies.length} ${g.label.toLowerCase()}`)].join(" · ");
}
