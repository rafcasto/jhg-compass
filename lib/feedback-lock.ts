// The upload lock — docs/UX_JOBHACKING.md §4c (decision 2026-11-07).
//
// An admin can lock the four profile-file Upload buttons (JobHacking → Settings
// and the Compass Settings hub) until the member has answered the feedback
// survey: `config/feedback.uploadLock`, toggled beside the global modal in
// Admin → User interactions → Feedback. Pure — no React. Tested.

import type { FeedbackConfig } from "./types";

export interface UploadLockInput {
  /** The admin flag, `config/feedback.uploadLock`. */
  uploadLock: boolean;
  /** The member has submitted the survey at least once (any source). */
  submitted: boolean;
  /** The submission check has not answered yet. */
  loading: boolean;
}

/**
 * Locked while the flag is on and the member has not submitted. While the
 * check is still loading the lock holds — a locked button that unlocks a
 * moment later is better than an upload that should not have gone through.
 */
export const uploadsLocked = ({ uploadLock, submitted, loading }: UploadLockInput): boolean =>
  uploadLock && (loading || !submitted);

/** "Answer 4 short questions and every slot unlocks." — the header's mute line while locked. */
export function uploadLockLine(cfg: Pick<FeedbackConfig, "questions">): string {
  const n = cfg.questions.length;
  const q = n === 1 ? "1 short question" : `${n} short questions`;
  return `Answer ${q} and every slot unlocks.`;
}
