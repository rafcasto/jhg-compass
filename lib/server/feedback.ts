import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { FeedbackConfig, FeedbackResponse } from "@/lib/types";
import { DEFAULT_FEEDBACK_CONFIG } from "@/lib/feedback-defaults";

export async function getFeedbackConfig(): Promise<FeedbackConfig> {
  const snap = await adminDb().doc("config/feedback").get();
  return { ...DEFAULT_FEEDBACK_CONFIG, ...(snap.exists ? (snap.data() as FeedbackConfig) : {}) };
}

export async function saveFeedbackConfig(patch: Partial<FeedbackConfig>, updatedBy?: string) {
  // merge:true keeps sibling fields; arrays (questions) are replaced wholesale,
  // which is exactly what we want when the admin edits the question list.
  await adminDb().doc("config/feedback").set(
    { ...patch, updatedBy: updatedBy ?? null, updatedAt: Date.now() },
    { merge: true }
  );
}

export interface FeedbackResponseRow extends FeedbackResponse {
  id: string;
}

// All submitted responses across every user (users/{uid}/feedback/{id}).
// Admin SDK bypasses security rules; sorted newest-first in memory to avoid a
// composite index requirement on the collection-group query.
export async function listFeedbackResponses(): Promise<FeedbackResponseRow[]> {
  const snap = await adminDb().collectionGroup("feedback").get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as FeedbackResponse) }));
  rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return rows;
}
