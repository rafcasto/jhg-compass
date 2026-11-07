// The upload lock — docs/UX_JOBHACKING.md §4c (decision 2026-11-07).
//
// An admin can lock the four profile-file Upload buttons (JobHacking → Settings
// and the Compass Settings hub) behind the feedback survey: `config/feedback.
// uploadLock`, toggled beside the global modal in Admin → User interactions →
// Feedback. The lock is PER SLOT — one answer unlocks one file (the response
// carries `unlocks: <JhgFileKey>`), so a member answers once per file.
// Pure — no React. Tested.

import type { FeedbackConfig } from "./types";

export interface UploadLockInput {
  /** The admin flag, `config/feedback.uploadLock`. */
  uploadLock: boolean;
  /** The slots this member's answers have unlocked — `unlocks` on each response. */
  unlocked: readonly string[];
  /** The submission check has not answered yet. */
  loading: boolean;
}

/**
 * A slot is locked while the flag is on and no answer has unlocked it. While
 * the check is still loading the lock holds — a locked button that unlocks a
 * moment later is better than an upload that should not have gone through.
 */
export const slotLocked = ({ uploadLock, unlocked, loading }: UploadLockInput, slot: string): boolean =>
  uploadLock && (loading || !unlocked.includes(slot));

/** The slots still locked, in the order given. */
export const lockedSlots = (input: UploadLockInput, slots: readonly string[]): string[] =>
  slots.filter((s) => slotLocked(input, s));

/** "Each file unlocks with a short survey — 4 questions, once per file." — the header's mute line while any slot is locked. */
export function uploadLockLine(cfg: Pick<FeedbackConfig, "questions">): string {
  const n = cfg.questions.length;
  return `Each file unlocks with a short survey — ${n === 1 ? "1 question" : `${n} questions`}, once per file.`;
}
