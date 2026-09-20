// Validation for what the admin can change on an agent. Pure — tested.
import { AGENT_KEYS, type AgentKey } from "./keys";
import type { AgentConfig } from "./types";

export const LIMITS = {
  numCtx: { min: 2048, max: 32768 },
  numPredict: { min: 256, max: 8192 },
  temperature: { min: 0, max: 1.5 },
  dailyEvalQuota: { min: 1, max: 500 },
  dailyScanQuota: { min: 1, max: 100 },
  promptMax: 20_000,
} as const;

export type AgentSettingsPatch = Partial<Pick<AgentConfig, "model" | "numCtx" | "numPredict" | "temperature" | "enabled">>;

export const isAgentKey = (v: unknown): v is AgentKey => (AGENT_KEYS as readonly string[]).includes(v as string);

const MODEL_TAG = /^[A-Za-z0-9._\-\/]+(:[A-Za-z0-9._\-]+)?$/;

// Returns the clean patch or a human error. Only keys present in `raw` are validated.
export function validateAgentPatch(raw: unknown): { ok: true; patch: AgentSettingsPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "patch must be an object" };
  const r = raw as Record<string, unknown>;
  const patch: AgentSettingsPatch = {};
  if ("model" in r) {
    if (typeof r.model !== "string" || !MODEL_TAG.test(r.model.trim()) || r.model.length > 120) return { ok: false, error: "model must be an Ollama tag like llama3.2:3b, or claude-cli / claude-cli:sonnet" };
    patch.model = r.model.trim();
  }
  for (const k of ["numCtx", "numPredict"] as const) {
    if (k in r) {
      const n = Math.round(Number(r[k]));
      if (!Number.isFinite(n) || n < LIMITS[k].min || n > LIMITS[k].max) return { ok: false, error: `${k} must be ${LIMITS[k].min}–${LIMITS[k].max}` };
      patch[k] = n;
    }
  }
  if ("temperature" in r) {
    const t = Number(r.temperature);
    if (!Number.isFinite(t) || t < LIMITS.temperature.min || t > LIMITS.temperature.max) return { ok: false, error: `temperature must be ${LIMITS.temperature.min}–${LIMITS.temperature.max}` };
    patch.temperature = Math.round(t * 100) / 100;
  }
  if ("enabled" in r) {
    if (typeof r.enabled !== "boolean") return { ok: false, error: "enabled must be true or false" };
    patch.enabled = r.enabled;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "nothing to change" };
  return { ok: true, patch };
}

export function validatePrompt(raw: unknown): { ok: true; prompt: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "prompt must be text" };
  const p = raw.replace(/\r\n/g, "\n").trim();
  if (p.length < 40) return { ok: false, error: "that prompt is too short to be useful" };
  if (p.length > LIMITS.promptMax) return { ok: false, error: `prompt must be under ${LIMITS.promptMax.toLocaleString()} characters` };
  return { ok: true, prompt: p };
}

export type QuotaKey = "dailyEvalQuota" | "dailyScanQuota";
export function validateQuota(raw: unknown, key: QuotaKey = "dailyEvalQuota"): number | null {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= LIMITS[key].min && n <= LIMITS[key].max ? n : null;
}

/** ≈ tokens for a prompt (3.6 chars/token is a fair average for English + Markdown). */
export const estimateTokens = (s: string) => Math.ceil(s.length / 3.6);
