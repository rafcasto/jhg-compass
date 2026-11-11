import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { requireEngineMember } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { ClaudeRefusal, isClaudeConfigured, stream as claudeStream, textOf } from "@/lib/engine/claude";
import { getEngineConfig, getPromptOverride } from "@/lib/engine/config-server";
import { quotaCheck, quotaLine, resolvePrompt } from "@/lib/engine/config";
import { getUsageMonth, recordUsage } from "@/lib/engine/usage-server";
import { COACH_PROMPTS, coachPromptKey } from "@/lib/engine/coach/prompts";
import { findCoach, isCoachKey, missingBefore, coachStates } from "@/lib/engine/coach/keys";
import { UPDATE_PROFILE, updateProfileTool } from "@/lib/engine/coach/tools";
import { applyCoachPatch, CoachWriteError } from "@/lib/engine/coach/write";
import { getSession, messagesOf, saveSession, type CoachSession } from "@/lib/engine/coach/session";
import { START_CUE, buildMessages, systemFor, withoutOperatorNotes, type TurnContext, type TurnMessage } from "@/lib/engine/coach/turn";
import { STREAM_FRAME, applyEvent, emptyPending, type TranscriptTurn, type TurnEvent, type WriteNote } from "@/lib/engine/coach/transcript";
import { profileFromSetup, profileToYaml } from "@/lib/careerops/profile-file";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import { parseJhSection, type JhPageKey, type ProfilePortal } from "@/lib/jobhacking/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A turn is ≤ 250 words, but a save point writes whole lists in one tool call (Coach 3: forty
// companies) and the research coaches run several web searches — Pro's plain limit, no Fluid.
export const maxDuration = 300;

const MAX_TEXT = 8000;
const MAX_TOOL_ROUNDS = 6;

// Body: { coach: CoachKey, text?: string, start?: true, portal: "jobhacking" | "compass", context?: { page?, section? } }
// Streams SSE: text deltas as they are written, a `write` for each update_profile the coach
// made, then `done` with the finished turn (docs/UX_COACH.md §3–4). The member's words and
// the coach's turn land on users/{uid}/coachSessions/{coach}; the writes land on the profile.
export async function POST(req: NextRequest) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  if (!isClaudeConfigured()) return NextResponse.json({ ok: false, error: "The coach is not configured yet (ANTHROPIC_API_KEY)." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const coachKey: unknown = body?.coach;
  if (!isCoachKey(coachKey)) return NextResponse.json({ ok: false, error: "unknown coach" }, { status: 400 });
  const coach = findCoach(coachKey)!;
  const start = body?.start === true;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  if (!start && !text) return NextResponse.json({ ok: false, error: "say something" }, { status: 400 });
  const portal: ProfilePortal = body?.portal === "compass" ? "compass" : "jobhacking";
  const rawCtx = body?.context && typeof body.context === "object" ? body.context : {};
  const ctx: TurnContext = {
    page: typeof rawCtx.page === "string" ? (rawCtx.page as JhPageKey) : null,
    section: typeof rawCtx.section === "string" ? parseJhSection(rawCtx.section) : null,
  };
  const uid = m.user.uid;
  const isAdmin = m.user.admin === true;

  const prompt = COACH_PROMPTS[coach.key];
  const tool = updateProfileTool(coach.key);

  const db = adminDb();
  const [config, usage, session, profileSnap, setupSnap, override] = await Promise.all([
    getEngineConfig(), getUsageMonth(uid), getSession(uid, coach.key),
    db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/careerOps/setup`).get(), getPromptOverride(coachPromptKey(coach.key)),
  ]);
  if (!config.agents.coach.enabled) return NextResponse.json({ ok: false, error: "The coach is switched off by the admin." }, { status: 503 });
  if (!isAdmin) {
    const q = quotaCheck(usage, config);
    if (q.over) return NextResponse.json({ ok: false, error: quotaLine(q), quota: q.reason }, { status: 429 });
  }
  const profile = profileSnap.exists ? (profileSnap.data() as Profile) : null;
  const setup = setupSnap.exists ? (setupSnap.data() as CareerOpsSetupV2) : null;
  const missing = missingBefore(coach, coachStates(setup?.jhg?.progress));
  if (missing.length) return NextResponse.json({ ok: false, error: `${coach.label} starts after ${missing.map((c) => c.label).join(" and ")}.` }, { status: 409 });

  const history = messagesOf(session);
  const isFirst = history.length === 0;
  const first = isFirst
    ? { profileYaml: profileToYaml(profileFromSetup({ profile, setup })), account: { name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" "), email: profile?.email ?? m.user.email ?? "" } }
    : null;
  const resolved = resolvePrompt(prompt.text, prompt.version, override);
  const cfg = config.agents.coach;
  const memberText = start ? START_CUE : text;
  let messages: TurnMessage[] = buildMessages(history, memberText, first, ctx);
  const now = Date.now();

  const enc = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: TurnEvent) => controller.enqueue(enc.encode(STREAM_FRAME(e)));
      let pending = emptyPending();
      let usd = 0;
      let completed = false;
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const s = claudeStream({
            model: cfg.model, effort: cfg.effort, maxTokens: cfg.maxTokens,
            system: systemFor(resolved.text, prompt.knowledge),
            messages: messages as Anthropic.Beta.BetaMessageParam[],
            tools: [tool],
            maxSearches: coach.search,
          });
          let sawTextThisRound = false;
          for await (const ev of s) {
            if (ev.type === "content_block_start" && ev.content_block.type === "text" && pending.text && !sawTextThisRound) { pending = applyEvent(pending, { type: "text", text: "\n\n" }); send({ type: "text", text: "\n\n" }); }
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") { sawTextThisRound = true; pending = applyEvent(pending, { type: "text", text: ev.delta.text }); send({ type: "text", text: ev.delta.text }); }
          }
          const msg = await s.finalMessage();
          const { estimatedUsd } = await recordUsage(uid, { kind: "coach", key: coach.key, model: msg.model, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens, cacheRead: msg.usage.cache_read_input_tokens ?? 0, cacheWrite: msg.usage.cache_creation_input_tokens ?? 0, searches: msg.usage.server_tool_use?.web_search_requests ?? 0 } }, config);
          usd += estimatedUsd;
          if (msg.stop_reason === "refusal") throw new ClaudeRefusal(msg.stop_details?.category ?? null, msg.stop_details?.explanation ?? null);
          messages = [...messages, { role: "assistant", content: msg.content }];
          if (msg.stop_reason !== "tool_use") break;

          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const b of msg.content) {
            if (b.type !== "tool_use") continue;
            if (b.name !== UPDATE_PROFILE) { results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, error: `unknown tool ${b.name}` }), is_error: true }); continue; }
            const input = (b.input ?? {}) as { patch?: Record<string, unknown>; progress?: "in_progress" | "complete" };
            try {
              const r = await applyCoachPatch({ uid, coach: coach.key, patch: input.patch ?? {}, progress: input.progress, portal });
              if (r.note.progress === "complete") completed = true;
              pending = applyEvent(pending, { type: "write", note: r.note }); send({ type: "write", note: r.note });
              results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: true, updated: r.note.labels, profile: r.stored }) });
            } catch (e: unknown) {
              const err = e instanceof CoachWriteError ? { error: e.message, details: e.details } : { error: e instanceof Error ? e.message : "write failed" };
              results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, ...err }), is_error: true });
            }
          }
          messages = [...messages, { role: "user", content: results }];
        }

        const coachTurn: TranscriptTurn = { role: "coach", text: pending.text.trim() || textOf([]), at: Date.now(), ...(pending.writes.length ? { writes: pending.writes } : {}) };
        const turns: TranscriptTurn[] = [...session.turns, ...(start ? [] : [{ role: "member" as const, text: memberText, at: now }]), coachTurn];
        const next: CoachSession = {
          ...session,
          status: completed || session.status === "complete" ? "complete" : "in_progress",
          turns,
          messagesJson: JSON.stringify(withoutOperatorNotes(messages)),
          turnCount: session.turnCount + 1,
          startedAt: session.turnCount === 0 ? now : session.startedAt,
          lastTurnAt: Date.now(),
          openedOn: session.openedOn ?? ctx.page ?? null,
        };
        await saveSession(uid, coach.key, next);
        send({ type: "done", turn: coachTurn, usdThisTurn: usd });
      } catch (e: unknown) {
        const message = e instanceof ClaudeRefusal ? e.message : e instanceof Error ? e.message : "The coach couldn't answer — try again.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}

// Start over (docs/UX_COACH.md §7): the transcript goes, the profile stays.
export async function DELETE(req: NextRequest) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  const coachKey = req.nextUrl.searchParams.get("coach");
  if (!isCoachKey(coachKey)) return NextResponse.json({ ok: false, error: "unknown coach" }, { status: 400 });
  await adminDb().doc(`users/${m.user.uid}/coachSessions/${coachKey}`).delete();
  return NextResponse.json({ ok: true });
}

