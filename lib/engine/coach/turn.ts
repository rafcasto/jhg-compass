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
import { findJhPage, findJhSection, type JhPageKey, type JhSectionKey } from "../../jobhacking/sections";
import type { TranscriptTurn } from "./transcript";

export type TurnMessage = Anthropic.Beta.BetaMessageParam | Anthropic.Beta.BetaSystemMessageParam;

export interface TurnContext {
  page?: JhPageKey | null;
  section?: JhSectionKey | null;
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
    const line = `${t.role === "coach" ? "Coach" : "Member"}: ${t.text.trim()}${wrote.length ? `\n(wrote: ${wrote.join(", ")})` : ""}`;
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

/** What the member typed — or, when a conversation starts, the opening cue the member never sees. */
export const START_CUE = "Hi — I'm ready to start.";

/** The coach's prompt and, when it has one, its knowledge file — two cached blocks, stable across every turn and member. */
export const systemFor = (promptText: string, knowledge?: string): SystemPart[] => [
  { text: promptText, cache: knowledge ? undefined : "1h" },
  ...(knowledge ? [{ text: `# KNOWLEDGE FILE

${knowledge}`, cache: "1h" as const }] : []),
];

/** The first user turn carries the profile (and, after a restart, the recap); later turns are the member's words alone. */
export function userTurn(text: string, first: FirstTurnInput | null): Anthropic.Beta.BetaMessageParam {
  if (!first) return { role: "user", content: text };
  const header = [
    "The member's profile as it stands (profile.yml):",
    "```yaml",
    first.profileYaml.trim() || "version: 1",
    "```",
    `Account: ${first.account.name || "(no name yet)"} <${first.account.email}>`,
    ...(first.recap ? ["", "This conversation was restarted to fit. What was said so far, most recent turns, oldest first:", "```", first.recap, "```"] : []),
    "",
    text,
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
  return parts.length ? parts.join(" ") : null;
}

/** The messages for one turn: history, the member's words, the operator note last. */
export function buildMessages(history: TurnMessage[], text: string, first: FirstTurnInput | null, ctx: TurnContext | null | undefined): TurnMessage[] {
  const out: TurnMessage[] = [...history, userTurn(text, first)];
  const note = contextNote(ctx);
  if (note) out.push({ role: "system", content: note });
  return out;
}

/** The transcript a session keeps: the turn's messages plus what the model answered — without the operator note, which is per-turn. */
export function withoutOperatorNotes(messages: TurnMessage[]): TurnMessage[] {
  return messages.filter((m) => m.role !== "system");
}
