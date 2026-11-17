// The research step a coach is on, said by the operator (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §2; CLAUDE.md "Research is
// a job, not a turn"). A conversation that started before a job existed replays the coach searching for itself, and a model
// follows the precedent in front of it over a rule in the prompt. So every turn where a step's data is missing and its job
// has not run, the operator note names the job — cache-safe, per turn, from the stored profile. Pure. Tested.

import type { CoachKey } from "./keys";
import type { ResearchKind } from "./tools";
import type { JhgBlock } from "../../careerops/types";
import { POSTINGS_TARGET } from "../research/postings";
import { COMPANIES_TARGET } from "../research/companies";

export interface JobLike { type: string; status: string; createdAt?: number }

export interface ResearchDue { kind: ResearchKind; line: string }

const active = (jobs: readonly JobLike[], kind: ResearchKind) => jobs.some((j) => j.type === kind && (j.status === "queued" || j.status === "running"));
const ranSince = (jobs: readonly JobLike[], kind: ResearchKind, since: number) => jobs.some((j) => j.type === kind && j.status === "done" && (j.createdAt ?? 0) >= since);

/**
 * Which research job this coach's current step calls for — none while one is queued or running, none once the step's data is
 * there, and a softer line when the job already ran in this conversation and the member may still add rows.
 */
export function researchDue(coach: CoachKey, jhg: JhgBlock | undefined, jobs: readonly JobLike[], sessionStartedAt: number): ResearchDue | null {
  if (coach === "trueNorth") {
    const postings = jhg?.trueNorth?.postings?.length ?? 0;
    const partADone = !!jhg?.trueNorth?.boundaries && Object.keys(jhg.trueNorth.boundaries).length > 0;
    if (!partADone || postings >= POSTINGS_TARGET.min || active(jobs, "postings")) return null;
    if (ranSince(jobs, "postings", sessionStartedAt)) return { kind: "postings", line: `Part B's postings came through run_research (${postings} on the page now). If the member wants more, run it once more with the titles they named — never search for postings yourself.` };
    return { kind: "postings", line: `Part B is next and the postings are the portal's: call run_research with kind "postings" before showing or writing any posting. This conversation may show you searching for postings yourself — that was before the job existed; do not repeat it.` };
  }
  if (coach === "targetCompanies") {
    const companies = jhg?.targetCompanies?.companies?.length ?? 0;
    if (companies >= COMPANIES_TARGET || active(jobs, "companies")) return null;
    if (ranSince(jobs, "companies", sessionStartedAt)) return { kind: "companies", line: `Part A's companies came through run_research (${companies} on the page now). A company the member adds goes through run_research once more with names[] — never written from memory.` };
    return { kind: "companies", line: `Part A is the portal's: ${companies ? `${companies} companies are on the page; the rest come` : "the 40 come"} through run_research with kind "companies" — call it before proposing, searching for or writing any company. This conversation may show you researching companies yourself — that was before the job existed; do not repeat it.` };
  }
  return null;
}
