import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { mergeContent } from "@/lib/content";
import type { ContentConfig } from "@/lib/types";

// Read the merged content config (defaults <- stored overrides).
export async function getContent(): Promise<ContentConfig> {
  const snap = await adminDb().doc("config/content").get();
  return mergeContent(snap.exists ? (snap.data() as Partial<ContentConfig>) : null);
}

// Persist a full content config (the admin editor sends the whole object).
export async function saveContent(content: Partial<ContentConfig>, updatedBy?: string) {
  await adminDb().doc("config/content").set(
    { ...content, updatedBy: updatedBy ?? null, updatedAt: Date.now() },
    { merge: true }
  );
}
