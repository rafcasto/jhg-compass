"use client";

import { ExternalLink, Link2Off } from "lucide-react";
import { companyTypeLabel, industryLine } from "@/lib/jobhacking/company-lists";
import { scoresLine, type Fact } from "@/lib/jobhacking/workbook";
import type { RankedCompany } from "@/lib/careerops/types";
import { FactLines } from "./FileFacts";

// The one company row of the JobHacking Target companies page — the same on
// Top 3 · Top 10 · Top 40 and on the Watchlist (docs/UX_JOBHACKING.md §3b):
// rank · name + industry line · type pill · one careers-page target. 44px
// tall, three columns, nothing red: a company with no careers page is a gap
// to fill, not a failure.

const STATUS_NOTE: Partial<Record<NonNullable<RankedCompany["careersUrlStatus"]>, string>> = {
  opened_by_coach: " (found by your coach, not yet confirmed)",
  corrected: " (corrected by your coach)",
};
const careersLabel = (c: RankedCompany) => `${c.name} careers page${STATUS_NOTE[c.careersUrlStatus ?? "none"] ?? ""} — opens in a new tab`;

export default function CompanyRow({ c, secondLine, facts = [] }: {
  c: RankedCompany;
  /** Overrides the industry · sub-sector line (the watchlist shows the careers host when the coach has no industry for it). */
  secondLine?: string;
  /** What the workbook says about this company (why now, the thesis, the growth signal) — under the second line. */
  facts?: readonly Fact[];
}) {
  const type = companyTypeLabel(c.companyType);
  const line = secondLine ?? industryLine(c);
  const scores = scoresLine(c.scores);
  return (
    <li className="grid min-h-[44px] grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 py-2">
      <span className="pt-0.5 text-right font-mono text-xs tabular-nums text-jh-mute">{c.rank ?? "–"}<span className="sr-only">.</span></span>
      <div className="min-w-0">
        <p className="truncate font-display text-[15px] font-semibold text-jh-ink">{c.name}</p>
        {(line || type || scores) && (
          <p className="truncate text-sm text-jh-mute">
            {line}
            {/* Below sm the pill is hidden, so the type joins the second line. */}
            {type && <span className="sm:hidden">{line ? " · " : ""}{type}</span>}
            {/* The Packer's scores — why the row sits where it does. Mono, mute: a fact, not a verdict. */}
            {scores && <span className="font-mono text-xs tabular-nums" title="Total · Growth · Interest · Access · Proof">{line || type ? " · " : ""}{scores}</span>}
          </p>
        )}
        <FactLines facts={facts} />
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
