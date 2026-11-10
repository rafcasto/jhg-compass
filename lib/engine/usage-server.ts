import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { monthKey } from "./keys";
import { estimateUsd, type TokenUsage } from "./pricing";
import { addEntry, emptyMonth, readMonth, type ClaudeUsageMonth, type UsageKind } from "./usage";
import type { EngineConfig } from "./config";

// The monthly meter in Firestore — users/{uid}/claudeUsage/{YYYY-MM}. One transaction
// per Claude call; the document is read live by the admin tab and checked by the
// quota before a call is made.

const path = (uid: string, month: string) => `users/${uid}/claudeUsage/${month}`;

export async function getUsageMonth(uid: string, now = Date.now()): Promise<ClaudeUsageMonth> {
  const month = monthKey(now);
  const snap = await adminDb().doc(path(uid, month)).get();
  return readMonth(snap.exists ? (snap.data() as Partial<ClaudeUsageMonth>) : null, month);
}

export interface MeterInput { kind: UsageKind; key: string; model: string; usage: TokenUsage }

/** Adds one call to this month and returns what it cost. */
export async function recordUsage(uid: string, input: MeterInput, cfg: Pick<EngineConfig, "prices" | "searchUsd">, now = Date.now()): Promise<{ estimatedUsd: number; month: ClaudeUsageMonth }> {
  const month = monthKey(now);
  const estimatedUsd = estimateUsd(input.model, input.usage, cfg.prices, cfg.searchUsd);
  const ref = adminDb().doc(path(uid, month));
  const next = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? readMonth(snap.data() as Partial<ClaudeUsageMonth>, month) : emptyMonth(month, now);
    const updated = addEntry(current, { ...input, estimatedUsd }, now);
    tx.set(ref, updated);
    return updated;
  });
  return { estimatedUsd, month: next };
}

/** Every member's month, for the admin tab — by uid list, no collection-group index needed. */
export async function getUsageMonths(uids: readonly string[], month = monthKey()): Promise<Record<string, ClaudeUsageMonth>> {
  const db = adminDb();
  const out: Record<string, ClaudeUsageMonth> = {};
  for (let i = 0; i < uids.length; i += 200) {
    const chunk = uids.slice(i, i + 200);
    const snaps = await db.getAll(...chunk.map((uid) => db.doc(path(uid, month))));
    snaps.forEach((s, j) => { if (s.exists) out[chunk[j]] = readMonth(s.data() as Partial<ClaudeUsageMonth>, month); });
  }
  return out;
}
