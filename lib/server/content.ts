import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { mergeContent } from "@/lib/content";
import type { ContentConfig } from "@/lib/types";

export interface ContentMeta { updatedAt: number | null; updatedBy: string | null }

// Read the merged content config (defaults <- stored overrides).
export async function getContent(): Promise<ContentConfig> {
  const snap = await adminDb().doc("config/content").get();
  return mergeContent(snap.exists ? (snap.data() as Partial<ContentConfig>) : null);
}

// Audit line for the CMS editors.
export async function getContentMeta(): Promise<ContentMeta> {
  const snap = await adminDb().doc("config/content").get();
  const d = (snap.exists ? snap.data() : {}) as Record<string, unknown>;
  return {
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : null,
    updatedBy: typeof d.updatedBy === "string" ? d.updatedBy : null,
  };
}

// Persist a (partial) content config. `merge: true` deep-merges the `text` map,
// so editors that own a slice of the copy can save just that slice.
export async function saveContent(content: Partial<ContentConfig>, updatedBy?: string) {
  await adminDb().doc("config/content").set(
    { ...content, updatedBy: updatedBy ?? null, updatedAt: Date.now() },
    { merge: true }
  );
}
