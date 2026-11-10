// The monthly meter — users/{uid}/claudeUsage/{YYYY-MM} (docs/UX_COACH.md §8, decision 7:
// measure first, limit later). Every Claude call the engine makes adds one entry; the
// monthly budget and turn quota (lib/engine/config.ts) read the same document.
// Pure — the Firestore write is in usage-server.ts. Tested.

import { addUsage, EMPTY_USAGE, type TokenUsage } from "./pricing";

/** What one entry is for: a coach conversation (`coach:narrative`) or a job (`job:evaluate`). */
export type UsageKind = "coach" | "job";
export const usageKey = (kind: UsageKind, key: string) => `${kind}:${key}`;

export interface UsageLine extends TokenUsage {
  turns: number;
  estimatedUsd: number;
}

export interface ClaudeUsageMonth extends UsageLine {
  month: string;                       // "2026-11"
  by: Record<string, UsageLine>;       // usageKey → that coach's / job's share
  byModel: Record<string, UsageLine>;  // model id → its share
  updatedAt: number;
}

export interface UsageEntry {
  kind: UsageKind;
  key: string;        // coach key or job type
  model: string;
  usage: TokenUsage;
  estimatedUsd: number;
}

export const emptyLine = (): UsageLine => ({ ...EMPTY_USAGE, turns: 0, estimatedUsd: 0 });
export const emptyMonth = (month: string, now = Date.now()): ClaudeUsageMonth => ({ month, ...emptyLine(), by: {}, byModel: {}, updatedAt: now });

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const addLine = (a: UsageLine | undefined, e: UsageEntry): UsageLine => {
  const base = a ?? emptyLine();
  return { ...addUsage(base, e.usage), turns: base.turns + 1, estimatedUsd: round(base.estimatedUsd + e.estimatedUsd) };
};

/** The month after one more call. Never mutates. */
export function addEntry(doc: ClaudeUsageMonth, e: UsageEntry, now = Date.now()): ClaudeUsageMonth {
  const k = usageKey(e.kind, e.key);
  const total = addLine(doc, e);
  return {
    ...doc, ...total,
    by: { ...doc.by, [k]: addLine(doc.by[k], e) },
    byModel: { ...doc.byModel, [e.model]: addLine(doc.byModel[e.model], e) },
    updatedAt: now,
  };
}

/** A stored document (possibly partial, possibly from an older shape) read as a whole month. */
export function readMonth(raw: Partial<ClaudeUsageMonth> | null | undefined, month: string): ClaudeUsageMonth {
  const base = emptyMonth(month, raw?.updatedAt ?? 0);
  if (!raw) return base;
  const line = (l: Partial<UsageLine> | undefined): UsageLine => ({ ...emptyLine(), ...(l ?? {}) });
  return {
    ...base, ...line(raw), month,
    by: Object.fromEntries(Object.entries(raw.by ?? {}).map(([k, v]) => [k, line(v)])),
    byModel: Object.fromEntries(Object.entries(raw.byModel ?? {}).map(([k, v]) => [k, line(v)])),
    updatedAt: raw.updatedAt ?? 0,
  };
}
