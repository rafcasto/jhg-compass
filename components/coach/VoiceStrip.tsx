"use client";

import { Keyboard } from "lucide-react";

// The composer while the member is listening (docs/UX_COACH.md §4): one strip that says
// what is happening — Listening · Thinking · Speaking — shows the words as they are heard,
// and is itself the interrupt (tap while the coach speaks). Ink bars, no red: nothing here
// is an action to take, it is a state to read. `Type instead` drops back to the textarea.
export default function VoiceStrip({ listening, speaking, thinking, interim, error, onInterrupt, onTypeInstead }: {
  listening: boolean;
  speaking: boolean;
  thinking: boolean;
  interim: string;
  error?: string | null;
  onInterrupt: () => void;
  onTypeInstead: () => void;
}) {
  const state = speaking ? "The coach is speaking — tap to interrupt" : thinking ? "Thinking…" : listening ? "Listening…" : "Starting the microphone…";
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={speaking ? onInterrupt : undefined}
        aria-label={speaking ? "Interrupt the coach" : state}
        aria-live="polite"
        className={`flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2 text-left ${speaking ? "bg-jh-mist hover:bg-jh-mist/70" : "bg-white"}`}
      >
        <Bars active={listening && !speaking} speaking={speaking} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-jh-mute">{state}</span>
          {interim && !speaking && <span className="block truncate text-[15px] text-jh-ink">{interim}</span>}
        </span>
      </button>
      <div className="flex items-center justify-between gap-3">
        {error ? <p role="alert" className="text-xs text-jh-red">{error}</p> : <span className="text-xs text-jh-mute-2">A pause sends your answer. Numbers and links are read back before they are written.</span>}
        <button type="button" onClick={onTypeInstead} className="btn-ghost text-sm text-jh-ink shrink-0"><Keyboard className="h-4 w-4" aria-hidden /> Type instead</button>
      </div>
    </div>
  );
}

function Bars({ active, speaking }: { active: boolean; speaking: boolean }) {
  // Five ink bars; they move while listening, hold a steady shape while the coach speaks, rest otherwise.
  const heights = speaking ? [10, 16, 22, 16, 10] : [8, 14, 20, 14, 8];
  return (
    <span className="flex h-6 items-end gap-0.5" aria-hidden>
      {heights.map((h, i) => (
        <span key={i} className={`w-1 rounded-pill bg-jh-ink ${active ? "motion-safe:animate-pulse" : ""}`} style={{ height: h, animationDelay: `${i * 120}ms`, opacity: active || speaking ? 1 : 0.35 }} />
      ))}
    </span>
  );
}
