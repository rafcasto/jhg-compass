"use client";

import Link from "next/link";
import { FileUp, Sunrise, Sunset, CircleDashed, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { JH_SETTINGS_HREF } from "@/lib/jobhacking/sections";
import { companyListLabel, facets, listGroups, type CompanyListKey } from "@/lib/jobhacking/company-lists";
import type { CompanyList, CompanyTrend } from "@/lib/careerops/types";
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

export default function CompanyListPanel({ listKey, list }: {
  listKey: CompanyListKey;
  list: CompanyList | null | undefined;
}) {
  const label = companyListLabel(listKey);
  const groups = listGroups(list);

  if (!groups.length) {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <p className="font-display font-semibold text-jh-ink">No {label} yet</p>
        <p className="mt-1 text-sm text-jh-mute">Your coach&apos;s Packer writes the ranked lists into your profile.yml. Upload it and they appear here.</p>
        <Link href={JH_SETTINGS_HREF} className="btn-secondary btn-sm mt-4"><FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Upload profile</Link>
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
            <ol className="divide-y divide-jh-line border-t border-jh-line">{g.companies.map((c) => <CompanyRow key={`${c.rank}-${c.name}`} c={c} />)}</ol>
          </section>
        );
      })}
      <p className="text-xs text-jh-mute">Ranked by your coach. Sunrise companies are growing; sunset companies are shrinking or standing still. Upload a new profile.yml to change the lists.</p>
    </div>
  );
}
