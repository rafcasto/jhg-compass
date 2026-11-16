"use client";

import { useState } from "react";
import { byRank, maxTotal, rubricOf, type MatrixRow, type RubricKind, type ScoredRow } from "@/lib/engine/coach/rubrics";

// The scoring matrix (docs/UX_COACH_AGENTIC.md §9–§10): the one form the transcript carries, for any rubric
// in the registry. The coach's turn puts it in front of the member; they score every row at once — four
// native selects a row, 44 px each, the rubric's five anchors inside every list so the scale reads the
// same for every member — and send once. Grayscale: the row's name is the only ink; a mute line under it
// where a row needs context (a company's sub-sector and signal); axis labels and totals recede.
// `Send scores` is the panel's one red while it waits (the composer's Send steps down to secondary).
// Forty rows scroll; the axis header stays put at the top of the panel's scroll container.
// Docked (392 px) a row is two lines — the name, then the four selects; expanded (§11) a row is one line —
// name · four selects · total — so forty companies are half the scroll and every anchor reads in full.

type Draft = Record<string, (number | undefined)[]>;

export default function ScoreMatrix({ kind, items, meta, onSubmit, disabled = false, wide = false, onExpand }: {
  kind: RubricKind;
  items: readonly string[];
  /** A mute line under each row — `meta[i]` for `items[i]`; "" or missing for none. */
  meta?: readonly string[];
  onSubmit: (rows: MatrixRow[]) => void;
  disabled?: boolean;
  /** The panel is expanded: one line a row. */
  wide?: boolean;
  /** Offered while docked: the one moment the wider panel earns its tap. */
  onExpand?: () => void;
}) {
  const r = rubricOf(kind);
  const [draft, setDraft] = useState<Draft>({});
  const row = (item: string) => draft[item] ?? [];
  const complete = (item: string) => r.axes.every((_, i) => typeof row(item)[i] === "number");
  const totalOf = (item: string) => (complete(item) ? row(item).reduce<number>((n, v) => n + (v ?? 0), 0) : null);
  const done = items.filter(complete).length;
  const allDone = done === items.length;
  const set = (item: string, i: number, v: string) => setDraft((d) => { const next = [...(d[item] ?? [])]; next[i] = v ? Number(v) : undefined; return { ...d, [item]: next }; });
  const submit = () => {
    if (!allDone || disabled) return;
    onSubmit(items.map((item) => ({ item, values: row(item).map((v) => v!) })));
  };
  const max = maxTotal(r);
  // Every rubric has four axes — literal classes so Tailwind sees them. Wide: name · 4 × 7rem · total.
  const cols = "grid grid-cols-4 gap-2";
  const wideCols = "grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,7rem))_3.5rem] items-center gap-2";
  const totalText = (total: number | null) => (total === null ? `— / ${max}` : `${total} / ${max}`);
  const selects = (item: string) => r.axes.map((a, i) => (
    <select key={a.key} aria-label={`${a.label} — ${item}`} value={row(item)[i] ?? ""} disabled={disabled} onChange={(e) => set(item, i, e.target.value)}
      className="field h-11 px-2 py-0 text-sm">
      <option value="">{a.short}</option>
      {a.anchors.map((anchor, n) => <option key={n} value={n + 1}>{n + 1} · {anchor}</option>)}
    </select>
  ));

  return (
    <form className="space-y-4" aria-labelledby="score-matrix-title" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div>
        <p id="score-matrix-title" className="section-label">{r.title} · 1–5</p>
        <p className="mt-1 text-sm text-jh-mute">
          Four numbers for each. What each number means is inside every list — the same scale for everyone.
          {!wide && onExpand && <> <button type="button" onClick={onExpand} className="hidden underline underline-offset-2 hover:text-jh-ink sm:inline">Expand for more room ›</button></>}
        </p>
      </div>
      {wide ? (
        <div className={`${wideCols} sticky top-0 z-10 -mt-2 bg-white py-2`} aria-hidden>
          <span />
          {r.axes.map((a) => <span key={a.key} className="section-label truncate">{a.short}</span>)}
          <span className="section-label text-right">Total</span>
        </div>
      ) : (
        <div className={`${cols} sticky top-0 z-10 -mt-2 bg-white py-2`} aria-hidden>
          {r.axes.map((a) => <span key={a.key} className="section-label truncate">{a.short}</span>)}
        </div>
      )}
      <ol className="divide-y divide-jh-line border-y border-jh-line">
        {items.map((item, idx) => {
          const total = totalOf(item);
          const line = meta?.[idx]?.trim();
          if (wide) {
            return (
              <li key={item} className={`${wideCols} py-2`} data-wide-row>
                <div className="min-w-0">
                  <p className="truncate text-[15px] text-jh-ink">{item}</p>
                  {line && <p className="truncate text-xs text-jh-mute">{line}</p>}
                </div>
                {selects(item)}
                <span className="text-right font-mono text-xs text-jh-mute" aria-live="polite">{totalText(total)}</span>
              </li>
            );
          }
          return (
            <li key={item} className="space-y-2 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] text-jh-ink">{item}</span>
                <span className="shrink-0 font-mono text-xs text-jh-mute" aria-live="polite">{totalText(total)}</span>
              </div>
              {line && <p className="truncate text-xs text-jh-mute">{line}</p>}
              <div className={cols}>{selects(item)}</div>
            </li>
          );
        })}
      </ol>
      <details className="text-sm text-jh-mute">
        <summary className="cursor-pointer">What the numbers mean</summary>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          {r.axes.map((a) => (
            <div key={a.key} className="contents">
              <dt className="label mb-0">{a.label}</dt>
              <dd className="text-jh-mute">{a.anchors.map((x, i) => `${i + 1} ${x}`).join(" · ")}</dd>
            </div>
          ))}
        </dl>
      </details>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-jh-mute" role="status">{done} of {items.length} scored</span>
        <button type="submit" disabled={!allDone || disabled} className="btn-primary h-11">Send scores</button>
      </div>
    </form>
  );
}

// The scored table as the member's turn: ranked rows, the numbers in mono, the total in ink; one thin
// divider marks the rubric's cut. No colour — the coach's words carry the judgement.
export function ScoredRows({ kind, rows }: { kind: RubricKind; rows: readonly ScoredRow[] }) {
  const r = rubricOf(kind);
  const ranked = byRank(rows);
  return (
    <div className="space-y-2">
      <p className="section-label">Scored {rows.length} {rows.length === 1 ? r.item : r.items}</p>
      <ol className="text-sm">
        {ranked.map((s, i) => (
          <li key={s.item} className={`flex items-baseline gap-3 py-1.5 ${i === r.cut ? "border-t border-jh-line-2 pt-2.5" : ""}`}>
            <span className="w-5 shrink-0 text-right font-mono text-xs text-jh-mute">{s.rank}</span>
            <span className="min-w-0 flex-1 truncate text-jh-ink">{s.item}</span>
            <span className="shrink-0 font-mono text-xs text-jh-mute" aria-label={r.axes.map((a, j) => `${a.label} ${s.values[j]}`).join(", ")}>{s.values.join(" · ")}</span>
            <span className="w-6 shrink-0 text-right font-mono text-sm font-semibold text-jh-ink">{s.total}</span>
          </li>
        ))}
      </ol>
      {ranked.length > r.cut && <p className="text-xs text-jh-mute">{r.cutLine}</p>}
    </div>
  );
}
