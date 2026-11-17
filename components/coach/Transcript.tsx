"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, Paperclip } from "lucide-react";
import { Markdown } from "@/components/careerops/shared";
import { pendingMatrixOf, searchErrorWords, writeLine, type JobNote, type PendingTurn, type TranscriptTurn, type WriteNote } from "@/lib/engine/coach/transcript";
import type { MatrixRow } from "@/lib/engine/coach/rubrics";
import type { ConnectionsAttachment } from "./document";
import JobStatus from "./JobStatus";
import ScoreMatrix, { ScoredRows } from "./ScoreMatrix";

// A transcript, not chat bubbles (docs/UX_COACH.md §3): the coach's turns as prose,
// the member's under a `You` label on a mist block, each write as the portal's status
// line. 24 px between turns, 8 px inside one. Scrolls to the newest as it arrives. The scoring
// matrix (docs/UX_COACH_AGENTIC.md §9–§10) is the one form in it: shown on the coach turn that asked
// for it until a member turn carries the scores, which then render as the scored table.
export default function Transcript({ turns, pending, error, quota, uid, jobHref, onScores, wide = false, onExpand, onConnections }: {
  turns: readonly TranscriptTurn[];
  /** The member — the research jobs a turn started are read live under their account. */
  uid?: string;
  /** Where a finished research job's View › goes (the page it wrote). */
  jobHref?: string;
  /** The coach's turn being written right now. */
  pending: PendingTurn | null;
  error?: string | null;
  /** The one mute line when this month's limit is reached. */
  quota?: string | null;
  /** The member sent the matrix's scores. */
  onScores?: (rows: MatrixRow[]) => void;
  /** The panel is expanded (docs/UX_COACH_AGENTIC.md §11): 16 / 1.75 and the one-line matrix rows. */
  wide?: boolean;
  /** The member added Connections.csv from the matrix header (docs/UX_COACH_COMPANY_SCORING.md §4). */
  onConnections?: (c: ConnectionsAttachment) => void;
  /** Expand the panel — offered on a docked matrix. */
  onExpand?: () => void;
}) {
  const body = wide ? "text-base leading-[1.75] text-jh-ink" : "text-[15px] leading-relaxed text-jh-ink";
  const md = wide ? "base" : "sm";
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [turns.length, pending?.text.length, pending?.writes.length, pending?.matrix]);
  // The matrix still waiting for scores is the last one shown; a stored coach turn renders it only while it is that one.
  const waiting = pending?.matrix ?? pendingMatrixOf(turns);
  const matrixTurnAt = waiting && !pending?.matrix ? [...turns].reverse().find((t) => t.role === "coach" && t.matrix === waiting)?.at : undefined;

  return (
    <div className="space-y-6" aria-live="polite">
      {turns.map((t, i) => <Turn key={`${t.at}-${i}`} turn={t} uid={uid} jobHref={jobHref} body={body} md={md} matrix={t.at === matrixTurnAt && onScores ? { onScores, disabled: !!pending, wide, onExpand, onConnections } : undefined} />)}
      {pending && (
        <div className="space-y-2">
          {pending.writes.map((w, i) => <WriteStatus key={i} note={w} />)}
          {uid && pending.jobs.map((j) => <JobStatus key={j.id} uid={uid} job={j} href={jobHref} />)}
          {pending.text
            ? <div className={body}><Markdown size={md}>{pending.text}</Markdown></div>
            : <Thinking />}
          {pending.matrix && <div className="pt-2"><ScoreMatrix kind={pending.matrix.kind} items={pending.matrix.items} meta={pending.matrix.meta} evidence={pending.matrix.evidence} suggested={pending.matrix.suggested} connections={pending.matrix.connections} onSubmit={() => undefined} disabled wide={wide} /></div>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-jh-red">{error}</p>}
      {quota && <p role="status" className="text-sm text-jh-mute">{quota}</p>}
      <div ref={end} />
    </div>
  );
}

function Turn({ turn, uid, jobHref, body, md, matrix }: { turn: TranscriptTurn; uid?: string; jobHref?: string; body: string; md: "sm" | "base"; matrix?: { onScores: (rows: MatrixRow[]) => void; disabled: boolean; wide: boolean; onExpand?: () => void; onConnections?: (c: ConnectionsAttachment) => void } }) {
  if (turn.role === "member") {
    return (
      <div className="rounded-md bg-jh-mist px-4 py-3">
        <p className="section-label mb-1">You</p>
        {turn.attachment && <p className="mb-1 inline-flex items-center gap-1.5 text-sm text-jh-ink"><Paperclip className="h-3.5 w-3.5 text-jh-mute" aria-hidden /> {turn.attachment}</p>}
        {turn.scored && <ScoredRows kind={turn.scored.kind} rows={turn.scored.rows} />}
        {turn.text && <p className={`whitespace-pre-wrap ${body}`}>{turn.text}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {turn.writes?.map((w, i) => <WriteStatus key={i} note={w} />)}
      {turn.text && <div className={body}><Markdown size={md}>{turn.text}</Markdown></div>}
      {uid && turn.jobs?.map((j: JobNote) => <JobStatus key={j.id} uid={uid} job={j} href={jobHref} />)}
      {turn.searchErrors?.length ? <p role="status" className="text-sm text-jh-mute">Search didn&apos;t run — {[...new Set(turn.searchErrors)].map(searchErrorWords).join("; ")}.</p> : null}
      {turn.matrix && matrix && <div className="pt-2"><ScoreMatrix kind={turn.matrix.kind} items={turn.matrix.items} meta={turn.matrix.meta} evidence={turn.matrix.evidence} suggested={turn.matrix.suggested} connections={turn.matrix.connections} onSubmit={matrix.onScores} disabled={matrix.disabled} wide={matrix.wide} onExpand={matrix.onExpand} onConnections={matrix.onConnections} /></div>}
    </div>
  );
}

// The one moving pixel while the coach writes: a 6 px dot pulses before a static word — text never blinks
// (docs/UX_COACH_AGENTIC.md §1).
function Thinking() {
  return (
    <p className="flex items-center gap-2 text-sm text-jh-mute" role="status">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-jh-mute animate-pulse" aria-hidden /> Thinking…
    </p>
  );
}

// A write is a bare status line, not a box — the member's turn is the transcript's one box kind
// (docs/UX_COACH_AGENTIC.md §1).
// On a hand-over the readiness sentence follows, mute, from code (docs/UX_COACH_AGENTIC.md §4) — never a banner.
function WriteStatus({ note }: { note: WriteNote }) {
  return (
    <div className="space-y-1">
      <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-jh-ink">
        <Check className="h-4 w-4 shrink-0 text-rb-green-dark" aria-hidden /> {writeLine(note)}
        {note.links.length > 0 && <Link href={note.links[0].href} className="link text-sm">View ›</Link>}
      </p>
      {note.readiness && <p className="text-sm text-jh-mute">{note.readiness}</p>}
    </div>
  );
}
