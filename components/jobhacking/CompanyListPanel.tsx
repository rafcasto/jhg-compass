"use client";

import Link from "next/link";
import { ExternalLink, FileUp, Sunrise, Sunset, CircleDashed, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { JH_SETTINGS_HREF } from "@/lib/jobhacking/sections";
import { companyListLabel, facets, listGroups, type CompanyListKey } from "@/lib/jobhacking/company-lists";
import { SCORE_LEGEND, companyFacts, top10Facts, top3Facts, type Fact } from "@/lib/jobhacking/workbook";
import type { CompanyList, CompanyTrend, JhgBlock, RankedCompany } from "@/lib/careerops/types";
import CompanyRow from "./CompanyRow";

// JobHacking → Target companies → Top 3 · Top 10 · Top 40 — docs/UX_JOBHACKING.md §3b.
//
// One list, grouped sunrise → sunset → unclassified. Read-only: the Packer
// writes it, the member reads it. One row model for all three lists (decision
// 2026-11-05: the same experience on the Top 3 as on the Top 40):
//
//   ranked rows (CompanyRow) in the section's card. Rank recedes (mono,
//   mute), the name is the one heavy element, industry · sub-sector is the
//   quiet second line, company type is a pill, the careers page is one 40px
//   icon target. No table: six columns of equal weight is exactly what a Top
//   40 must not look like, and it dies on a phone. No cards: a grid loses the
//   rank order, which is what a Top N is. The Watchlist reads the same row.
//
// Each group opens with a facet line — the industries and company types it is
// made of — so the shape of 37 rows reads before the rows do. Nothing here is
// red: a company with no careers page is a gap the coach fills, not a failure.

const TREND_ICON: Record<CompanyTrend, ComponentType<LucideProps>> = { sunrise: Sunrise, sunset: Sunset, unclassified: CircleDashed };

// Each list shows the part of the workbook written for it (2026-11-07): the
// Top 3 its why-now / first move / by-date, the Top 10 its thesis and hiring
// authority, the Top 40 the growth signal and who the member knows. Matched by
// company name; a row the workbook does not mention shows nothing extra.
const FACTS: Record<CompanyListKey, (c: RankedCompany, j: JhgBlock | null | undefined) => Fact[]> = { top3: top3Facts, top10: top10Facts, all: companyFacts };

export default function CompanyListPanel({ listKey, list, jhg }: {
  listKey: CompanyListKey;
  list: CompanyList | null | undefined;
  /** The workbook — the research behind the rows. */
  jhg?: JhgBlock | null;
}) {
  const label = companyListLabel(listKey);
  const groups = listGroups(list);
  const challenges = listKey === "all" ? (jhg?.targetCompanies?.challenges ?? []).filter((c) => c.company?.trim()) : [];
  const extraSubSectors = listKey === "all" ? (jhg?.targetCompanies?.extraSubSectors ?? []).filter((x) => x.name?.trim()) : [];
  const anyScores = groups.some((g) => g.companies.some((c) => c.scores));

  if (!groups.length) {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <p className="font-display font-semibold text-jh-ink">No {label} yet</p>
        <p className="mt-1 text-sm text-jh-mute">Your coach&apos;s Packer writes the ranked lists into your target-companies.yml. Upload it and they appear here.</p>
        <Link href={JH_SETTINGS_HREF} className="btn-secondary btn-sm mt-4"><FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Upload target companies</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const Icon = TREND_ICON[g.key];
        const f = facets(g.companies);
        const id = `cl-${listKey}-${g.key}`;
        return (
          <section key={g.key} aria-labelledby={id} className="space-y-3">
            <header>
              <h3 id={id} className="section-label flex items-center gap-2">
                <Icon className="h-4 w-4 text-jh-mute" strokeWidth={1.5} aria-hidden />
                {g.label}
                <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{g.companies.length}</span>
              </h3>
              {/* The make-up of the group — read this before the rows. Only worth a line once there is more than one row. */}
              {g.companies.length > 1 && (f.industries.length > 0 || f.types.length > 0) && (
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                  {f.industries.length > 0 && <><dt className="text-jh-mute">Industries</dt><dd className="text-jh-body">{f.industries.map((x) => `${x.name} ${x.n}`).join(" · ")}</dd></>}
                  {f.types.length > 0 && <><dt className="text-jh-mute">Company type</dt><dd className="text-jh-body">{f.types.map((x) => `${x.name} ${x.n}`).join(" · ")}</dd></>}
                </dl>
              )}
            </header>
            <ol className="divide-y divide-jh-line border-t border-jh-line">{g.companies.map((c) => <CompanyRow key={`${c.rank}-${c.name}`} c={c} facts={FACTS[listKey](c, jhg)} />)}</ol>
          </section>
        );
      })}
      {extraSubSectors.length > 0 && (
        <section aria-labelledby={`cl-${listKey}-extra`} className="space-y-3">
          <h3 id={`cl-${listKey}-extra`} className="section-label flex items-center gap-2">
            Other sub-sectors your coach looked at <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{extraSubSectors.length}</span>
          </h3>
          <ul className="divide-y divide-jh-line border-t border-jh-line">
            {extraSubSectors.map((x, i) => (
              <li key={`${x.name}-${i}`} className="grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-display text-[15px] font-semibold text-jh-ink">{x.name}{x.outlook && <span className="pill-neutral">{x.outlook.charAt(0).toUpperCase() + x.outlook.slice(1)}</span>}</p>
                  <p className="truncate text-sm text-jh-mute">{[x.industry, x.growthSignal].filter(Boolean).join(" · ")}</p>
                </div>
                {x.source ? <a href={x.source} target="_blank" rel="noreferrer" className="icon-btn" aria-label={`${x.name} — growth source, opens in a new tab`} title="Source"><ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden /></a> : <span />}
              </li>
            ))}
          </ul>
        </section>
      )}
      {challenges.length > 0 && (
        <section aria-labelledby={`cl-${listKey}-challenges`} className="space-y-3">
          <h3 id={`cl-${listKey}-challenges`} className="section-label flex items-center gap-2">
            Challenged by your coach <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{challenges.length}</span>
          </h3>
          <ul className="divide-y divide-jh-line border-t border-jh-line">
            {challenges.map((c, i) => (
              <li key={`${c.company}-${i}`} className="min-h-[44px] py-2">
                <p className="font-display text-[15px] font-semibold text-jh-ink">{c.company}</p>
                {c.challenge?.trim() && <p className="text-sm text-jh-mute">{c.challenge}</p>}
                {c.resolution?.trim() && <p className="text-sm text-jh-body">{c.resolution}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-jh-mute">Ranked by your coach. Sunrise companies are growing; sunset companies are shrinking or standing still.{anyScores && ` ${SCORE_LEGEND}`} Upload a new target-companies.yml to change the lists.</p>
    </div>
  );
}
