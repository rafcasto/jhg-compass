import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { Effort } from "./keys";
import { normalizeUsage, type TokenUsage } from "./pricing";

// One Claude client for the engine (docs/CAREER_OPS_CLAUDE.md §1) — the port of the
// worker's lib/claude.js: streamed, server-side refusal fallbacks on, effort per
// call, usage returned on every call; plus structured outputs and the cache
// breakpoints the worker never had. Needs ANTHROPIC_API_KEY on Vercel, nowhere else.

export const isClaudeConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
export function claudeClient(): Anthropic {
  if (!client) {
    // An organisation-level key in an org that requires a workspace must name it on every
    // request (anthropic-workspace-id); a workspace-scoped key needs nothing. Either works.
    const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
    client = new Anthropic({ timeout: 10 * 60 * 1000, maxRetries: 2, ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}) });
  }
  return client;
}

/** The beta that turns on server-side refusal fallbacks; `fallbacks: "default"` routes by category. */
export const FALLBACK_BETAS = ["server-side-fallback-2026-07-01"] as const;

export class ClaudeRefusal extends Error {
  constructor(public category: string | null, public explanation: string | null) {
    super(`Claude declined this request${category ? ` (${category})` : ""}${explanation ? `: ${explanation}` : ""}`);
    this.name = "ClaudeRefusal";
  }
}

export type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
export type BetaTextBlockParam = Anthropic.Beta.BetaTextBlockParam;
export type BetaToolUnion = Anthropic.Beta.BetaToolUnion;

/** A system block; `cache: "1h"` / `"5m"` puts a breakpoint after it. */
export interface SystemPart { text: string; cache?: "5m" | "1h" }

export const systemBlocks = (parts: readonly SystemPart[]): BetaTextBlockParam[] =>
  parts.filter((p) => p.text.trim()).map((p) => ({ type: "text", text: p.text, ...(p.cache ? { cache_control: { type: "ephemeral", ttl: p.cache } } : {}) }));

export interface CallInput {
  model: string;
  effort: Effort;
  maxTokens: number;
  system: string | readonly SystemPart[];
  messages: BetaMessageParam[];
  tools?: BetaToolUnion[];
  /** Server-side web search, capped per call. Omit for no search. */
  maxSearches?: number;
  /**
   * Cache the conversation too (top-level automatic caching): the API puts a breakpoint on the
   * last block and walks it forward each turn, so every prior turn — search results included —
   * is re-read at the cache-read rate instead of re-billed at the input price. For multi-turn
   * loops only: a single-shot call would pay the write and never read it.
   */
  cacheConversation?: "5m" | "1h";
  signal?: AbortSignal;
}

export interface Source { title: string; url: string }

export interface CallResult {
  text: string;
  message: Anthropic.Beta.BetaMessage;
  usage: TokenUsage;
  /** The model that answered — a fallback may differ from the one asked for. */
  model: string;
  stopReason: Anthropic.Beta.BetaStopReason | null;
  sources: Source[];
  durationMs: number;
}

function params(i: CallInput): Anthropic.Beta.MessageCreateParamsNonStreaming {
  const tools: BetaToolUnion[] = [...(i.tools ?? [])];
  if (i.maxSearches && i.maxSearches > 0) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: i.maxSearches });
  return {
    model: i.model,
    max_tokens: i.maxTokens,
    betas: [...FALLBACK_BETAS],
    fallbacks: "default",
    output_config: { effort: i.effort },
    system: typeof i.system === "string" ? i.system : systemBlocks(i.system),
    messages: i.messages,
    ...(tools.length ? { tools } : {}),
    ...(i.cacheConversation ? { cache_control: { type: "ephemeral", ttl: i.cacheConversation } } : {}),
  };
}

export function sourcesOf(content: readonly Anthropic.Beta.BetaContentBlock[]): Source[] {
  const out: Source[] = [];
  for (const b of content) {
    if (b.type !== "web_search_tool_result" || !Array.isArray(b.content)) continue; // an object here is a tool error, not results
    for (const r of b.content) if (r.type === "web_search_result" && r.url && !out.some((s) => s.url === r.url)) out.push({ title: r.title ?? "", url: r.url });
  }
  return out;
}

export const textOf = (content: readonly Anthropic.Beta.BetaContentBlock[]) => content.filter((b) => b.type === "text").map((b) => b.text).join("");

/** One streamed call, collected. Throws ClaudeRefusal when the whole fallback chain declined. */
export async function call(i: CallInput): Promise<CallResult> {
  const t0 = Date.now();
  const stream = claudeClient().beta.messages.stream(params(i), { signal: i.signal });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new ClaudeRefusal(message.stop_details?.category ?? null, message.stop_details?.explanation ?? null);
  return { text: textOf(message.content), message, usage: normalizeUsage(message.usage), model: message.model, stopReason: message.stop_reason, sources: sourcesOf(message.content), durationMs: Date.now() - t0 };
}

/** The raw stream, for a route that forwards deltas (the coach). The caller reads `finalMessage()` itself. */
export function stream(i: CallInput) {
  return claudeClient().beta.messages.stream(params(i), { signal: i.signal });
}

export interface JsonResult<T> { data: T; message: Anthropic.Beta.BetaMessage; usage: TokenUsage; model: string; durationMs: number }

/** One call whose answer must match `schema` — structured outputs, parsed and typed. */
export async function callJson<T>(i: CallInput & { schema: z.ZodType<T> }): Promise<JsonResult<T>> {
  const t0 = Date.now();
  const p = params(i);
  const message = await claudeClient().beta.messages.parse({ ...p, output_config: { ...p.output_config, format: betaZodOutputFormat(i.schema) } }, { signal: i.signal });
  if (message.stop_reason === "refusal") throw new ClaudeRefusal(message.stop_details?.category ?? null, message.stop_details?.explanation ?? null);
  if (message.parsed_output == null) throw new Error(`Claude's answer did not match the schema${message.stop_reason === "max_tokens" ? " — it hit max_tokens" : ""}`);
  return { data: message.parsed_output as T, message, usage: normalizeUsage(message.usage), model: message.model, durationMs: Date.now() - t0 };
}

/** One line for a job log. */
export const usageLine = (r: { model: string; usage: TokenUsage; durationMs: number }) =>
  `claude ${r.model}: ${r.usage.output} tokens out, ${r.usage.input} in (${r.usage.cacheRead} cached${r.usage.searches ? `, ${r.usage.searches} searches` : ""}) in ${Math.round(r.durationMs / 1000)}s`;
