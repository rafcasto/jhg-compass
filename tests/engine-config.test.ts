import { describe, it, expect } from "vitest";
import { DEFAULT_ENGINE_CONFIG, mergeEngineConfig, resolvePrompt, validateAgentPatch, validateLimitsPatch } from "@/lib/engine/config";
import { DEFAULT_PRICES } from "@/lib/engine/pricing";
import { ENGINE_AGENTS } from "@/lib/engine/keys";

describe("config/engine", () => {
  it("defaults every agent to Opus 5.5 at its own effort, limits off", () => {
    for (const k of ENGINE_AGENTS) expect(DEFAULT_ENGINE_CONFIG.agents[k].model).toBe("claude-opus-5-5");
    expect(DEFAULT_ENGINE_CONFIG.agents.coach.effort).toBe("low");
    expect(DEFAULT_ENGINE_CONFIG.agents.evaluator.effort).toBe("high");
    expect(DEFAULT_ENGINE_CONFIG.monthlyBudgetUsd).toBe(0);
    expect(DEFAULT_ENGINE_CONFIG.monthlyTurnQuota).toBe(0);
  });

  it("reads what is stored over the defaults — a missing agent or price falls back", () => {
    const c = mergeEngineConfig({ agents: { coach: { model: "claude-sonnet-5-5" } } as never, monthlyBudgetUsd: 25, prices: { "claude-opus-5-5": { input: 8, output: 40, cacheRead: 0.8, cacheWrite: 10 } } });
    expect(c.agents.coach).toEqual({ model: "claude-sonnet-5-5", effort: "low", maxTokens: 32000, enabled: true });
    expect(c.agents.evaluator).toEqual(DEFAULT_ENGINE_CONFIG.agents.evaluator);
    expect(c.monthlyBudgetUsd).toBe(25);
    expect(c.prices["claude-opus-5-5"].input).toBe(8);
    expect(c.prices["claude-sonnet-5-5"]).toEqual(DEFAULT_PRICES["claude-sonnet-5-5"]);
    expect(mergeEngineConfig(null)).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it("validates an agent patch", () => {
    expect(validateAgentPatch({ model: "claude-sonnet-5-5", effort: "medium", maxTokens: 8000, enabled: false })).toEqual({ ok: true, patch: { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 8000, enabled: false } });
    expect(validateAgentPatch({ model: "gpt-5" })).toMatchObject({ ok: false });
    expect(validateAgentPatch({ effort: "extreme" })).toMatchObject({ ok: false });
    expect(validateAgentPatch({ maxTokens: 10 })).toMatchObject({ ok: false });
    expect(validateAgentPatch({ enabled: "yes" })).toMatchObject({ ok: false });
    expect(validateAgentPatch({})).toMatchObject({ ok: false, error: "nothing to change" });
    expect(validateAgentPatch("x")).toMatchObject({ ok: false });
  });

  it("validates the limits and the price table", () => {
    expect(validateLimitsPatch({ monthlyBudgetUsd: 12.345, monthlyTurnQuota: 100.6 })).toEqual({ ok: true, patch: { monthlyBudgetUsd: 12.35, monthlyTurnQuota: 101 } });
    expect(validateLimitsPatch({ monthlyBudgetUsd: -1 })).toMatchObject({ ok: false });
    expect(validateLimitsPatch({ prices: { "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 } }, searchUsd: 0.01 })).toMatchObject({ ok: true, patch: { searchUsd: 0.01 } });
    expect(validateLimitsPatch({ prices: { "llama": { input: 1, output: 1, cacheRead: 1, cacheWrite: 1 } } })).toMatchObject({ ok: false });
    expect(validateLimitsPatch({ prices: { "claude-opus-5-5": { input: "x" } } })).toMatchObject({ ok: false });
  });

  it("runs the admin's override when there is one, else the repo default", () => {
    expect(resolvePrompt("default text", 3, null)).toEqual({ text: "default text", version: 3, source: "default", override: null });
    const o = { systemPrompt: "edited", baseVersion: 2, updatedAt: 1, updatedBy: "admin" };
    expect(resolvePrompt("default text", 3, o)).toMatchObject({ text: "edited", version: 2, source: "override" });
    expect(resolvePrompt("default text", 3, { ...o, systemPrompt: "  " })).toMatchObject({ source: "default" });
  });
});
