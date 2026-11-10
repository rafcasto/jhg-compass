"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Markdown } from "@/components/careerops/shared";
import { writeLine, type PendingTurn, type TranscriptTurn, type WriteNote } from "@/lib/engine/coach/transcript";

// A transcript, not chat bubbles (docs/UX_COACH.md §3): the coach's turns as prose,
// the member's under a `You` label on a mist block, each write as the portal's status
// line. 24 px between turns, 8 px inside one. Scrolls to the newest as it arrives.
export default function Transcript({ turns, pending, error, quota }: {
  turns: readonly TranscriptTurn[];
  /** The coach's turn being written right now. */
  pending: PendingTurn | null;
  error?: string | null;
  /** The one mute line when this month's limit is reached. */
  quota?: string | null;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [turns.length, pending?.text.length, pending?.writes.length]);

  return (
    <div className="space-y-6" aria-live="polite">
      {turns.map((t, i) => <Turn key={`${t.at}-${i}`} turn={t} />)}
      {pending && (
        <div className="space-y-2">
          {pending.writes.map((w, i) => <WriteStatus key={i} note={w} />)}
          {pending.text
            ? <div className="text-[15px] leading-relaxed text-jh-ink"><Markdown>{pending.text}</Markdown></div>
            : <p className="text-sm text-jh-mute animate-pulse">Thinking…</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-jh-red">{error}</p>}
      {quota && <p role="status" className="text-sm text-jh-mute">{quota}</p>}
      <div ref={end} />
    </div>
  );
}

function Turn({ turn }: { turn: TranscriptTurn }) {
  if (turn.role === "member") {
    return (
      <div className="rounded-md bg-jh-mist px-4 py-3">
        <p className="section-label mb-1">You</p>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-jh-ink">{turn.text}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {turn.writes?.map((w, i) => <WriteStatus key={i} note={w} />)}
      {turn.text && <div className="text-[15px] leading-relaxed text-jh-ink"><Markdown>{turn.text}</Markdown></div>}
    </div>
  );
}

function WriteStatus({ note }: { note: WriteNote }) {
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-jh-line bg-jh-mist/40 px-3 py-2 text-sm text-jh-ink">
      <Check className="h-4 w-4 shrink-0 text-rb-green-dark" aria-hidden /> {writeLine(note)}
      {note.links.length > 0 && <Link href={note.links[0].href} className="link text-sm">View ›</Link>}
    </p>
  );
}
