import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { EVENT_DEFAULTS, EVENT_KEYS, type EventKey, type EventStage } from "@/lib/tags";

export interface EventSetting {
  enabled: boolean;
  tag: string;
  stage: EventStage;
  label: string;
}
export type EventConfig = Record<EventKey, EventSetting>;

// 30s in-memory cache to avoid a Firestore read on every tracked event.
let cache: EventConfig | null = null;
let cachedAt = 0;

function merge(overrides: Record<string, Partial<EventSetting>>): EventConfig {
  const out = {} as EventConfig;
  for (const key of EVENT_KEYS) {
    const def = EVENT_DEFAULTS[key];
    const o = overrides[key] ?? {};
    out[key] = {
      enabled: o.enabled ?? true,
      tag: o.tag ?? def.tag,
      stage: (o.stage as EventStage) ?? def.stage,
      label: o.label ?? def.label,
    };
  }
  return out;
}

export async function getEventConfig(force = false): Promise<EventConfig> {
  if (!force && cache && Date.now() - cachedAt < 30_000) return cache;
  let overrides: Record<string, Partial<EventSetting>> = {};
  try {
    const snap = await adminDb().doc("config/events").get();
    if (snap.exists) overrides = (snap.data()?.events as any) ?? {};
  } catch { /* fall back to defaults */ }
  cache = merge(overrides);
  cachedAt = Date.now();
  return cache;
}

export async function saveEventConfig(events: Record<string, Partial<EventSetting>>, updatedBy?: string) {
  await adminDb().doc("config/events").set({ events, updatedBy: updatedBy ?? null, updatedAt: Date.now() }, { merge: true });
  cache = null; // bust cache
}
