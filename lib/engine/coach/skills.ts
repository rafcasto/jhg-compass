// Coach 1's rubric — the skills (docs/UX_COACH_AGENTIC.md §9) — on the shared core in rubrics.ts: its flags,
// its stored shape (jhg.narrative.skillScores, one flat row a skill) and the message the coach reads. Pure — tested.

import { RUBRICS, byRank, commonFlags, rankRows, scoredTable, topCut as cut, valueOf, type MatrixFlag, type MatrixRow, type ScoredRow } from "./rubrics";

export const SKILLS_RUBRIC = RUBRICS.skills;
export const SKILL_AXES = SKILLS_RUBRIC.axes;
export type SkillAxis = (typeof SKILL_AXES)[number]["key"];
export const TOP_CUT = SKILLS_RUBRIC.cut;
export const MAX_TOTAL = 5 * SKILL_AXES.length;

/** One stored row: the four numbers plus the portal's total and rank. */
export interface SkillScore { skill: string; good: number; love: number; proof: number; pays: number; total: number; rank: number }

export const skillRow = (s: SkillScore): ScoredRow => ({ item: s.skill, values: [s.good, s.love, s.proof, s.pays], total: s.total, rank: s.rank });
const fromRow = (r: ScoredRow): SkillScore => ({ skill: r.item, good: r.values[0], love: r.values[1], proof: r.values[2], pays: r.values[3], total: r.total, rank: r.rank });

/** The stored rows from the matrix's rows — totals and ranks the portal's. */
export const scoreSkills = (rows: readonly MatrixRow[]): SkillScore[] => rankRows(rows, SKILLS_RUBRIC).map(fromRow);
export const topCut = (scored: readonly SkillScore[], n = TOP_CUT): SkillScore[] => cut(scored, n);

/** What Coach 1 pushes back on — the shared flags plus the skills' own: unproven in the top six, loved but unpaid, paid but disliked. */
export function skillFlags(scored: readonly SkillScore[]): MatrixFlag[] {
  const rows = scored.map(skillRow);
  const r = SKILLS_RUBRIC;
  const out = commonFlags(rows, r, "Ask which three they would drop first and rescore those.", "Ask for the one skill they would keep if they could keep only one.");
  const top = cut(rows, r.cut);
  const unproven = top.filter((s) => valueOf(s, r, "proof") <= 2).map((s) => s.item);
  if (unproven.length) out.push({ id: "unproven", line: `In the top ${r.cut} with Prove ≤ 2: ${unproven.join(", ")}. A lead skill needs a result with a number — ask for one, or the skill drops.`, items: unproven });
  const lovedNotPaid = rows.filter((s) => valueOf(s, r, "love") >= 4 && valueOf(s, r, "pays") <= 2).map((s) => s.item);
  if (lovedNotPaid.length) out.push({ id: "loved_not_paid", line: `Loved but the market does not pay for it: ${lovedNotPaid.join(", ")}. A passion, not a lead skill — unless they know a market that pays.`, items: lovedNotPaid });
  const paidNotLoved = top.filter((s) => valueOf(s, r, "pays") >= 4 && valueOf(s, r, "love") <= 2).map((s) => s.item);
  if (paidNotLoved.length) out.push({ id: "paid_not_loved", line: `Pays well, not enjoyed, and in the top ${r.cut}: ${paidNotLoved.join(", ")}. Say so: a lead skill they dislike is a job they will leave.`, items: paidNotLoved });
  // The shared tie flag reads better last.
  return [...out.filter((f) => f.id !== "tie_at_cut"), ...out.filter((f) => f.id === "tie_at_cut")];
}

/** The member's scores as the coach reads them — a ranked table plus the flags; totals and ranks are the portal's. */
export function scoresMessage(scored: readonly SkillScore[], flags: readonly MatrixFlag[] = skillFlags(scored)): string {
  const r = SKILLS_RUBRIC;
  const lines = [
    `I scored my ${scored.length} skills in the matrix. Totals and ranks are the portal's (total = Good + Love + Prove + Pays; ties: Prove, then Pays, then Love). Stored on the page as jhg.narrative.skillScores — do not write them again.`,
    "", scoredTable(scored.map(skillRow), r), "",
    `Top ${r.cut} for the playoff: ${topCut(scored).map((s) => s.skill).join(", ")}.`,
  ];
  if (flags.length) lines.push("", "The portal's flags — push back on these before the playoff:", ...flags.map((f) => `- ${f.line}`));
  else lines.push("", "No flags from the portal: the scores separate, the top six are proven. Go to the playoff.");
  return lines.join("\n");
}

export { byRank };
