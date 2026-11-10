// What a Claude call costs, from its usage — the meter's arithmetic (docs/CAREER_OPS_CLAUDE.md §1,
// docs/UX_COACH.md §8). Pure — tested. Prices are USD per million tokens and live in config/engine
// so the admin can correct them when Anthropic's list changes; these are the defaults.

export interface TokenUsage {
  input: number;       // uncached input tokens
  output: number;
  cacheRead: number;   // input tokens served from the prompt cache
  cacheWrite: number;  // input tokens written to the cache (billed at a premium)
  searches: number;    // server-side web searches
}

export const EMPTY_USAGE: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 };

export interface ModelPrice { input: number; output: number; cacheRead: number; cacheWrite: number }

// Cache writes are billed at 1.25× input for the 5-minute TTL and 2× for the 1-hour TTL;
// the table carries the 5-minute rate and `cacheWriteFactor` in config scales it.
export const DEFAULT_PRICES: Record<string, ModelPrice> = {
  "claude-opus-5-5":   { input: 4,   output: 20,  cacheRead: 0.2,  cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2,   output: 10,  cacheRead: 0.1,  cacheWrite: 2.5 },
  "claude-haiku-5-5":  { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

/** USD per web search ($10 per 1,000). */
export const DEFAULT_SEARCH_USD = 0.01;

/** The price row for a model id; an unknown id is priced as Opus so an estimate never flatters. */
export function priceFor(model: string, prices: Record<string, ModelPrice> = DEFAULT_PRICES): ModelPrice {
  return prices[model] ?? prices["claude-opus-5-5"] ?? DEFAULT_PRICES["claude-opus-5-5"];
}

const M = 1_000_000;

export function estimateUsd(model: string, u: TokenUsage, prices: Record<string, ModelPrice> = DEFAULT_PRICES, searchUsd = DEFAULT_SEARCH_USD): number {
  const p = priceFor(model, prices);
  const usd = (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / M + u.searches * searchUsd;
  return Math.round(usd * 1e6) / 1e6;
}

export const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite, searches: a.searches + b.searches,
});

/** The SDK's usage object → our five counters. Nulls (fields a platform doesn't report) read as zero. */
export function normalizeUsage(raw: {
  input_tokens?: number | null; output_tokens?: number | null;
  cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
} | null | undefined): TokenUsage {
  return {
    input: raw?.input_tokens ?? 0,
    output: raw?.output_tokens ?? 0,
    cacheRead: raw?.cache_read_input_tokens ?? 0,
    cacheWrite: raw?.cache_creation_input_tokens ?? 0,
    searches: raw?.server_tool_use?.web_search_requests ?? 0,
  };
}

/** "$0.0831" · "$12.40" — four decimals under a dollar, two above. */
export const fmtUsd = (usd: number) => (usd < 1 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`);
