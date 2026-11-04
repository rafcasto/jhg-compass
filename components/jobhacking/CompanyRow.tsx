"use client";

import { ExternalLink, Link2Off } from "lucide-react";
import { companyTypeLabel, industryLine } from "@/lib/jobhacking/company-lists";
import type { RankedCompany } from "@/lib/careerops/types";

// The one company row of the JobHacking Target companies page — the same on
// Top 3 · Top 10 · Top 40 and on the Watchlist (docs/UX_JOBHACKING.md §3b):
// rank · name + industry line · type pill · one careers-page target. 44px
// tall, three columns, nothing red: a company with no careers page is a gap
// to fill, not a failure.

const careersLabel = (c: RankedCompany) =>
  `${c.name} careers page${c.careersUrlStatus === "opened_by_coach" ? " (found by your coach, not yet confirmed)" : ""} — opens in a new tab`;

export default function CompanyRow({ c, secondLine }: {
  c: RankedCompany;
  /** Overrides the industry · sub-sector line (the watchlist shows the careers host when the coach has no industry for it). */
  secondLine?: string;
}) {
  const type = companyTypeLabel(c.companyType);
  const line = secondLine ?? industryLine(c);
  return (
    <li className="grid min-h-[44px] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-2">
      <span className="text-right font-mono text-xs tabular-nums text-jh-mute">{c.rank ?? "–"}<span className="sr-only">.</span></span>
      <div className="min-w-0">
        <p className="truncate font-display text-[15px] font-semibold text-jh-ink">{c.name}</p>
        {(line || type) && (
          <p className="truncate text-sm text-jh-mute">
            {line}
            {/* Below sm the pill is hidden, so the type joins the second line. */}
            {type && <span className="sm:hidden">{line ? " · " : ""}{type}</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {type && <span className="pill-neutral hidden sm:inline-flex">{type}</span>}
        <CareersLink c={c} />
      </div>
    </li>
  );
}

/** A 40px icon target when there is a page; a quiet glyph with its name for screen readers when there is none. */
export function CareersLink({ c }: { c: RankedCompany }) {
  if (c.careersUrl) {
    return (
      <a href={c.careersUrl} target="_blank" rel="noreferrer" className="icon-btn" aria-label={careersLabel(c)} title="Careers page">
        <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </a>
    );
  }
  return (
    <span className="inline-grid h-10 w-10 place-items-center text-jh-mute" title="No careers page yet">
      <Link2Off className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      <span className="sr-only">No careers page yet</span>
    </span>
  );
}
