"use client";

import { useState } from "react";
import { MAX_TOTAL, SKILL_AXES, TOP_CUT, byRank, type SkillAxis, type SkillScore, type SkillScoreInput } from "@/lib/engine/coach/skills";

// The skills matrix (docs/UX_COACH_AGENTIC.md §9): the one form the transcript carries. The coach's
// turn puts it in front of the member; they score every skill at once — four native selects a row,
// 44 px each, the portal's five anchors inside every list so the scale reads the same for every
// member — and send once. Grayscale: the skill name is the only ink; axis labels and totals recede;
// `Send scores` is the panel's one red while it waits (the composer's Send steps down to secondary).

type Draft = Record<string, Partial<Record<SkillAxis, number>>>;

export default function SkillMatrix({ skills, onSubmit, disabled = false }: {
  skills: readonly string[];
  onSubmit: (scores: SkillScoreInput[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const row = (skill: string) => draft[skill] ?? {};
  const complete = (skill: string) => SKILL_AXES.every((a) => typeof row(skill)[a.key] === "number");
  const totalOf = (skill: string) => (complete(skill) ? SKILL_AXES.reduce((n, a) => n + (row(skill)[a.key] ?? 0), 0) : null);
  const done = skills.filter(complete).length;
  const allDone = done === skills.length;
  const set = (skill: string, axis: SkillAxis, v: string) => setDraft((d) => ({ ...d, [skill]: { ...(d[skill] ?? {}), [axis]: v ? Number(v) : undefined } }));
  const submit = () => {
    if (!allDone || disabled) return;
    onSubmit(skills.map((skill) => ({ skill, good: row(skill).good!, love: row(skill).love!, proof: row(skill).proof!, pays: row(skill).pays! })));
  };

  return (
    <form className="space-y-4" aria-labelledby="skill-matrix-title" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div>
        <p id="skill-matrix-title" className="section-label">Score your skills · 1–5</p>
        <p className="mt-1 text-sm text-jh-mute">Four numbers for each. What each number means is inside every list — the same scale for everyone.</p>
      </div>
      <div className="grid grid-cols-4 gap-2" aria-hidden>
        {SKILL_AXES.map((a) => <span key={a.key} className="section-label truncate">{a.short}</span>)}
      </div>
      <ol className="divide-y divide-jh-line border-y border-jh-line">
        {skills.map((skill) => {
          const total = totalOf(skill);
          return (
            <li key={skill} className="space-y-2 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] text-jh-ink">{skill}</span>
                <span className="shrink-0 font-mono text-xs text-jh-mute" aria-live="polite">{total === null ? `— / ${MAX_TOTAL}` : `${total} / ${MAX_TOTAL}`}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {SKILL_AXES.map((a) => (
                  <select key={a.key} aria-label={`${a.label} — ${skill}`} value={row(skill)[a.key] ?? ""} disabled={disabled} onChange={(e) => set(skill, a.key, e.target.value)}
                    className="field h-11 px-2 py-0 text-sm">
                    <option value="">{a.short}</option>
                    {a.anchors.map((anchor, i) => <option key={i} value={i + 1}>{i + 1} · {anchor}</option>)}
                  </select>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <details className="text-sm text-jh-mute">
        <summary className="cursor-pointer">What the numbers mean</summary>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          {SKILL_AXES.map((a) => (
            <div key={a.key} className="contents">
              <dt className="label mb-0">{a.label}</dt>
              <dd className="text-jh-mute">{a.anchors.map((x, i) => `${i + 1} ${x}`).join(" · ")}</dd>
            </div>
          ))}
        </dl>
      </details>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-jh-mute" role="status">{done} of {skills.length} scored</span>
        <button type="submit" disabled={!allDone || disabled} className="btn-primary h-11">Send scores</button>
      </div>
    </form>
  );
}

// The scored table as the member's turn (docs/UX_COACH_AGENTIC.md §9): ranked rows, the four numbers
// in mono, the total in ink; one thin divider marks the cut at six. No colour — the coach's words
// carry the judgement.
export function ScoredSkills({ scores }: { scores: readonly SkillScore[] }) {
  const ranked = byRank(scores);
  return (
    <div className="space-y-2">
      <p className="section-label">Scored {scores.length} skills</p>
      <ol className="text-sm">
        {ranked.map((s, i) => (
          <li key={s.skill} className={`flex items-baseline gap-3 py-1.5 ${i === TOP_CUT ? "border-t border-jh-line-2 pt-2.5" : ""}`}>
            <span className="w-5 shrink-0 text-right font-mono text-xs text-jh-mute">{s.rank}</span>
            <span className="min-w-0 flex-1 truncate text-jh-ink">{s.skill}</span>
            <span className="shrink-0 font-mono text-xs text-jh-mute" aria-label={SKILL_AXES.map((a) => `${a.label} ${s[a.key]}`).join(", ")}>{SKILL_AXES.map((a) => s[a.key]).join(" · ")}</span>
            <span className="w-6 shrink-0 text-right font-mono text-sm font-semibold text-jh-ink">{s.total}</span>
          </li>
        ))}
      </ol>
      {ranked.length > TOP_CUT && <p className="text-xs text-jh-mute">The line is the cut: the top {TOP_CUT} go to the playoff.</p>}
    </div>
  );
}
