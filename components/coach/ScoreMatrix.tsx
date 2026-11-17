"use client";

import { useEffect, useRef, useState } from "react";
import { byRank, maxTotal, rubricOf, type MatrixOverride, type MatrixRow, type RubricKind, type ScoredRow } from "@/lib/engine/coach/rubrics";
import type { CompanyEvidence } from "@/lib/engine/coach/evidence";
import { readConnectionsFile, type ConnectionsAttachment } from "./document";

// The scoring matrix (docs/UX_COACH_AGENTIC.md §9–§10): the one form the transcript carries, for any rubric
// in the registry. The coach's turn puts it in front of the member; they score every row at once — four
// native selects a row, 44 px each, the rubric's five anchors inside every list so the scale reads the
// same for every member — and send once. Grayscale: the row's name is the only ink; a mute line under it
// where a row needs context (a company's sub-sector and signal); axis labels and totals recede.
// `Send scores` is the panel's one red while it waits (the composer's Send steps down to secondary).
// Forty rows scroll; the axis header stays put at the top of the panel's scroll container.
// Docked (392 px) a row is two lines — the name, then the four selects; expanded (§11) a row is one line —
// name · four selects · total — so forty companies are half the scroll and every anchor reads in full.
//
// With evidence (docs/UX_COACH_COMPANY_SCORING.md §4): the portal pre-fills the cells it can read (Growth, Access)
// and puts its reasons under each name as short mute lines — the axis word in label weight, the people's names and
// the matched competency in body ink. A filled select looks like any chosen value: the evidence line says it was
// suggested. A suggestion the member changes is sent as an override. The draft survives a re-show (the matrix is
// shown again once Connections.csv lands) through a module-level map keyed by the rows.

type Draft = Record<string, (number | undefined)[]>;
const DRAFTS = new Map<string, Draft>();
const draftKey = (kind: string, items: readonly string[]) => `${kind}:${items.join("|")}`;

const AXIS_OF_EVIDENCE: Record<string, keyof CompanyEvidence> = { growth: "growth", interest: "interest", access: "access", proof: "proof" };

export default function ScoreMatrix({ kind, items, meta, evidence, suggested, connections, onSubmit, onConnections, disabled = false, wide = false, onExpand }: {
  kind: RubricKind;
  items: readonly string[];
  /** A mute line under each row — `meta[i]` for `items[i]`; "" or missing for none. Not shown when `evidence` is. */
  meta?: readonly string[];
  /** The portal's evidence per row (companies): suggestions with their reasons, context for the member's axes. */
  evidence?: readonly CompanyEvidence[];
  /** The cells the portal pre-filled per row, in axis order; null = the member's. */
  suggested?: readonly (readonly (number | null)[])[];
  /** How many connections matched — null when none are on file. */
  connections?: { total: number; matched: number } | null;
  onSubmit: (rows: MatrixRow[]) => void;
  /** The member adds Connections.csv from the header; the matrix is re-shown with Access suggested. */
  onConnections?: (c: ConnectionsAttachment) => void;
  disabled?: boolean;
  /** The panel is expanded: one line a row. */
  wide?: boolean;
  /** Offered while docked: the one moment the wider panel earns its tap. */
  onExpand?: () => void;
}) {
  const r = rubricOf(kind);
  const key = draftKey(kind, items);
  const suggestedFor = (item: string): readonly (number | null)[] => suggested?.[items.indexOf(item)] ?? r.axes.map(() => null);
  const seeded = (): Draft => {
    const kept = DRAFTS.get(key) ?? {};
    const d: Draft = {};
    for (const item of items) {
      const s = suggestedFor(item);
      d[item] = r.axes.map((_, i) => kept[item]?.[i] ?? (s[i] ?? undefined));
    }
    return d;
  };
  const [draft, setDraft] = useState<Draft>(seeded);
  // Suggestions that arrive later (Access, once the connections land) fill cells the member has not touched.
  const touched = useRef<Set<string>>(new Set());
  useEffect(() => {
    setDraft((d) => {
      const next: Draft = { ...d };
      for (const item of items) { const s = suggestedFor(item); next[item] = r.axes.map((_, i) => (touched.current.has(`${item}:${i}`) ? d[item]?.[i] : (s[i] ?? d[item]?.[i]))); }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);
  useEffect(() => { DRAFTS.set(key, draft); }, [key, draft]);

  const row = (item: string) => draft[item] ?? [];
  const complete = (item: string) => r.axes.every((_, i) => typeof row(item)[i] === "number");
  const totalOf = (item: string) => (complete(item) ? row(item).reduce<number>((n, v) => n + (v ?? 0), 0) : null);
  const done = items.filter(complete).length;
  const allDone = done === items.length;
  const set = (item: string, i: number, v: string) => { touched.current.add(`${item}:${i}`); setDraft((d) => { const next = [...(d[item] ?? [])]; next[i] = v ? Number(v) : undefined; return { ...d, [item]: next }; }); };
  const submit = () => {
    if (!allDone || disabled) return;
    DRAFTS.delete(key);
    onSubmit(items.map((item) => {
      const values = row(item).map((v) => v!);
      const s = suggestedFor(item);
      const overrides: MatrixOverride[] = r.axes.flatMap((a, i) => (s[i] !== null && s[i] !== values[i] ? [{ axis: a.key, from: s[i]! }] : []));
      return { item, values, ...(overrides.length ? { overrides } : {}) };
    }));
  };
  const max = maxTotal(r);
  const assisted = !!evidence?.length;
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

  // The connections file, from the header.
  const file = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const takeConnections = async (f: File | undefined) => {
    setFileError(null);
    if (!f || !onConnections) return;
    const res = await readConnectionsFile(f);
    if (res.ok) onConnections(res.connections); else setFileError(res.error);
    if (file.current) file.current.value = "";
  };

  const header = assisted
    ? connections
      ? <>Growth and Access are suggested from the postings, each growth source and your {connections.total.toLocaleString()} LinkedIn connections ({connections.matched} {connections.matched === 1 ? "company has" : "companies have"} one). Change any you disagree with; Interest and Proof are yours.</>
      : <>Growth is suggested from the postings and each growth source; Access is a guess until you add your LinkedIn connections. Interest and Proof are yours.</>
    : <>Four numbers for each. What each number means is inside every list — the same scale for everyone.</>;

  return (
    <form className="space-y-4" aria-labelledby="score-matrix-title" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div>
        <p id="score-matrix-title" className="section-label">{r.title} · 1–5</p>
        <p className="mt-1 text-sm text-jh-mute">
          {header}
          {!wide && onExpand && <> <button type="button" onClick={onExpand} className="hidden underline underline-offset-2 hover:text-jh-ink sm:inline">Expand for more room ›</button></>}
        </p>
        {assisted && !connections && onConnections && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input ref={file} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void takeConnections(e.target.files?.[0])} />
            <button type="button" onClick={() => file.current?.click()} disabled={disabled} className="btn-secondary btn-sm">Add Connections.csv</button>
            <span className="text-xs text-jh-mute">LinkedIn → Settings → Data privacy → Get a copy of your data → Connections. Stays in your account; your coach sees counts, not names.</span>
          </div>
        )}
        {fileError && <p role="alert" className="mt-2 text-sm text-jh-red">{fileError}</p>}
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
          const ev = evidence?.[idx];
          const line = !ev ? meta?.[idx]?.trim() : undefined;
          const block = ev ? <EvidenceBlock evidence={ev} suggested={suggestedFor(item)} axes={r.axes.map((a) => a.key)} /> : null;
          if (wide) {
            return (
              <li key={item} className={`${wideCols} py-2`} data-wide-row>
                <div className="min-w-0 max-w-prose">
                  <p className="truncate text-[15px] text-jh-ink">{item}</p>
                  {line && <p className="truncate text-xs text-jh-mute">{line}</p>}
                  {block}
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
              {block}
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
        {assisted && <p className="mt-2">Suggested numbers come from your postings, each company&apos;s growth source and your connections — change any you disagree with; the changed ones are shown to your coach.</p>}
      </details>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-jh-mute" role="status">{done} of {items.length} scored</span>
        <button type="submit" disabled={!allDone || disabled} className="btn-primary h-11">Send scores</button>
      </div>
    </form>
  );
}

// The portal's reasons under a company's name: one short line per axis, the axis word in label weight, a number
// where one was suggested, the people and the matched competency in body ink. The source is the row's one link.
function EvidenceBlock({ evidence, suggested, axes }: { evidence: CompanyEvidence; suggested: readonly (number | null)[]; axes: readonly string[] }) {
  const n = (axis: string) => suggested[axes.indexOf(axis)];
  const Line = ({ axis, children }: { axis: string; children: React.ReactNode }) => (
    <p className="text-xs leading-5 text-jh-mute line-clamp-2"><span className="label mb-0 mr-1 inline">{axis}{n(axis.toLowerCase()) !== null && n(axis.toLowerCase()) !== undefined ? ` ${n(axis.toLowerCase())}` : ""} ·</span>{children}</p>
  );
  const growth = evidence.growth.why.map((w, i) => (w.endsWith(" ›") ? <span key={i}>{i ? " · " : ""}{w.slice(0, -2)} <span className="text-jh-body">›</span></span> : <span key={i}>{i ? " · " : ""}{w}</span>));
  const access = evidence.access.contacts.length
    ? <>{evidence.access.contacts.map((c, i) => <span key={c.name}>{i ? " · " : ""}<span className="text-jh-body">{c.name}</span>{c.position ? `, ${c.position}` : ""}</span>)}{evidence.access.more ? ` · +${evidence.access.more} more` : ""}</>
    : <>{evidence.access.suggested === 3 ? "no connection on file — a posting is a route" : "no connection on file"}</>;
  const proof = evidence.proof.phrases.length
    ? <>they post for {evidence.proof.phrases.map((p, i) => <span key={p}>{i ? ", " : ""}&ldquo;{p}&rdquo;</span>)} — {evidence.proof.matches.length ? <>you have <span className="text-jh-body">{evidence.proof.matches.join(", ")}</span></> : "none of your competencies in their words"}</>
    : <>{evidence.proof.line}</>;
  return (
    <div className="space-y-1 pt-1" data-evidence>
      <Line axis="Growth">{growth}</Line>
      <Line axis="Access">{access}</Line>
      <Line axis="Interest">{evidence.interest.line}</Line>
      <Line axis="Proof">{proof}</Line>
    </div>
  );
}

// The scored table as the member's turn: ranked rows, the numbers in mono, the total in ink; one thin
// divider marks the rubric's cut. No colour — the coach's words carry the judgement. A changed suggestion
// shows its digit in body ink with what the portal had, mute, beside it.
export function ScoredRows({ kind, rows }: { kind: RubricKind; rows: readonly ScoredRow[] }) {
  const r = rubricOf(kind);
  const ranked = byRank(rows);
  const digits = (s: ScoredRow) => r.axes.map((a, j) => {
    const o = s.overrides?.find((x) => x.axis === a.key);
    return <span key={a.key}>{j ? " · " : ""}{o ? <span className="text-jh-body" title={`was ${o.from}`}>{s.values[j]}<span className="text-jh-mute"> ({o.from})</span></span> : s.values[j]}</span>;
  });
  const changed = rows.filter((s) => s.overrides?.length).length;
  return (
    <div className="space-y-2">
      <p className="section-label">Scored {rows.length} {rows.length === 1 ? r.item : r.items}</p>
      <ol className="text-sm">
        {ranked.map((s, i) => (
          <li key={s.item} className={`flex items-baseline gap-3 py-1.5 ${i === r.cut ? "border-t border-jh-line-2 pt-2.5" : ""}`}>
            <span className="w-5 shrink-0 text-right font-mono text-xs text-jh-mute">{s.rank}</span>
            <span className="min-w-0 flex-1 truncate text-jh-ink">{s.item}</span>
            <span className="shrink-0 font-mono text-xs text-jh-mute" aria-label={r.axes.map((a, j) => `${a.label} ${s.values[j]}`).join(", ")}>{digits(s)}</span>
            <span className="w-6 shrink-0 text-right font-mono text-sm font-semibold text-jh-ink">{s.total}</span>
          </li>
        ))}
      </ol>
      {ranked.length > r.cut && <p className="text-xs text-jh-mute">{r.cutLine}</p>}
      {changed > 0 && <p className="text-xs text-jh-mute">{changed} {changed === 1 ? "suggestion" : "suggestions"} changed — the portal&apos;s number in brackets.</p>}
    </div>
  );
}
