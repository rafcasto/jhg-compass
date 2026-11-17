// The page's lists, derived by code from the coach's working material (decision 2026-11-17, docs/UX_JOBHACKING.md §3b).
// Top 3 · Top 10 · Top 40 read `companyLists.top3 · top10 · all`; the coach writes `jhg.targetCompanies.companies · top10 · top3`
// as it works. Before this the lists were written by the model at hand-over only, so a member watched Part A fill forty rows and
// saw an empty page. Now every write of jhg.targetCompanies derives the lists — the field as it stands, split by the sub-sector's
// outlook; the Top 10 and Top 3 once those keys exist. Code's lists win over anything the model sends for companyLists. Pure. Tested.

import type { CompanyList, CompanyLists, CompanyTrend, JhgCompany, JhgTargetCompanies, RankedCompany } from "../../careerops/types";

const trendOf = (outlook: string | undefined): CompanyTrend => (outlook === "sunrise" || outlook === "sunset" ? outlook : "unclassified");
const lower = (s: string | undefined) => (s ?? "").trim().toLowerCase();

function row(c: JhgCompany, rank: number, over: Partial<RankedCompany> = {}): RankedCompany {
  const status = (over.careersUrlStatus ?? c.careersUrlStatus) as RankedCompany["careersUrlStatus"] | undefined;
  const url = (over.careersUrl ?? c.careersUrl)?.trim();
  const r: RankedCompany = { rank, name: c.name.trim() };
  if (c.industry?.trim()) r.industry = c.industry.trim();
  if (c.subSector?.trim()) r.subSector = c.subSector.trim();
  if (c.companyType?.trim()) r.companyType = c.companyType.trim();
  if (status && status !== "none" && url) { r.careersUrl = url; r.careersUrlStatus = status; } else if (status) r.careersUrlStatus = "none";
  if (c.scores && typeof c.scores.total === "number") r.scores = { ...c.scores };
  return r;
}

function split(rows: readonly { r: RankedCompany; trend: CompanyTrend }[]): CompanyList {
  const out: CompanyList = {};
  for (const { r, trend } of rows) (out[trend] ??= []).push(r);
  return out;
}

/**
 * The three lists from the working material. `all` whenever there are companies (rank order, unranked rows after the ranked by
 * position); `top10` once jhg.targetCompanies.top10 is written (its ranks and careers pages, the company's row for the rest);
 * `top3` once top3 is written (the Top 10's rows, keeping their ranks). Returns `current` untouched when there is nothing to derive.
 */
export function deriveCompanyLists(tc: JhgTargetCompanies | undefined, current: CompanyLists | undefined): CompanyLists | undefined {
  const companies = (tc?.companies ?? []).filter((c) => c?.name?.trim());
  if (!companies.length) return current;
  const ranked = companies.map((c, i) => ({ c, rank: typeof c.rank === "number" && c.rank > 0 ? c.rank : i + 1 })).sort((a, b) => a.rank - b.rank);
  const byName = new Map(companies.map((c) => [lower(c.name), c] as const));
  const all = split(ranked.map(({ c, rank }) => ({ r: row(c, rank), trend: trendOf(c.outlook) })));
  const out: CompanyLists = { all };

  const top10 = (tc?.top10 ?? []).filter((t) => t?.name?.trim());
  if (top10.length) {
    const rows = top10.map((t, i) => {
      const c = byName.get(lower(t.name)) ?? { name: t.name };
      const rank = typeof t.rank === "number" && t.rank > 0 ? t.rank : i + 1;
      return { r: row(c, rank, { careersUrl: t.careersUrl, careersUrlStatus: t.careersUrlStatus as RankedCompany["careersUrlStatus"] }), trend: trendOf(c.outlook) };
    }).sort((a, b) => a.r.rank! - b.r.rank!);
    out.top10 = split(rows);
    const top3 = (tc?.top3 ?? []).filter((t) => t?.name?.trim());
    if (top3.length) {
      const inTop10 = new Map(rows.map((x) => [lower(x.r.name), x] as const));
      out.top3 = split(top3.map((t) => inTop10.get(lower(t.name)) ?? { r: row(byName.get(lower(t.name)) ?? { name: t.name }, 0), trend: trendOf(byName.get(lower(t.name))?.outlook) }).sort((a, b) => a.r.rank! - b.r.rank!));
    }
  } else if (current?.top10) out.top10 = current.top10;
  if (!out.top3 && current?.top3 && top10.length === 0) out.top3 = current.top3;
  return out;
}
