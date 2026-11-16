// The skills rubric, in code (decision 2026-11-16, docs/UX_COACH_AGENTIC.md §9). Coach 1 collects the
// skills in conversation; the member scores them all at once in the panel's matrix; THIS file is the
// scale — four axes, five anchors each, the same words for every member — and does the arithmetic:
// totals, ranks, the tie-break, the cut at six, and the flags the coach pushes back with. The model
// converses about the result; it never asks the four questions skill by skill and never sums.
// Pure — tested.

export const SKILL_AXES = [
  { key: "good", label: "Good at it", short: "Good", anchors: ["Beginner", "Can do it with help", "Solid, unsupervised", "Others ask me for it", "Among the best I know"] },
  { key: "love", label: "Love it", short: "Love", anchors: ["Avoid it", "Tolerate it", "Fine", "Enjoy it", "Would do it unpaid"] },
  { key: "proof", label: "Can prove it", short: "Prove", anchors: ["Nothing to show", "No result in 10 seconds", "One example", "A result with a number", "Several results with numbers"] },
  { key: "pays", label: "Market pays", short: "Pays", anchors: ["Rarely in postings", "Nice to have", "Asked for", "Required and paid", "Scarce, paid a premium"] },
] as const;
export type SkillAxis = (typeof SKILL_AXES)[number]["key"];
export const SKILL_AXIS_KEYS = SKILL_AXES.map((a) => a.key) as readonly SkillAxis[];

export const MIN_MATRIX_SKILLS = 3;
export const MAX_MATRIX_SKILLS = 20;
export const MAX_SKILL_CHARS = 60;
/** How many go into the playoff. */
export const TOP_CUT = 6;
export const MAX_TOTAL = 5 * SKILL_AXES.length;

/** What the member sends: a skill from the matrix and its four numbers. */
export interface SkillScoreInput { skill: string; good: number; love: number; proof: number; pays: number }
/** What is stored on jhg.narrative.skillScores: the four numbers plus the portal's total and rank. */
export interface SkillScore extends SkillScoreInput { total: number; rank: number }

const lower = (s: string) => s.trim().toLowerCase();
const inRange = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;

/** The skills the coach hands the matrix, cleaned: trimmed, capped, de-duplicated (case-insensitive), 3–20 of them. */
export function cleanSkills(raw: unknown): { ok: true; skills: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "skills must be a list of strings" };
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.trim().slice(0, MAX_SKILL_CHARS);
    if (!s || seen.has(lower(s))) continue;
    seen.add(lower(s));
    skills.push(s);
  }
  if (skills.length < MIN_MATRIX_SKILLS) return { ok: false, error: `at least ${MIN_MATRIX_SKILLS} skills — collect more first` };
  if (skills.length > MAX_MATRIX_SKILLS) return { ok: false, error: `at most ${MAX_MATRIX_SKILLS} skills — cut the list with the member first` };
  return { ok: true, skills };
}

/**
 * The member's scores against the matrix they were shown: every skill once, every axis 1–5, nothing else.
 * Order follows the matrix, not the submission.
 */
export function parseScores(raw: unknown, skills: readonly string[]): { ok: true; scores: SkillScoreInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "scores must be a list" };
  const byName = new Map<string, SkillScoreInput>();
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    if (typeof r.skill !== "string") continue;
    const skill = skills.find((s) => lower(s) === lower(r.skill as string));
    if (!skill) return { ok: false, error: `"${r.skill}" is not one of the skills in the matrix` };
    if (!SKILL_AXIS_KEYS.every((k) => inRange(r[k]))) return { ok: false, error: `"${skill}" needs four whole numbers from 1 to 5` };
    byName.set(lower(skill), { skill, good: r.good as number, love: r.love as number, proof: r.proof as number, pays: r.pays as number });
  }
  const missing = skills.filter((s) => !byName.has(lower(s)));
  if (missing.length) return { ok: false, error: `Not scored yet: ${missing.join(", ")}` };
  return { ok: true, scores: skills.map((s) => byName.get(lower(s))!) };
}

/** total = good + love + proof + pays; ranked by total, then proof, then pays, then love; the matrix's order last. Ranks 1…n. */
export function scoreSkills(scores: readonly SkillScoreInput[]): SkillScore[] {
  const withTotal = scores.map((s, i) => ({ ...s, total: s.good + s.love + s.proof + s.pays, i }));
  const sorted = [...withTotal].sort((a, b) => (b.total - a.total) || (b.proof - a.proof) || (b.pays - a.pays) || (b.love - a.love) || (a.i - b.i));
  const rank = new Map(sorted.map((s, r) => [s.i, r + 1]));
  return withTotal.map(({ i, ...s }) => ({ ...s, rank: rank.get(i)! }));
}

export const byRank = (scored: readonly SkillScore[]): SkillScore[] => [...scored].sort((a, b) => a.rank - b.rank);
export const topCut = (scored: readonly SkillScore[], n = TOP_CUT): SkillScore[] => byRank(scored).slice(0, n);

export interface SkillFlag {
  id: "inflated" | "flat" | "unproven" | "loved_not_paid" | "paid_not_loved" | "tie_at_cut";
  /** The flag in the coach's words — what to push back on. */
  line: string;
  skills?: string[];
}

/** What a coach should push back on — the pattern checks a person would make reading the table, decided here so every member gets the same ones. */
export function skillFlags(scored: readonly SkillScore[]): SkillFlag[] {
  const out: SkillFlag[] = [];
  if (!scored.length) return out;
  const cells = scored.flatMap((s) => [s.good, s.love, s.proof, s.pays]);
  const high = cells.filter((c) => c >= 4).length;
  if (scored.length >= 5 && high / cells.length >= 0.8) out.push({ id: "inflated", line: `${Math.round((high / cells.length) * 100)}% of the numbers are 4 or 5 — the scale is not separating anything. Ask which three they would drop first and rescore those.` });
  const totals = scored.map((s) => s.total);
  if (scored.length >= 5 && Math.max(...totals) - Math.min(...totals) <= 2) out.push({ id: "flat", line: "The totals are within 2 points of each other — nothing stands out yet. Ask for the one skill they would keep if they could keep only one." });
  const top = topCut(scored);
  const unproven = top.filter((s) => s.proof <= 2).map((s) => s.skill);
  if (unproven.length) out.push({ id: "unproven", line: `In the top ${TOP_CUT} with Prove ≤ 2: ${unproven.join(", ")}. A lead skill needs a result with a number — ask for one, or the skill drops.`, skills: unproven });
  const lovedNotPaid = scored.filter((s) => s.love >= 4 && s.pays <= 2).map((s) => s.skill);
  if (lovedNotPaid.length) out.push({ id: "loved_not_paid", line: `Loved but the market does not pay for it: ${lovedNotPaid.join(", ")}. A passion, not a lead skill — unless they know a market that pays.`, skills: lovedNotPaid });
  const paidNotLoved = top.filter((s) => s.pays >= 4 && s.love <= 2).map((s) => s.skill);
  if (paidNotLoved.length) out.push({ id: "paid_not_loved", line: `Pays well, not enjoyed, and in the top ${TOP_CUT}: ${paidNotLoved.join(", ")}. Say so: a lead skill they dislike is a job they will leave.`, skills: paidNotLoved });
  const ranked = byRank(scored);
  if (ranked.length > TOP_CUT && ranked[TOP_CUT - 1].total === ranked[TOP_CUT].total) out.push({ id: "tie_at_cut", line: `${ranked[TOP_CUT - 1].skill} and ${ranked[TOP_CUT].skill} tie at the cut (${ranked[TOP_CUT].total}); the portal broke the tie on Prove, then Pays — ask the member which one belongs in the playoff.`, skills: [ranked[TOP_CUT - 1].skill, ranked[TOP_CUT].skill] });
  return out;
}

/** The member's scores as the coach reads them — a ranked table plus the flags; totals and ranks are the portal's. */
export function scoresMessage(scored: readonly SkillScore[], flags: readonly SkillFlag[] = skillFlags(scored)): string {
  const rows = byRank(scored).map((s) => `| ${s.rank} | ${s.skill} | ${s.good} | ${s.love} | ${s.proof} | ${s.pays} | **${s.total}** |`);
  const lines = [
    `I scored my ${scored.length} skills in the matrix. Totals and ranks are the portal's (total = Good + Love + Prove + Pays; ties: Prove, then Pays, then Love). Stored on the page as jhg.narrative.skillScores — do not write them again.`,
    "",
    "| # | Skill | Good | Love | Prove | Pays | Total |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    `Top ${TOP_CUT} for the playoff: ${topCut(scored).map((s) => s.skill).join(", ")}.`,
  ];
  if (flags.length) lines.push("", "The portal's flags — push back on these before the playoff:", ...flags.map((f) => `- ${f.line}`));
  else lines.push("", "No flags from the portal: the scores separate, the top six are proven. Go to the playoff.");
  return lines.join("\n");
}

/** "Scored 15 skills · top: a, b, c" — the recap line for a scores turn. */
export const scoresRecap = (scored: readonly SkillScore[]): string => `Scored ${scored.length} skills — ranked: ${byRank(scored).map((s) => `${s.skill} ${s.total}`).join(", ")}`;
