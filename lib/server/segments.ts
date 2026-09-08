import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { mergeSegments, type SegmentsConfig } from "@/lib/segments";

const REF = "config/segments";

export async function getSegmentsConfig(): Promise<SegmentsConfig> {
  const snap = await adminDb().doc(REF).get();
  return mergeSegments(snap.exists ? (snap.data() as Partial<SegmentsConfig>) : null);
}

export async function saveSegmentsConfig(patch: Partial<SegmentsConfig>, updatedBy?: string): Promise<SegmentsConfig> {
  const current = await getSegmentsConfig();
  const next = mergeSegments({ ...current, ...patch, actions: { ...current.actions, ...(patch.actions ?? {}) } });
  await adminDb().doc(REF).set({ ...next, updatedBy: updatedBy ?? null, updatedAt: Date.now() }, { merge: true });
  return next;
}
