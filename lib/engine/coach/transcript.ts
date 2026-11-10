// What the member sees of a coach conversation — users/{uid}/coachSessions/{coach}.turns —
// and the stream events the turn route sends while a reply is being written. The API
// transcript (the messages replayed to Claude) is stored beside it as JSON; this is the
// readable half. Pure — tested.

export interface WriteNote {
  /** Section labels as the page shows them: "Contact details", "Headline". */
  labels: string[];
  /** Deep links to those sections on the portal the member is on. */
  links: { label: string; href: string }[];
  progress?: "in_progress" | "complete";
}

export interface TranscriptTurn {
  role: "coach" | "member";
  text: string;
  at: number;
  /** What this coach turn wrote into the profile, in order. */
  writes?: WriteNote[];
}

/** One event on the turn route's stream (SSE `data:` lines). */
export type TurnEvent =
  | { type: "text"; text: string }
  | { type: "write"; note: WriteNote }
  | { type: "done"; turn: TranscriptTurn; usdThisTurn: number }
  | { type: "error"; message: string };

/** A coach turn as it is being streamed: text so far and the writes so far. */
export interface PendingTurn { text: string; writes: WriteNote[] }

export const emptyPending = (): PendingTurn => ({ text: "", writes: [] });

/** The pending turn after one more event. */
export function applyEvent(p: PendingTurn, e: TurnEvent): PendingTurn {
  if (e.type === "text") return { ...p, text: p.text + e.text };
  if (e.type === "write") return { ...p, writes: [...p.writes, e.note] };
  return p;
}

/** Parse one SSE frame's data line; null for a keep-alive or malformed frame. */
export function parseEvent(data: string): TurnEvent | null {
  try {
    const e = JSON.parse(data) as TurnEvent;
    return e && typeof e === "object" && typeof (e as { type?: unknown }).type === "string" ? e : null;
  } catch { return null; }
}

/** "Updated Contact details, Headline" — the status line for a write (docs/UX_COACH.md §3). */
export function writeLine(note: WriteNote): string {
  if (note.progress === "complete" && !note.labels.length) return "Marked complete";
  const what = note.labels.length ? note.labels.join(", ") : "your profile";
  return `${note.progress === "complete" ? "Completed · " : ""}Updated ${what}`;
}

export const STREAM_FRAME = (e: TurnEvent) => `data: ${JSON.stringify(e)}\n\n`;
