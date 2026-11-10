import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { mergeEngineConfig, type EngineAgentPatch, type EngineConfig, type EngineLimitsPatch, type PromptOverride } from "./config";
import type { EngineAgent } from "./keys";

// config/engine and its prompt overrides — Admin SDK only (docs/CAREER_OPS_CLAUDE.md §1).
// The pattern is lib/server/agents-config.ts's, on documents of this engine's own.

const DOC = "config/engine";
const PROMPTS = "config/engine/prompts";            // {key}: the override in force
const VERSIONS = "config/engine/promptVersions";    // {key}-{n}: every override ever saved, for restore

export async function getEngineConfig(): Promise<EngineConfig> {
  const snap = await adminDb().doc(DOC).get();
  return mergeEngineConfig(snap.exists ? (snap.data() as Partial<EngineConfig>) : null);
}

export async function saveEngineAgent(agent: EngineAgent, patch: EngineAgentPatch, by: string | null): Promise<void> {
  const now = Date.now();
  await adminDb().doc(DOC).set({ agents: { [agent]: patch }, updatedAt: now, updatedBy: by }, { merge: true });
}

export async function saveEngineLimits(patch: EngineLimitsPatch, by: string | null): Promise<void> {
  await adminDb().doc(DOC).set({ ...patch, updatedAt: Date.now(), updatedBy: by }, { merge: true });
}

export async function getPromptOverride(key: string): Promise<PromptOverride | null> {
  const snap = await adminDb().doc(`${PROMPTS}/${key}`).get();
  return snap.exists ? (snap.data() as PromptOverride) : null;
}

export async function getPromptOverrides(keys: readonly string[]): Promise<Record<string, PromptOverride | null>> {
  if (!keys.length) return {};
  const db = adminDb();
  const snaps = await db.getAll(...keys.map((k) => db.doc(`${PROMPTS}/${k}`)));
  return Object.fromEntries(snaps.map((s, i) => [keys[i], s.exists ? (s.data() as PromptOverride) : null]));
}

/** A new override: stored in force and archived as the next version of that key. */
export async function savePromptOverride(key: string, systemPrompt: string, baseVersion: number, by: string | null, note?: string): Promise<{ version: number }> {
  const db = adminDb();
  const now = Date.now();
  const prior = await db.collection(VERSIONS).where("key", "==", key).orderBy("version", "desc").limit(1).get().catch(() => null);
  const version = (prior && !prior.empty ? (prior.docs[0].data().version as number) : 0) + 1;
  const override: PromptOverride = { systemPrompt, baseVersion, updatedAt: now, updatedBy: by, ...(note ? { note } : {}) };
  const batch = db.batch();
  batch.set(db.doc(`${PROMPTS}/${key}`), override);
  batch.set(db.doc(`${VERSIONS}/${key}-${version}`), { key, version, ...override });
  await batch.commit();
  return { version };
}

/** Back to the repo default: the override goes, the archive stays. */
export async function resetPromptOverride(key: string): Promise<void> {
  await adminDb().doc(`${PROMPTS}/${key}`).delete();
}
