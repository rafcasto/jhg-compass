// config/engine — the admin's settings for the Claude engine: model + effort per agent,
// the monthly limits, the price table (docs/CAREER_OPS_CLAUDE.md §1, §4; docs/UX_COACH.md §8).
// Its own document, so the Pi's config/agents is never touched. Pure: defaults, merge,
// validation, the quota check. The Firestore side is config-server.ts. Tested.

import { DEFAULT_MODEL, ENGINE_AGENTS, isEffort, isEngineModel, nextMonthStart, type Effort, type EngineAgent } from "./keys";
import { DEFAULT_PRICES, DEFAULT_SEARCH_USD, type ModelPrice } from "./pricing";
import type { ClaudeUsageMonth } from "./usage";

export interface EngineAgentConfig {
  model: string;
  effort: Effort;
  /** max_tokens on every call this agent makes. */
  maxTokens: number;
  enabled: boolean;
}

export interface EngineConfig {
  agents: Record<EngineAgent, EngineAgentConfig>;
  /** USD per member per month; 0 = no limit (decision 7: measure first). */
  monthlyBudgetUsd: number;
  /** Claude calls per member per month; 0 = no limit. */
  monthlyTurnQuota: number;
  prices: Record<string, ModelPrice>;
  searchUsd: number;
  updatedAt?: number;
  updatedBy?: string | null;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  agents: {
    // A turn is ≤ 250 words, but a save point writes whole lists (Coach 3: forty companies) in one tool call.
    coach:      { model: DEFAULT_MODEL, effort: "low",    maxTokens: 32000, enabled: true },
    evaluator:  { model: DEFAULT_MODEL, effort: "high",   maxTokens: 16000, enabled: true },
    tailor:     { model: DEFAULT_MODEL, effort: "medium", maxTokens: 16000, enabled: true },
    writer:     { model: DEFAULT_MODEL, effort: "medium", maxTokens: 8000,  enabled: true },
    researcher: { model: DEFAULT_MODEL, effort: "medium", maxTokens: 16000, enabled: true },
  },
  monthlyBudgetUsd: 0,
  monthlyTurnQuota: 0,
  prices: DEFAULT_PRICES,
  searchUsd: DEFAULT_SEARCH_USD,
};

export const LIMITS = {
  maxTokens: { min: 256, max: 64000 },
  monthlyBudgetUsd: { min: 0, max: 10_000 },
  monthlyTurnQuota: { min: 0, max: 100_000 },
  promptMax: 60_000,
} as const;

/** What is stored, read over the defaults — a missing agent or price falls back, never breaks. */
export function mergeEngineConfig(stored: Partial<EngineConfig> | null | undefined): EngineConfig {
  const agents = { ...DEFAULT_ENGINE_CONFIG.agents };
  for (const k of ENGINE_AGENTS) agents[k] = { ...DEFAULT_ENGINE_CONFIG.agents[k], ...(stored?.agents?.[k] ?? {}) };
  return {
    ...DEFAULT_ENGINE_CONFIG,
    ...(stored ?? {}),
    agents,
    prices: { ...DEFAULT_PRICES, ...(stored?.prices ?? {}) },
    searchUsd: typeof stored?.searchUsd === "number" ? stored.searchUsd : DEFAULT_SEARCH_USD,
  };
}

export const isEngineAgent = (v: unknown): v is EngineAgent => (ENGINE_AGENTS as readonly string[]).includes(v as string);

export type EngineAgentPatch = Partial<EngineAgentConfig>;

/** The clean patch for one agent, or a human error. Only the keys present are validated. */
export function validateAgentPatch(raw: unknown): { ok: true; patch: EngineAgentPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "patch must be an object" };
  const r = raw as Record<string, unknown>;
  const patch: EngineAgentPatch = {};
  if ("model" in r) {
    if (!isEngineModel(r.model)) return { ok: false, error: "model must be one of the engine's models" };
    patch.model = r.model;
  }
  if ("effort" in r) {
    if (!isEffort(r.effort)) return { ok: false, error: "effort must be low · medium · high · xhigh · max" };
    patch.effort = r.effort;
  }
  if ("maxTokens" in r) {
    const n = Math.round(Number(r.maxTokens));
    if (!Number.isFinite(n) || n < LIMITS.maxTokens.min || n > LIMITS.maxTokens.max) return { ok: false, error: `maxTokens must be ${LIMITS.maxTokens.min}–${LIMITS.maxTokens.max}` };
    patch.maxTokens = n;
  }
  if ("enabled" in r) {
    if (typeof r.enabled !== "boolean") return { ok: false, error: "enabled must be a boolean" };
    patch.enabled = r.enabled;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "nothing to change" };
  return { ok: true, patch };
}

export type EngineLimitsPatch = Partial<Pick<EngineConfig, "monthlyBudgetUsd" | "monthlyTurnQuota" | "searchUsd">> & { prices?: Record<string, ModelPrice> };

export function validateLimitsPatch(raw: unknown): { ok: true; patch: EngineLimitsPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "patch must be an object" };
  const r = raw as Record<string, unknown>;
  const patch: EngineLimitsPatch = {};
  for (const k of ["monthlyBudgetUsd", "monthlyTurnQuota"] as const) {
    if (!(k in r)) continue;
    const n = Number(r[k]);
    if (!Number.isFinite(n) || n < LIMITS[k].min || n > LIMITS[k].max) return { ok: false, error: `${k} must be ${LIMITS[k].min}–${LIMITS[k].max}` };
    patch[k] = k === "monthlyTurnQuota" ? Math.round(n) : Math.round(n * 100) / 100;
  }
  if ("searchUsd" in r) {
    const n = Number(r.searchUsd);
    if (!Number.isFinite(n) || n < 0 || n > 1) return { ok: false, error: "searchUsd must be 0–1" };
    patch.searchUsd = n;
  }
  if ("prices" in r) {
    if (!r.prices || typeof r.prices !== "object") return { ok: false, error: "prices must be a map of model → rates" };
    const prices: Record<string, ModelPrice> = {};
    for (const [model, p] of Object.entries(r.prices as Record<string, unknown>)) {
      if (!isEngineModel(model)) return { ok: false, error: `unknown model ${model}` };
      const row = p as Record<string, unknown>;
      const rates = {} as ModelPrice;
      for (const f of ["input", "output", "cacheRead", "cacheWrite"] as const) {
        const n = Number(row?.[f]);
        if (!Number.isFinite(n) || n < 0 || n > 1000) return { ok: false, error: `${model}.${f} must be 0–1000 USD per million tokens` };
        rates[f] = n;
      }
      prices[model] = rates;
    }
    patch.prices = prices;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "nothing to change" };
  return { ok: true, patch };
}

// ---- the monthly limit ----

export type QuotaCheck = { over: false } | { over: true; reason: "budget" | "turns"; resetsOn: Date };

/** Whether this member has used this month's allowance. Admins are never limited — the caller decides that. */
export function quotaCheck(usage: ClaudeUsageMonth | null | undefined, cfg: Pick<EngineConfig, "monthlyBudgetUsd" | "monthlyTurnQuota">, now = Date.now()): QuotaCheck {
  if (!usage) return { over: false };
  if (cfg.monthlyBudgetUsd > 0 && usage.estimatedUsd >= cfg.monthlyBudgetUsd) return { over: true, reason: "budget", resetsOn: nextMonthStart(now) };
  if (cfg.monthlyTurnQuota > 0 && usage.turns >= cfg.monthlyTurnQuota) return { over: true, reason: "turns", resetsOn: nextMonthStart(now) };
  return { over: false };
}

/** The one line the member sees when a limit is reached — mute, no modal, nothing red (docs/UX_COACH.md §8). */
export function quotaLine(q: QuotaCheck): string | null {
  if (!q.over) return null;
  const day = q.resetsOn.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  return `You've used this month's coaching time. It resets on ${day}.`;
}

// ---- prompt overrides (config/engine/prompts/{key}) ----

export interface PromptOverride {
  systemPrompt: string;
  /** The default's version this override was written over — "Reset to default" offers the newer one. */
  baseVersion: number;
  updatedAt: number;
  updatedBy: string | null;
  note?: string;
}

export interface ResolvedPrompt { text: string; version: number; source: "default" | "override"; override: PromptOverride | null }

/** The prompt an agent runs with: the admin's override when there is one, else the repo default. */
export function resolvePrompt(defaultText: string, defaultVersion: number, override: PromptOverride | null | undefined): ResolvedPrompt {
  if (override?.systemPrompt?.trim()) return { text: override.systemPrompt, version: override.baseVersion, source: "override", override };
  return { text: defaultText, version: defaultVersion, source: "default", override: null };
}
