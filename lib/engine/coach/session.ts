import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { BetaMessageParam } from "../claude";
import type { CoachKey, CoachState } from "./keys";
import type { TranscriptTurn } from "./transcript";

// users/{uid}/coachSessions/{coach} (docs/UX_COACH.md §7). Two halves of one conversation:
// `turns` is what the member reads (live, owner-readable); `messagesJson` is what Claude
// replays (the API transcript, tool blocks and all, appended whole and never edited so
// the cache and preserved thinking hold). Server-written only.

export interface CoachSession {
  status: CoachState;
  turns: TranscriptTurn[];
  messagesJson: string;
  turnCount: number;
  startedAt: number;
  lastTurnAt: number;
  /** The page the launcher was on when this session started — the tail label's memory. */
  openedOn?: string | null;
}

const ref = (uid: string, coach: CoachKey) => adminDb().doc(`users/${uid}/coachSessions/${coach}`);

export const emptySession = (now = Date.now()): CoachSession => ({ status: "not_started", turns: [], messagesJson: "[]", turnCount: 0, startedAt: now, lastTurnAt: 0, openedOn: null });

export async function getSession(uid: string, coach: CoachKey): Promise<CoachSession> {
  const snap = await ref(uid, coach).get();
  if (!snap.exists) return emptySession();
  const d = snap.data() as Partial<CoachSession>;
  return { ...emptySession(d.startedAt), ...d, turns: d.turns ?? [], messagesJson: d.messagesJson ?? "[]" };
}

export const messagesOf = (s: CoachSession): BetaMessageParam[] => {
  try { const m = JSON.parse(s.messagesJson); return Array.isArray(m) ? (m as BetaMessageParam[]) : []; } catch { return []; }
};

export async function saveSession(uid: string, coach: CoachKey, next: CoachSession): Promise<void> {
  await ref(uid, coach).set(next);
}

/** Start over: the transcript goes, the profile stays (docs/UX_COACH.md §7). */
export async function clearSession(uid: string, coach: CoachKey): Promise<void> {
  await ref(uid, coach).delete();
}
