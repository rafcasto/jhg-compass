// Client-safe types for the career-ops integration (no Upstash / Firebase imports).
import type { AgentKey, CareerOpsJobStatus, CareerOpsJobType } from "./keys";

export interface CareerOpsJob {
  id: string;
  type: CareerOpsJobType;
  status: CareerOpsJobStatus;
  uid: string;                 // member the job belongs to ("admin" jobs use the admin's uid)
  payload: Record<string, unknown>;
  createdAt: number;
  createdBy: string;           // email or uid
  startedAt?: number;
  endedAt?: number;
  worker?: string;
  progress?: string;           // one-line human status, e.g. "Block D — compensation"
  log?: string;                // tail of the worker log (≤ ~12 kB), fetched per job
  result?: unknown;
  error?: string;
  cancel?: number;             // 1 when cancellation has been requested
}

export interface WorkerHeartbeat {
  id: string;
  host: string;
  pid: number;
  version: string;
  startedAt: number;
  at: number;
  current: string | null;      // job id being worked on
  pollMs: number;
  n8n: boolean;                // n8n reachable at last check
  ollama: boolean;             // Ollama reachable at last check
}

export interface OllamaModelInfo { name: string; sizeGb: number; modifiedAt: string; family?: string; params?: string }

export interface WorkerState {
  models: OllamaModelInfo[];
  agents: { key: AgentKey; n8nWorkflowId: string | null; active: boolean }[];
  datasets: { name: string; examples: number; builtAt: string }[];
  gpu: { host: string | null; reachable: boolean; checkedAt: number };
  careerOpsVersion: string | null;   // ~/career-ops package.json version on the Pi
  updatedAt: number;
}

export interface AgentConfig {
  model: string;               // Ollama tag
  numCtx: number;
  temperature: number;
  systemPrompt: string;
  promptVersion: number;
  enabled: boolean;
  n8nWorkflowId: string | null;
}

// Stored at config/agents (admin write, worker read via Admin SDK).
export interface AgentsConfig {
  agents: Record<AgentKey, AgentConfig>;
  dailyEvalQuota: number;
  collectLiveData: boolean;    // approved live-member reports may enter training datasets (pseudonymised)
  updatedAt?: number;
  updatedBy?: string | null;
}

export const DEFAULT_AGENT: AgentConfig = {
  model: "qwen2.5:1.5b-instruct", numCtx: 8192, temperature: 0.2, systemPrompt: "", promptVersion: 0, enabled: true, n8nWorkflowId: null,
};

export const DEFAULT_AGENTS_CONFIG: AgentsConfig = {
  agents: {
    scout:     { ...DEFAULT_AGENT, model: "llama3.2:3b" },
    extractor: { ...DEFAULT_AGENT },
    evaluator: { ...DEFAULT_AGENT, model: "llama3.2:3b", numCtx: 8192 },
    tailor:    { ...DEFAULT_AGENT, model: "llama3.2:3b" },
    writer:    { ...DEFAULT_AGENT, model: "llama3.2:3b", temperature: 0.5 },
  },
  dailyEvalQuota: 20,
  collectLiveData: false,
};

// Admin → Agents → Overview payload.
export interface AgentsStatus {
  configured: boolean;         // Upstash env present
  worker: WorkerHeartbeat | null;
  online: boolean;
  state: WorkerState | null;
  queueLength: number;
}
