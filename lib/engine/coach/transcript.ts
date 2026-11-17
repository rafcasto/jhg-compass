// What the member sees of a coach conversation — users/{uid}/coachSessions/{coach}.turns —
// and the stream events the turn route sends while a reply is being written. The API
// transcript (the messages replayed to Claude) is stored beside it as JSON; this is the
// readable half. Pure — tested.

import type { RubricKind, ScoredRow } from "./rubrics";
import type { CompanyEvidence } from "./evidence";

export interface WriteNote {
  /** Section labels as the page shows them: "Contact details", "Headline". */
  labels: string[];
  /** Deep links to those sections on the portal the member is on. */
  links: { label: string; href: string }[];
  progress?: "in_progress" | "complete";
  /** On a hand-over: whether CareerOps can run, in one mute sentence (docs/UX_COACH_AGENTIC.md §4). */
  readiness?: string;
}

/** A research job a coach turn started — the panel reads users/{uid}/engineJobs/{id} live (docs/UX_COACH_AGENTIC.md §2). */
export interface JobNote { id: string; type: string; label: string }

/**
 * A scoring matrix a coach turn showed (docs/UX_COACH_AGENTIC.md §9–§10): the rubric, the rows, and a mute line under each
 * where the row needs context. For companies (docs/UX_COACH_COMPANY_SCORING.md): the portal's evidence per row, the cells it
 * pre-filled (null = the member's), and how many connections matched.
 */
export interface MatrixNote { kind: RubricKind; items: string[]; meta?: string[]; evidence?: CompanyEvidence[]; suggested?: (number | null)[][]; connections?: { total: number; matched: number } | null }
/** The member's answer to a matrix, with the portal's totals and ranks — the member turn IS the scored table. */
export interface ScoredNote { kind: RubricKind; rows: ScoredRow[] }

/** A web search error code in plain words — the member's transcript line and the operator's note (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §4 PR 0). */
export const SEARCH_ERROR_WORDS: Record<string, string> = {
  max_uses_exceeded: "this turn's search allowance was used up",
  too_many_requests: "the search service was rate-limited",
  unavailable: "the search service was unavailable",
  invalid_tool_input: "the search query was rejected",
  query_too_long: "the search query was too long",
  request_too_large: "the request was too large",
  unknown: "the search failed",
};
export const searchErrorWords = (code: string): string => SEARCH_ERROR_WORDS[code] ?? SEARCH_ERROR_WORDS.unknown;

export interface TranscriptTurn {
  role: "coach" | "member";
  text: string;
  at: number;
  /** What this coach turn wrote into the profile, in order. */
  writes?: WriteNote[];
  /** The research jobs this coach turn started. */
  jobs?: JobNote[];
  /** The matrix this coach turn put in front of the member — pending until a member turn carries `scored`. */
  matrix?: MatrixNote;
  /** The file the member handed over with this turn — its name; the text lives in the API transcript. */
  attachment?: string;
  /** The member's answer to the matrix, ranked by the portal. */
  scored?: ScoredNote;
  /** The web search's error codes on this coach turn — shown as one mute line, so a "while the tool is unavailable" has a reason beside it. */
  searchErrors?: string[];
}

/** One event on the turn route's stream (SSE `data:` lines). */
export type TurnEvent =
  | { type: "text"; text: string }
  | { type: "write"; note: WriteNote }
  | { type: "job"; job: JobNote }
  | { type: "matrix"; matrix: MatrixNote }
  | { type: "done"; turn: TranscriptTurn; usdThisTurn: number }
  | { type: "error"; message: string };

/** A coach turn as it is being streamed: text so far and the writes so far. */
export interface PendingTurn { text: string; writes: WriteNote[]; jobs: JobNote[]; matrix?: MatrixNote }

export const emptyPending = (): PendingTurn => ({ text: "", writes: [], jobs: [] });

/** The pending turn after one more event. */
export function applyEvent(p: PendingTurn, e: TurnEvent): PendingTurn {
  if (e.type === "text") return { ...p, text: p.text + e.text };
  if (e.type === "write") return { ...p, writes: [...p.writes, e.note] };
  if (e.type === "job") return { ...p, jobs: [...p.jobs, e.job] };
  if (e.type === "matrix") return { ...p, matrix: e.matrix };
  return p;
}

/** The matrix still waiting for the member's scores: the last coach turn's, unless a member turn with scores came after it. */
export function pendingMatrixOf(turns: readonly TranscriptTurn[]): MatrixNote | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role === "member" && t.scored) return null;
    if (t.role === "coach" && t.matrix) return t.matrix;
  }
  return null;
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
