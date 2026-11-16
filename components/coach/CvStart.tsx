"use client";

import { useRef, useState } from "react";
import { readCoachDocument, type CoachDocument } from "./document";

// The CV-first start (docs/UX_COACH_AGENTIC.md §3): before any conversation, Coach 1 — and 4 and 5
// while no CV is stored — opens on one empty state: one primary action (the panel's one red while
// Send is not on screen yet) and a tertiary link. Centred, the one place centring is right. The file
// control is the native input behind the button — no drop zone in a 440 px lane.
export default function CvStart({ coachLabel, onStart }: {
  coachLabel: string;
  /** Start the conversation — with the member's CV, or without one. */
  onStart: (document: CoachDocument | null) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const take = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    const r = await readCoachDocument(f);
    if (r.ok) onStart(r.document); else setError(r.error);
    if (file.current) file.current.value = "";
  };
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-2">
        <h2 className="font-display text-[20px] font-semibold text-jh-ink">Start from your CV</h2>
        <p className="mx-auto max-w-[36ch] text-sm text-jh-mute">{coachLabel} will draft what it can from it, and you confirm each one — about twenty minutes instead of an hour.</p>
      </div>
      <input ref={file} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void take(e.target.files?.[0])} />
      <button type="button" onClick={() => file.current?.click()} className="btn-primary">Add your CV</button>
      <button type="button" onClick={() => onStart(null)} className="link text-sm">Start without one</button>
      {error && <p role="alert" className="max-w-[36ch] text-sm text-jh-red">{error}</p>}
      <p className="text-xs text-jh-mute">Markdown or plain text (.md, .txt)</p>
    </div>
  );
}
