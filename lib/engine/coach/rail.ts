// The rail of six (docs/UX_COACH_AGENTIC.md §5, docs/UX_COACH.md §5) — the six coaches as
// SectionList rows under the menu's two headings. Pure: the stamps in, the rows out. The
// state carries the hierarchy (done · partial · empty); a gated coach is told by its summary
// (*After True North*), never by a fourth glyph. Tested.

import type { SectionGroupInfo, SectionItem, SectionRow } from "../../../components/profile/SectionList";
import type { StepState } from "../../careerops/intake-wizard";
import { BASE_OF, JH_NAV, JH_NAV_LABEL, jhPageHref, type JhPageKey, type ProfilePortal } from "../../jobhacking/sections";
import { COACHES, COACH_TOTAL, missingBefore, type Coach, type CoachKey, type CoachState } from "./keys";

const STATE_OF: Record<CoachState, StepState> = { complete: "done", in_progress: "partial", not_started: "empty" };

/** The menu's heading for a coach's group — the same words DesktopSidebar draws. */
const groupOf = (coach: Coach): SectionGroupInfo => {
  const g = JH_NAV.find((n) => n.key === coach.group)!;
  return { key: g.key, eyebrow: "Your coach", label: g.label };
};

/** A rail item without its icon — the component adds the page's icon; this module stays free of React. */
export type CoachRailItem = Omit<SectionItem<CoachKey>, "icon"> & { page: JhPageKey };

/** The six rows as items — label is the menu's word (LN, not LinkedIn profile), href is the page the coach writes on this portal. */
export function coachRailItems(portal: ProfilePortal = "jobhacking"): CoachRailItem[] {
  return COACHES.map((c) => ({
    key: c.key,
    page: c.page,
    label: JH_NAV_LABEL[c.page] ?? c.label,
    title: c.label,
    ask: c.outcome,
    href: jhPageHref(c.page, BASE_OF[portal]),
    group: groupOf(c),
  }));
}

export interface RailOptions {
  /** The member has a CV stored — the Master CV row says CareerOps can run (docs/UX_COACH.md §12). */
  hasCv?: boolean;
}

/**
 * Each coach's row: state from its stamp; the summary says the gate when one is in the way, the time
 * otherwise; the time sits in the count slot (mono, right edge) on an open row.
 */
export function coachRailRows(states: Record<CoachKey, CoachState>, opts: RailOptions = {}): SectionRow<CoachKey>[] {
  return COACHES.map((c) => {
    const state = STATE_OF[states[c.key]];
    const missing = missingBefore(c, states);
    const gated = missing.length > 0 && state !== "done";
    let summary: string;
    if (state === "done") summary = "Complete";
    else if (gated) summary = `After ${missing[missing.length - 1].label}`;
    else summary = state === "partial" ? `In progress · ${c.time}` : c.time;
    if (c.key === "masterCv" && state !== "done") summary += opts.hasCv ? " · CareerOps can run from here" : " · CareerOps can run once your CV is in";
    return { key: c.key, state, summary, ...(gated || state === "done" ? {} : { count: c.time }) };
  });
}

/** "2 of 6 complete" */
export function coachProgressLine(states: Record<CoachKey, CoachState>): string {
  const done = COACHES.filter((c) => states[c.key] === "complete").length;
  return `${done} of ${COACH_TOTAL} complete`;
}
