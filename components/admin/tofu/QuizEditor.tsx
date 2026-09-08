"use client";

import type { FunnelConfig, QuizOption, QuizQuestion } from "@/lib/funnel";
import { Field, Section } from "@/components/admin/shared";

type Patch = (fn: (f: FunnelConfig) => FunnelConfig) => void;

const ARCHETYPES = ["", "Job Seeker", "Career Changer", "Promotion Seeker", "Unclassified"];
const FIT_GATES = ["", "qualified", "below-icp"];
const FLAGS = ["", "ai-anxious", "vip-signal", "below-icp", "manual-review"];

// Questions + per-option scoring. The two scores the Analytics → Segments matrix
// uses come from here: the fit gate (ICP fit) and the readiness points (propensity).
export default function QuizEditor({ funnel: f, patch }: { funnel: FunnelConfig; patch: Patch }) {
  const updateQuestion = (qi: number, p: Partial<QuizQuestion>) =>
    patch((c) => ({ ...c, quiz: { ...c.quiz, questions: c.quiz.questions.map((q, i) => (i === qi ? { ...q, ...p } : q)) } }));
  const updateOption = (qi: number, oi: number, p: Partial<QuizOption>) =>
    patch((c) => ({
      ...c,
      quiz: {
        ...c.quiz,
        questions: c.quiz.questions.map((q, i) => {
          if (i !== qi || !q.options) return q;
          return { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, ...p } : o)) };
        }),
      },
    }));
  const num = (v: string) => (v === "" ? undefined : Math.max(0, +v));

  return (
    <div className="space-y-6">
      <Section title="How scoring works" help="Q1 sets the archetype · Q2 + Q5 readiness points sum to 0–6 (buying propensity) · Q4 is the fit gate (ICP fit) · Q3 routes the message · the open question is never scored.">
        <Field label="Footer note under the quiz" value={f.quiz.footerNote} onChange={(v) => patch((c) => ({ ...c, quiz: { ...c.quiz, footerNote: v } }))} />
      </Section>

      {f.quiz.questions.map((q, qi) => (
        <Section key={q.id} title={`${q.id.toUpperCase()} · ${q.kind === "text" ? "Open text (unscored)" : "Multiple choice"}`}
          aside={q.kind === "choice" ? (
            <label className="flex items-center gap-2 text-xs text-jh-mute whitespace-nowrap">
              <input type="checkbox" checked={!!q.allowOther} onChange={(e) => updateQuestion(qi, { allowOther: e.target.checked })} className="accent-jh-red" />
              Allow free text on “Something else”
            </label>
          ) : undefined}>
          <Field id={`quiz-${q.id}-prompt`} label="Prompt" value={q.prompt} onChange={(v) => updateQuestion(qi, { prompt: v })} />
          {q.kind === "text" && (
            <Field id={`quiz-${q.id}-placeholder`} label="Placeholder" value={q.placeholder ?? ""} onChange={(v) => updateQuestion(qi, { placeholder: v })} />
          )}
          {q.kind === "choice" && q.options && (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1fr_4.5rem_8rem_6rem_8rem_2rem] gap-2 text-[11px] text-jh-mute-2 font-semibold px-1">
                <span>Label</span><span>Readiness</span><span>Archetype</span><span>Fit gate</span><span>Flag</span><span>Other</span>
              </div>
              {q.options.map((o, oi) => (
                <div key={o.id} className="grid sm:grid-cols-[1fr_4.5rem_8rem_6rem_8rem_2rem] grid-cols-2 gap-2 items-center">
                  <input aria-label={`${q.id.toUpperCase()} option ${oi + 1} label`} className="field py-2 text-sm" value={o.label} onChange={(e) => updateOption(qi, oi, { label: e.target.value })} placeholder="Option label" />
                  <input aria-label={`${q.id.toUpperCase()} option ${oi + 1} readiness`} className="field py-2 text-sm" type="number" min={0} value={o.readiness ?? ""} onChange={(e) => updateOption(qi, oi, { readiness: num(e.target.value) })} placeholder="pts" />
                  <select aria-label={`${q.id.toUpperCase()} option ${oi + 1} archetype`} className="field py-2 text-sm" value={o.archetype ?? ""} onChange={(e) => updateOption(qi, oi, { archetype: (e.target.value || undefined) as QuizOption["archetype"] })}>
                    {ARCHETYPES.map((a) => <option key={a} value={a}>{a || "—"}</option>)}
                  </select>
                  <select aria-label={`${q.id.toUpperCase()} option ${oi + 1} fit gate`} className="field py-2 text-sm" value={o.fitGate ?? ""} onChange={(e) => updateOption(qi, oi, { fitGate: (e.target.value || undefined) as QuizOption["fitGate"] })}>
                    {FIT_GATES.map((a) => <option key={a} value={a}>{a || "—"}</option>)}
                  </select>
                  <select aria-label={`${q.id.toUpperCase()} option ${oi + 1} flag`} className="field py-2 text-sm" value={o.flag ?? ""} onChange={(e) => updateOption(qi, oi, { flag: (e.target.value || undefined) as QuizOption["flag"] })}>
                    {FLAGS.map((a) => <option key={a} value={a}>{a || "—"}</option>)}
                  </select>
                  <label className="grid place-items-center" title="Marks this as the “Something else” option">
                    <input type="checkbox" checked={!!o.isOther} onChange={(e) => updateOption(qi, oi, { isOther: e.target.checked })} className="accent-jh-red" />
                  </label>
                  {o.obstacle !== undefined && (
                    <input className="field py-2 text-sm sm:col-span-6" value={o.obstacle} onChange={(e) => updateOption(qi, oi, { obstacle: e.target.value })} placeholder="Obstacle routing label (Q3)" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      ))}
    </div>
  );
}
