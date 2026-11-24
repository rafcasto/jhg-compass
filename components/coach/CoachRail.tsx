"use client";

import { useMemo } from "react";
import Link from "next/link";
import SectionList, { type SectionItem } from "@/components/profile/SectionList";
import { JH_PAGE_ICONS } from "@/components/jobhacking/pageIcons";
import { coachProgressLine, coachRailItems, coachRailRows } from "@/lib/engine/coach/rail";
import { allCoachesComplete, type CoachKey, type CoachState } from "@/lib/engine/coach/keys";
import { PORTAL_HOME } from "@/lib/careerops/portal-nav";
import type { ProfilePortal } from "@/lib/jobhacking/sections";
import { openCoach } from "./store";

// The rail of six (docs/UX_COACH_AGENTIC.md §5): the six coaches as SectionList rows under
// the menu's two headings — JobHacking → Settings for members with the coach, and the
// panel's body while a coach is gated. Tapping a row goes to the coach's page and opens
// the coach there; a gated row explains itself in its summary, so it is never dead.
export default function CoachRail({ states, portal, hasCv = false, jobSearch = false, heading = true }: {
  states: Record<CoachKey, CoachState>;
  portal: ProfilePortal;
  hasCv?: boolean;
  /** The member has the Job Search portal — only then does the Master CV row say the search can start from there. */
  jobSearch?: boolean;
  /** The `Your coach · 2 of 6 complete` head above the rows. */
  heading?: boolean;
}) {
  const items = useMemo<SectionItem<CoachKey>[]>(() => coachRailItems(portal).map(({ page, ...it }) => ({ ...it, icon: JH_PAGE_ICONS[page] })), [portal]);
  const rows = useMemo(() => coachRailRows(states, { hasCv, jobSearch }), [states, hasCv, jobSearch]);
  return (
    <div className="space-y-4">
      {heading && (
        <div>
          <p className="section-label">Your coach</p>
          <p className="mt-1 text-sm text-jh-mute">{coachProgressLine(states)}</p>
          {/* The hand-off (decision 2026-11-25): six complete switched Job Search on by code — the one next step, said where the six are counted. */}
          {allCoachesComplete(states) && jobSearch && <p className="mt-1 text-sm text-jh-ink">Your job search is on. <Link href={PORTAL_HOME} className="link">Open Job Search ›</Link></p>}
        </div>
      )}
      <SectionList items={items} rows={rows} variant="rows" label="Your coaches" onSelect={(key) => openCoach(key)} />
    </div>
  );
}
