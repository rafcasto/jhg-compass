import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_AGENTS_CONFIG, type AgentsConfig, type AgentConfig, type PromptVersion } from "@/lib/careerops/types";
import { AGENT_KEYS, type AgentKey } from "@/lib/careerops/keys";
import type { AgentSettingsPatch } from "@/lib/careerops/config-validate";

const DOC = "config/agents";
const DEFAULTS_DOC = "config/agentsDefaults";     // written by the Pi worker on boot
const VERSIONS = "config/agents/promptVersions";  // {agent}-{version}

// config/agents — seeded by the Pi worker on first run; edited from Admin → Agents.
export async function getAgentsConfig(): Promise<AgentsConfig> {
  const snap = await adminDb().doc(DOC).get();
  const d = (snap.exists ? snap.data() : {}) as Partial<AgentsConfig>;
  const agents = { ...DEFAULT_AGENTS_CONFIG.agents };
  for (const k of AGENT_KEYS) agents[k] = { ...DEFAULT_AGENTS_CONFIG.agents[k], ...(d.agents?.[k] ?? {}) };
  return { ...DEFAULT_AGENTS_CONFIG, ...d, agents };
}

// The worker's built-in prompts/settings (for "Reset to default"). May be absent until the worker has booted once.
export async function getAgentDefaults(): Promise<Partial<Record<AgentKey, Partial<AgentConfig>>>> {
  const snap = await adminDb().doc(DEFAULTS_DOC).get();
  return snap.exists ? ((snap.data() as { agents?: Partial<Record<AgentKey, Partial<AgentConfig>>> }).agents ?? {}) : {};
}

export async function saveAgentSettings(agent: AgentKey, patch: AgentSettingsPatch, by: string | null) {
  const upd: Record<string, unknown> = { updatedAt: Date.now(), updatedBy: by };
  for (const [k, v] of Object.entries(patch)) upd[`agents.${agent}.${k}`] = v;
  await adminDb().doc(DOC).set({ agents: { [agent]: {} } }, { merge: true }); // make sure the map exists
  await adminDb().doc(DOC).update(upd);
}

export async function saveGlobalSettings(patch: { dailyEvalQuota?: number; collectLiveData?: boolean }, by: string | null) {
  await adminDb().doc(DOC).set({ ...patch, updatedAt: Date.now(), updatedBy: by }, { merge: true });
}

// A new prompt version: bumps promptVersion, marks it admin-edited (the worker
// then stops auto-upgrading it), and archives the text for restore.
export async function savePrompt(agent: AgentKey, systemPrompt: string, by: string | null, note?: string): Promise<{ version: number }> {
  const db = adminDb();
  const cfg = await getAgentsConfig();
  const current = cfg.agents[agent];
  const now = Date.now();
  const version = (current.promptVersion ?? 0) + 1;
  // Archive the outgoing text once, so the first-ever edit still has a "before".
  if (current.systemPrompt && !(await db.doc(`${VERSIONS}/${agent}-${current.promptVersion}`).get()).exists) {
    await db.doc(`${VERSIONS}/${agent}-${current.promptVersion}`).set({
      agent, version: current.promptVersion, systemPrompt: current.systemPrompt, savedBy: current.promptEditedBy ?? "careerops-worker (default)", savedAt: cfg.updatedAt ?? now, note: current.promptEditedBy ? "" : "worker default",
    } satisfies Omit<PromptVersion, "id">);
  }
  await db.doc(`${VERSIONS}/${agent}-${version}`).set({ agent, version, systemPrompt, savedBy: by, savedAt: now, note: note ?? "" } satisfies Omit<PromptVersion, "id">);
  await db.doc(DOC).set({ agents: { [agent]: {} } }, { merge: true });
  await db.doc(DOC).update({
    [`agents.${agent}.systemPrompt`]: systemPrompt, [`agents.${agent}.promptVersion`]: version,
    [`agents.${agent}.promptEditedBy`]: by, [`agents.${agent}.promptEditedAt`]: now, updatedAt: now, updatedBy: by,
  });
  return { version };
}

export async function listPromptVersions(agent: AgentKey, limit = 30): Promise<PromptVersion[]> {
  const snap = await adminDb().collection(VERSIONS).where("agent", "==", agent).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PromptVersion, "id">) }))
    .sort((a, b) => b.version - a.version).slice(0, limit);
}
