// Lead-scoring engine — implements resources/lead-scoring-quiz.md.
//
// "Fit is a gate, not a number. Readiness is the score."
// Derives everything from the selected options' metadata (not question position),
// so the engine keeps working if an admin reorders or renames questions.

import type { Archetype, FitGate, FunnelConfig, FunnelFlag, QuizOption } from "./funnel";

export type Heat = "hot" | "warm" | "cool";
export type Grade = "A" | "B" | "C" | "D" | "E";

export interface ScoreResult {
  archetype: Archetype;
  readiness: number;   // 0–6
  heat: Heat;
  fit: FitGate;
  grade: Grade;
  obstacle: string | null;
  flags: FunnelFlag[];
}

// answers: { [questionId]: optionId } for the choice questions.
export function computeScore(
  funnel: FunnelConfig,
  answers: Record<string, string>
): ScoreResult {
  let archetype: Archetype = "Unclassified";
  let readiness = 0;
  let fit: FitGate = "qualified";
  let obstacle: string | null = null;
  const flags = new Set<FunnelFlag>();
  let archetypeSet = false;
  let fitSet = false;

  for (const q of funnel.quiz.questions) {
    if (q.kind !== "choice" || !q.options) continue;
    const optId = answers[q.id];
    if (!optId) continue;
    const opt: QuizOption | undefined = q.options.find((o) => o.id === optId);
    if (!opt) continue;

    if (opt.archetype) { archetype = opt.archetype; archetypeSet = true; }
    if (typeof opt.readiness === "number") readiness += opt.readiness;
    if (opt.fitGate) { fit = opt.fitGate; fitSet = true; }
    if (opt.obstacle) obstacle = opt.obstacle;
    if (opt.flag) flags.add(opt.flag);
    if (opt.isOther) flags.add("manual-review");
  }

  // Defensive defaults if a question was left unmapped by an admin edit.
  if (!archetypeSet) archetype = "Unclassified";
  if (!fitSet) fit = "qualified";
  if (fit === "below-icp") flags.add("below-icp");

  const heat: Heat = readiness >= 5 ? "hot" : readiness >= 3 ? "warm" : "cool";
  const grade = gradeFor(fit, heat);

  return { archetype, readiness, heat, fit, grade, obstacle, flags: [...flags] };
}

// Readiness (heat) gated by fit — the A–E matrix from the scoring doc.
function gradeFor(fit: FitGate, heat: Heat): Grade {
  if (fit === "qualified") {
    return heat === "hot" ? "A" : heat === "warm" ? "B" : "C";
  }
  // below ICP — never an A/B/C; cap at D, suppress when cool
  return heat === "cool" ? "E" : "D";
}
