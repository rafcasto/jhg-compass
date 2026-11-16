// One coach turn, as a request (docs/UX_COACH.md §4, §6). Pure — the route calls Claude.
//
//   system    the coach's prompt, cached for an hour (stable across every turn and member)
//   messages  [ first turn: the profile as it stands + the account, then the member's words ]
//             … the history, appended whole and never edited (cache + preserved thinking) …
//             the member's new words
//             a system message last, when there is something to say: the page and section the
//             member is looking at — cache-safe, never edited in.

import type Anthropic from "@anthropic-ai/sdk";
import type { SystemPart } from "../claude";
import { isTextCvFile } from "../../careerops/intake";
import { findJhPage, findJhSection, type JhPageKey, type JhSectionKey } from "../../jobhacking/sections";
import type { TranscriptTurn } from "./transcript";

/**
 * A document the member hands the coach with a turn (docs/UX_COACH_AGENTIC.md §3): their CV as Markdown or
 * plain text today — the one document they already own. Not the retired six-file upload: nothing is written
 * from it without a yes. A PDF arrives later through the SDK's document block.
 */
export interface CoachDocument { name: string; text: string }
/** Enough for any CV several times over; a transcript carries it for the rest of the conversation. */
export const MAX_DOCUMENT_CHARS = 60_000;
export const isCoachDocumentName = (name: string): boolean => isTextCvFile(name);

/** The document as the model reads it — before the member's words on the turn it arrived with. */
export function documentBlock(doc: CoachDocument): string {
  return [`The member's document (${doc.name}) — their own CV; draft from it and confirm, never write from it without a yes:`, "```", doc.text.trim(), "```"].join("\n");
}

export type TurnMessage = Anthropic.Beta.BetaMessageParam | Anthropic.Beta.BetaSystemMessageParam;

export interface TurnContext {
  page?: JhPageKey | null;
  section?: JhSectionKey | null;
  /** Research jobs that finished since the coach's last turn — each a label and the table the handler wrote (docs/COACH_ASSESSMENT_2026-11-16.md §1.2). */
  landed?: readonly { label: string; summary: string }[];
  /** Research jobs that failed since the last turn — label and the error, so the coach can say so and decide. */
  failed?: readonly { label: string; error: string }[];
}

export interface FirstTurnInput {
  profileYaml: string;
  account: { name: string; email: string };
  /** When the transcript restarted (docs/UX_COACH.md §7): the most recent readable turns, oldest first. */
  recap?: string | null;
}

// The stored transcript's budget. A Firestore document holds 1 MiB and `messagesJson` shares it
// with `turns`; the research coaches' search results run to hundreds of KB a turn. Editing older
// turns to make room would invalidate every later thinking block (preserved thinking), so when
// the transcript outgrows this it is dropped whole and the next turn starts over from the profile
// plus a recap of the readable transcript — the simple compaction shape.
export const MAX_TRANSCRIPT_BYTES = 256 * 1024;
/** How much of the readable transcript a restart carries forward (the most recent turns). */
export const MAX_RECAP_BYTES = 48 * 1024;

export const byteLength = (s: string): number => new TextEncoder().encode(s).length;

/** Whether a serialised transcript may be stored and replayed as it is. */
export const transcriptFits = (json: string): boolean => byteLength(json) <= MAX_TRANSCRIPT_BYTES;

/** The readable transcript as a recap for a restarted conversation — the most recent turns that fit, oldest first; null when there are none. */
export function recapOf(turns: readonly TranscriptTurn[], maxBytes = MAX_RECAP_BYTES): string | null {
  const lines: string[] = [];
  let used = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    const wrote = t.writes?.flatMap((w) => w.labels) ?? [];
    const line = `${t.role === "coach" ? "Coach" : "Member"}: ${t.text.trim()}${t.attachment ? ` (attached ${t.attachment})` : ""}${wrote.length ? `\n(wrote: ${wrote.join(", ")})` : ""}`;
    const n = byteLength(line) + 2;
    if (used + n > maxBytes) {
      if (!lines.length) lines.push(line.slice(0, maxBytes)); // one turn alone past the budget: keep its head
      lines.push("[earlier turns omitted]");
      break;
    }
    lines.push(line);
    used += n;
  }
  return lines.length ? lines.reverse().join("\n\n") : null;
}

/** The stored keys are echoed back only while short: a forty-company list echoed after every save would sit in the transcript for the rest of the conversation. */
export const MAX_ECHO_CHARS = 2000;

export interface ToolResultExtras {
  /** The hand-over checks that failed, computed by code (docs/COACH_ASSESSMENT_2026-11-16.md §1.3). Present at a save point or a hand-over. */
  failedChecks?: readonly { id: string; label: string; fix?: string }[];
  /** The progress the portal stored — "in_progress" when a hand-over was asked for but a check failed. */
  progress?: "in_progress" | "complete";
  /** One sentence: whether CareerOps can run from the profile as it stands. */
  readiness?: string;
}

/**
 * What `update_profile` answers: the labels written; the validator's warnings when it changed something
 * on the way in (a headline trimmed to its cap, a list cut) — so the coach confirms what the page holds,
 * not what it sent; the checks that failed, with what to fix, when progress was asked for; the readiness
 * line on a hand-over; and, when it is small enough to be worth the tokens, the stored YAML, otherwise
 * the section names.
 */
export function toolResultOf(labels: string[], stored: string, warnings: readonly string[] = [], extras: ToolResultExtras = {}): Record<string, unknown> {
  const w = warnings.length ? { warnings: [...warnings] } : {};
  const x: Record<string, unknown> = {};
  if (extras.progress) x.progress = extras.progress;
  if (extras.failedChecks?.length) {
    x.checks = { failed: extras.failedChecks.map((c) => ({ id: c.id, check: c.label, fix: c.fix })), note: extras.progress === "in_progress" ? "Not marked complete: fix these with the member, then call update_profile with progress \"complete\" again." : "Fix these with the member before the hand-over." };
  } else if (extras.progress === "complete") x.checks = "all passed";
  if (extras.readiness) x.readiness = extras.readiness;
  if (stored.length <= MAX_ECHO_CHARS) return { ok: true, updated: labels, ...w, ...x, profile: stored };
  const sections = stored.split("\n").filter((l) => /^[A-Za-z]/.test(l) && !l.startsWith("version")).map((l) => l.replace(/:.*$/, ""));
  return { ok: true, updated: labels, ...w, ...x, stored: `${sections.join(", ")} — written as sent (${stored.length} chars, not echoed)` };
}

/** What the member typed — or, when a conversation starts, the opening cue the member never sees. */
export const START_CUE = "Hi — I'm ready to start.";
/** The cue when the conversation starts from a CV the member handed over (docs/UX_COACH_AGENTIC.md §3). */
export const START_WITH_CV_CUE = "Hi — here is my CV. Draft what you can from it and I'll confirm each one.";

/** The coach's prompt and, when it has one, its knowledge file — two cached blocks, stable across every turn and member. */
export const systemFor = (promptText: string, knowledge?: string): SystemPart[] => [
  { text: promptText, cache: knowledge ? undefined : "1h" },
  ...(knowledge ? [{ text: `# KNOWLEDGE FILE

${knowledge}`, cache: "1h" as const }] : []),
];

/** The first user turn carries the profile (and, after a restart, the recap); later turns are the member's words alone — plus the document, on the turn it arrived with. */
export function userTurn(text: string, first: FirstTurnInput | null, document: CoachDocument | null = null): Anthropic.Beta.BetaMessageParam {
  const body = document ? `${documentBlock(document)}\n\n${text}` : text;
  if (!first) return { role: "user", content: body };
  const header = [
    "The member's profile as it stands (profile.yml):",
    "```yaml",
    first.profileYaml.trim() || "version: 1",
    "```",
    `Account: ${first.account.name || "(no name yet)"} <${first.account.email}>`,
    ...(first.recap ? ["", "This conversation was restarted to fit. What was said so far, most recent turns, oldest first:", "```", first.recap, "```"] : []),
    "",
    body,
  ].join("\n");
  return { role: "user", content: header };
}

/** The operator note for this turn — null when there is nothing to say. */
export function contextNote(ctx: TurnContext | null | undefined): string | null {
  if (!ctx) return null;
  const parts: string[] = [];
  if (ctx.page) {
    const page = findJhPage(ctx.page);
    const section = ctx.section ? findJhSection(ctx.section) : undefined;
    if (page) parts.push(`The member is looking at ${page.label}${section ? ` · ${section.label}` : ""}.`);
  }
  for (const j of ctx.landed ?? []) parts.push(`Research landed since your last turn — ${j.label}. It is already on the member's page; review it with them, do not write it again:\n${j.summary}`);
  for (const j of ctx.failed ?? []) parts.push(`Research failed since your last turn — ${j.label}: ${j.error}. Tell the member in one line and either start it again or carry on by hand.`);
  return parts.length ? parts.join("\n\n") : null;
}

/** The jobs to tell the coach about: finished after its last turn, with a summary (done) or an error (failed). */
export function landedSince<T extends { type: string; status: string; endedAt?: number; result?: unknown; error?: string }>(jobs: readonly T[], lastTurnAt: number, labelOf: (type: string) => string): Pick<TurnContext, "landed" | "failed"> {
  const since = jobs.filter((j) => (j.endedAt ?? 0) > lastTurnAt);
  const landed = since.filter((j) => j.status === "done" && j.result && typeof (j.result as { summary?: unknown }).summary === "string").map((j) => ({ label: labelOf(j.type), summary: (j.result as { summary: string }).summary }));
  const failed = since.filter((j) => j.status === "failed").map((j) => ({ label: labelOf(j.type), error: j.error ?? "no reason recorded" }));
  return { ...(landed.length ? { landed } : {}), ...(failed.length ? { failed } : {}) };
}

/** The messages for one turn: history, the member's words (with their document when one came), the operator note last. */
export function buildMessages(history: TurnMessage[], text: string, first: FirstTurnInput | null, ctx: TurnContext | null | undefined, document: CoachDocument | null = null): TurnMessage[] {
  const out: TurnMessage[] = [...history, userTurn(text, first, document)];
  const note = contextNote(ctx);
  if (note) out.push({ role: "system", content: note });
  return out;
}

/** The transcript a session keeps: the turn's messages plus what the model answered — without the operator note, which is per-turn. */
export function withoutOperatorNotes(messages: TurnMessage[]): TurnMessage[] {
  return messages.filter((m) => m.role !== "system");
}
