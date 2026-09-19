import { describe, it, expect } from "vitest";
import { validateAgentPatch, validatePrompt, validateQuota, estimateTokens, isAgentKey } from "@/lib/careerops/config-validate";

describe("agent settings validation", () => {
  it("accepts a sane patch and normalises numbers", () => {
    const r = validateAgentPatch({ model: " llama3.2:3b ", numCtx: "8192", temperature: 0.234, enabled: false });
    expect(r).toEqual({ ok: true, patch: { model: "llama3.2:3b", numCtx: 8192, temperature: 0.23, enabled: false } });
  });
  it("rejects bad tags, out-of-range values and empty patches", () => {
    expect(validateAgentPatch({ model: "rm -rf /" }).ok).toBe(false);
    expect(validateAgentPatch({ numCtx: 100 }).ok).toBe(false);
    expect(validateAgentPatch({ numPredict: 99999 }).ok).toBe(false);
    expect(validateAgentPatch({ temperature: 3 }).ok).toBe(false);
    expect(validateAgentPatch({ enabled: "yes" }).ok).toBe(false);
    expect(validateAgentPatch({}).ok).toBe(false);
    expect(validateAgentPatch(null).ok).toBe(false);
  });
  it("validates prompts and quotas", () => {
    expect(validatePrompt("too short").ok).toBe(false);
    expect(validatePrompt("x".repeat(30_000)).ok).toBe(false);
    const ok = validatePrompt("You are career-ops.\r\nEvaluate the JD against the CV and score it 1-5.\r\n");
    expect(ok.ok && ok.prompt.includes("\r")).toBe(false);
    expect(validateQuota(20)).toBe(20);
    expect(validateQuota(0)).toBeNull();
    expect(validateQuota("abc")).toBeNull();
  });
  it("estimates tokens and knows the agent keys", () => {
    expect(estimateTokens("a".repeat(360))).toBe(100);
    expect(isAgentKey("evaluator")).toBe(true);
    expect(isAgentKey("chef")).toBe(false);
  });
});
