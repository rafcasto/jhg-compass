import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { normalizeCoachingScreen, type CoachingScreenContent, type CoachingScreenDoc } from "@/lib/coaching-screen";

const REF = "config/coachingScreen";

// The stored { draft, published } pair plus its audit fields.
export async function getCoachingScreenDoc(): Promise<CoachingScreenDoc> {
  const snap = await adminDb().doc(REF).get();
  const d = (snap.exists ? snap.data() : {}) as Partial<CoachingScreenDoc>;
  return {
    draft: d.draft ? normalizeCoachingScreen(d.draft) : null,
    published: d.published ? normalizeCoachingScreen(d.published) : null,
    publishedAt: d.publishedAt ?? null,
    publishedBy: d.publishedBy ?? null,
    updatedAt: d.updatedAt ?? null,
    updatedBy: d.updatedBy ?? null,
  };
}

// "draft" only touches the working copy; "publish" also promotes it to what the
// app renders and stamps the audit line. `by` is the admin's email (or uid).
export async function saveCoachingScreen(
  action: "draft" | "publish",
  content: CoachingScreenContent,
  by: string
): Promise<CoachingScreenDoc> {
  const now = Date.now();
  const patch: Record<string, unknown> = { draft: content, updatedAt: now, updatedBy: by };
  if (action === "publish") Object.assign(patch, { published: content, publishedAt: now, publishedBy: by });
  await adminDb().doc(REF).set(patch, { merge: true });
  return getCoachingScreenDoc();
}
