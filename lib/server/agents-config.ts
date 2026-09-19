import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_AGENTS_CONFIG, type AgentsConfig } from "@/lib/careerops/types";
import { AGENT_KEYS } from "@/lib/careerops/keys";

// config/agents — seeded by the Pi worker on first run; edited from Admin → Agents.
export async function getAgentsConfig(): Promise<AgentsConfig> {
  const snap = await adminDb().doc("config/agents").get();
  const d = (snap.exists ? snap.data() : {}) as Partial<AgentsConfig>;
  const agents = { ...DEFAULT_AGENTS_CONFIG.agents };
  for (const k of AGENT_KEYS) agents[k] = { ...DEFAULT_AGENTS_CONFIG.agents[k], ...(d.agents?.[k] ?? {}) };
  return { ...DEFAULT_AGENTS_CONFIG, ...d, agents };
}
