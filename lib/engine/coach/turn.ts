// One coach turn, as a request (docs/UX_COACH.md §4, §6). Pure — the route calls Claude.
//
//   system    the coach's prompt, cached for an hour (stable across every turn and member)
//   messages  [ first turn: the profile as it stands + the account, then the member's words ]
//             … the history, appended whole and never edited (cache + preserved thinking) …
//             the member's new words
//             a system message last, when there is something to say: the page the member is
//             looking at, and whether they are listening (voice) — cache-safe, never edited in.

import type Anthropic from "@anthropic-ai/sdk";
import type { SystemPart } from "../claude";
import { findJhPage, findJhSection, type JhPageKey, type JhSectionKey } from "../../jobhacking/sections";

export type TurnMessage = Anthropic.Beta.BetaMessageParam | Anthropic.Beta.BetaSystemMessageParam;

export interface TurnContext {
  page?: JhPageKey | null;
  section?: JhSectionKey | null;
  /** The member is listening rather than reading (docs/UX_COACH.md §4). */
  voice?: boolean;
}

export interface FirstTurnInput {
  profileYaml: string;
  account: { name: string; email: string };
}

/** What the member typed — or, when a conversation starts, the opening cue the member never sees. */
export const START_CUE = "Hi — I'm ready to start.";

export const systemFor = (promptText: string): SystemPart[] => [{ text: promptText, cache: "1h" }];

/** The first user turn carries the profile; later turns are the member's words alone. */
export function userTurn(text: string, first: FirstTurnInput | null): Anthropic.Beta.BetaMessageParam {
  if (!first) return { role: "user", content: text };
  const header = [
    "The member's profile as it stands (profile.yml):",
    "```yaml",
    first.profileYaml.trim() || "version: 1",
    "```",
    `Account: ${first.account.name || "(no name yet)"} <${first.account.email}>`,
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
  if (ctx.voice) parts.push("Voice: the member is listening, not reading. Keep this turn under 60 words, one question, no tables — say a table's lines in a sentence; read back every number, name and URL before you write it.");
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
