import { describe, it, expect } from "vitest";
import { DEFAULT_PRICES, EMPTY_USAGE, addUsage, estimateUsd, fmtUsd, normalizeUsage, priceFor } from "@/lib/engine/pricing";

describe("the engine's price arithmetic", () => {
  it("prices a call per million tokens, plus searches", () => {
    const usd = estimateUsd("claude-opus-5-5", { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 });
    expect(usd).toBe(4);
    expect(estimateUsd("claude-opus-5-5", { ...EMPTY_USAGE, output: 500_000 })).toBe(10);
    expect(estimateUsd("claude-opus-5-5", { ...EMPTY_USAGE, cacheRead: 1_000_000 })).toBe(0.2);
    expect(estimateUsd("claude-opus-5-5", { ...EMPTY_USAGE, searches: 3 })).toBe(0.03);
  });

  it("a typical evaluation is a few cents", () => {
    // 3K uncached JD + 12K cached profile/system, 3K out
    const usd = estimateUsd("claude-opus-5-5", { input: 3000, output: 3000, cacheRead: 12_000, cacheWrite: 0, searches: 0 });
    expect(usd).toBeGreaterThan(0.05);
    expect(usd).toBeLessThan(0.1);
  });

  it("prices an unknown model as Opus so an estimate never flatters", () => {
    expect(priceFor("claude-something-new")).toEqual(DEFAULT_PRICES["claude-opus-5-5"]);
    expect(estimateUsd("claude-sonnet-5-5", { ...EMPTY_USAGE, input: 1_000_000 })).toBe(2);
  });

  it("takes the admin's price table over the defaults", () => {
    const prices = { ...DEFAULT_PRICES, "claude-opus-5-5": { input: 8, output: 40, cacheRead: 0.8, cacheWrite: 10 } };
    expect(estimateUsd("claude-opus-5-5", { ...EMPTY_USAGE, input: 1_000_000 }, prices)).toBe(8);
  });

  it("reads the SDK's usage object, nulls as zero", () => {
    expect(normalizeUsage({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: 2, server_tool_use: { web_search_requests: 1 } }))
      .toEqual({ input: 10, output: 5, cacheRead: 0, cacheWrite: 2, searches: 1 });
    expect(normalizeUsage(null)).toEqual(EMPTY_USAGE);
  });

  it("adds usage and formats dollars", () => {
    expect(addUsage({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4, searches: 5 }, { input: 1, output: 1, cacheRead: 1, cacheWrite: 1, searches: 1 })).toEqual({ input: 2, output: 3, cacheRead: 4, cacheWrite: 5, searches: 6 });
    expect(fmtUsd(0.08312)).toBe("$0.0831");
    expect(fmtUsd(12.4)).toBe("$12.40");
  });
});
