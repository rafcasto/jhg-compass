# Coach prompt audit — 2026-11-12

Produced by the `claude-api` prompt-audit procedure (Anthropic's dated-pattern rubric) over the coach's prompt
surface, ahead of a possible move of `config/engine` → `agents.coach.model` from `claude-opus-5-5` to
`claude-sonnet-5-5`. Hunks #1–#4 were applied the same day (schema descriptions, warnings in the tool result, the
Narrative search line, the Sonnet search line; prompt versions 2 → 3); #5–#11 stand as proposals.

## Assumptions

- **Scope:** the six prompts in `lib/engine/coach/prompts/*.ts`, the two knowledge files, the `update_profile`
  tool (`lib/engine/coach/tools.ts`), and the request code (`lib/engine/claude.ts`, `app/api/coach/turn/route.ts`,
  `lib/engine/coach/turn.ts`, `lib/engine/coach/write.ts`). `CLAUDE.md` and the other agents' config are out of
  scope (they are for the coding agent, not the coach).
- **Target model:** Claude Sonnet 5.5 (the migration under consideration). The prompts were written 2026-11-10/11
  for Claude Opus 5.5, ported from the Gemini Gems (v7) — provenance is two days old and one hop from another
  provider's idioms.
- **Quality bar:** none measured. There is no eval for the coach. Every tradeoff below needs one; the free wins
  need at least a manual read of a few sessions after the change.

## Summary

Three findings matter most, and all three are about *accuracy*, not length:

1. **The tool schema is under-described and the prompt restates it.** 76 parameters of `update_profile` carry an
   empty description (`str("")` ×50, `list("")` ×10, `int("")` ×3, enums ×13); their meaning lives only in each
   prompt's *YOUR KEYS* table. The schema is the contract the model fills in — on Sonnet 5.5 especially, the
   description beside the parameter is what decides whether `careersUrlStatus` or `outlook` is filled correctly.
   Move the meaning into the schema and let the prompt's table shrink to the conversation.
2. **Validator warnings never reach the coach.** `validateProfileFile` *trims* over-cap strings and lists and
   records a warning (`profile-schema.ts:100–126`); `applyCoachPatch` throws only on errors and drops the warnings.
   A 260-character headline is silently stored as 220 and the coach confirms the original to the member. The
   prompts then ask the model to *re-check* those same caps by hand at hand-over (N1–N6, T1–T7, C1–C7, S1–S4,
   M1–M4, L1–L4). Return the warnings in the tool result and let code own the mechanical checks.
3. **Sonnet 5.5 needs to be told to search.** Anthropic's migration notes for Sonnet 5.5: on chat and knowledge
   work it "sometimes answers from its own knowledge … and can hold off on tools until asked directly". Coaches 2
   and 3 are built on live search; the Narrative prompt even hedges with "if you have web search". Add the
   documented line.

Counts: Group 1 (dated prompt text) 5 · Group 2 (config files) not applicable · Group 3 (tool descriptions) 2 ·
Group 4 (request code) 3.

## Findings

Ordered by confidence.

| # | Location | Evidence | Pattern | Why | Confidence | Action |
|---|---|---|---|---|---|---|
| 1 | `tools.ts` (76 sites, e.g. the `RANKED` row: `industry: str("")`, `subSector: str("")`, `companyType: en([…], "")`) | empty `description` | Group 3 — parameters without descriptions | The schema is what the model reads when it fills the call; the meaning is in the prompt table a few thousand tokens away. Under-description is the most common tool failure. | High | **add** — one sentence per parameter, copied from the prompt's rule (e.g. `careersUrl: "The page that LISTS the company's jobs — its ATS board where one exists. Opened by the coach; left out when status is none"`) |
| 2 | `write.ts:66–67` + `route.ts` tool result | `if (!schema.ok) throw …` — `schema.warnings` unused | Group 4 — contract/behaviour mismatch; Group 1d unenforced instruction | The tool description promises "the result shows what is stored now", but a trimmed value is stored and the warning is dropped; the coach confirms text the page does not hold. | High | **add** — return `warnings` in `toolResultOf` (`{ ok, updated, warnings: […] }`); the prompt's "if it reports an error, fix it with the member" then covers trims too |
| 3 | `narrative.ts` §2 | "If you have web search, use it on live postings to check the wording, never to invent a skill; without it, use the market's language you know and say so." | Group 1d — conditional on a configuration that no longer varies (`COACHES[].search` is always > 0); Sonnet 5.5 tool-use shift | The conditional reads as permission not to search. Sonnet 5.5 holds off on tools unless told when to use them. | High | **rewrite** — "Use web search to check the wording against live postings before you show the competencies — never to invent a skill." |
| 4 | `true-north.ts`, `target-companies.ts` — *WHERE YOU ARE* | "You have web search: use it to read live postings and growth sources." | Group 1d / keep-list 11 — re-baselining adds text for Sonnet 5.5 | Documented behavioural shift: add the search line where connected sources must win. | High | **add** (after that sentence) — "Use the search tool to check specifics that may have changed since your training — what is posted, what a company announced, what a sector's growth number is — even when you feel confident. For researched work such as the 40 or the industry list, gather current sources rather than writing from your training knowledge." |
| 5 | all six — *NON-NEGOTIABLES* | "Turns under 250 words, except tables." | Group 1f — numeric output ceiling | Written against models that padded; current models match a qualitative brief, and a number tuned on Opus does not transfer to Sonnet's register. | Medium | **rewrite** — "Keep each turn to what the next step needs: one question, or one draft or table for review." |
| 6 | all six — *YOUR KEYS* tables | e.g. `narrative.ts`: "narrative.headline … ≤ 220 characters, no final full stop" and `tools.ts:45` the same sentence | Group 1b/3 — tool recap in the system prompt | Two statements of one rule drift (they already differ in wording for `superpowers`); once #1 lands, the table is a second copy. Prefix is cached, so this is accuracy, not cost. | Medium | **rewrite** — keep each table row to the key and what it means in the conversation; limits and enums stay in the schema only |
| 7 | `target-companies.ts` Part B, hand-over C1 | "you only explain and add up … totals and the ranking (ties: Interest, then Proof)"; "every score 1–5 and total their sum, ranks follow totals" | Group 1b — arithmetic rubrics the model must compute | Forty 4-number sums and a tie-broken sort by hand, then re-checked by hand. Code is exact; the model is not. | Medium | **replace-with-code** — the server computes `total` and `rank` on write (ignoring what the model sent), returns the ranked list in the tool result; the prompt says "the portal totals and ranks". Same for C2/C4 URL and status checks, S3/L1 length checks. |
| 8 | `target-companies.ts` — *OPENING* | identical to True North's opening ("Clear definition of your Professional Target … rather than just chasing titles or a paycheck") | Group 2-style stale copy | Coach 3 prints Coach 2's definition on the Target companies page. The Gem source is not in this repo, so this cannot be confirmed as a port error. | Medium | **flag** — confirm against the Gem; if a port error, write Coach 3's own line ("Your Addressable Market of Employers: 40 sourced companies, scored, with a Top 10 that career-ops watches and a Top 3 with a first move this week.") |
| 9 | `route.ts` — model switch | `config/engine` can change `agents.coach.model` at any time | Group 4 — mid-conversation model switch | Sessions in flight on Opus carry Opus thinking blocks; Sonnet drops them silently (`model_binding_mismatch`) and the cache restarts once. Not an error, but the first Sonnet turn of each old session runs without the earlier reasoning. | Medium | **flag** — switch between cohorts, or accept the one-time drop; the restart (`MAX_TRANSCRIPT_BYTES`) already gives a clean boundary |
| 10 | `config.ts:33` | `coach: { effort: "low" }` | Group 4 — effort on a new model | Sonnet 5.5's levels are recalibrated; `low` is the documented starting point for chat, so this carries over — but it is set, not swept. | Low | **flag** — sweep `low` vs `medium` on a few sessions once an eval exists |
| 11 | all six — "print exactly this", "print the CLOSE line" | Gem vocabulary | Group 1d idiom-dating | "Print" is harmless; the model reads it as "say". | Low | **flag** — no edit |

**Kept deliberately (not findings):** the *NON-NEGOTIABLES* — each carries its reason or a business rule (fabricated
links, claims from the web, writing another coach's keys, the one citable statistic); the Part A/B/C structure — order
is the product; the opening and close lines — format-pinned product copy; the brand lines ("panic with Wi-Fi"); "one
question at a time" and "do not announce the tool" — product design with reasons; the knowledge files — reference data
the model cannot get elsewhere.

**Not applicable:** Group 2 (no agent configuration files in scope). Request code is otherwise clean for Sonnet 5.5:
no `thinking` config, no prefill, no forced `tool_choice`, `fallbacks: "default"`, `effort` set explicitly, messages
append-only with the one valid compaction shape, the operator note placed after the member's text (not after a tool
result), token accounting present.

## Proposed diff (one hunk per finding; take them selectively)

**#1 — schema descriptions** (`lib/engine/coach/tools.ts`). Every `str("")` / `list("")` / `int("")` / `en(…, "")`
gets the sentence its prompt table carries. Illustrative hunk, the `RANKED` row:

```ts
const RANKED = obj({
  rank: int("1–40, by total; ties: interest, then proof"),
  name: str("As the company writes it"),
  industry: str("The industry it sells into, as named in the member's True North"),
  subSector: str("Its sub-sector — a True North sub-sector, or one from extraSubSectors with its own sourced number"),
  companyType: en(["startup", "scaleup", "established", "public_sector"], "One of the four; public_sector for government and its agencies"),
  careersUrl: str("The page that LISTS its jobs — its ATS board where one exists. Opened by the coach; left out when status is none"),
  careersUrlStatus: en(["opened_by_coach", "confirmed", "corrected", "none"], "opened_by_coach until the member opens it (Top 10: confirmed, corrected or none)"),
  scores: SCORES,
}, "One ranked company");
```

**#2 — warnings in the tool result** (`lib/engine/coach/write.ts`, `lib/engine/coach/turn.ts`):

```ts
// write.ts — keep the warnings
return { note, stored: profileToYaml(stripToCoach(merged, shaped)), warnings: schema.warnings };
// turn.ts — show them
export function toolResultOf(labels: string[], stored: string, warnings: string[] = []) {
  const w = warnings.length ? { warnings } : {};
  if (stored.length <= MAX_ECHO_CHARS) return { ok: true, updated: labels, profile: stored, ...w };
  …
}
```

**#3 — Narrative §2** (`narrative.ts`): replace the "If you have web search … say so." sentence with
"Use web search to check the wording against live postings before you show the competencies — never to invent a skill."

**#4 — True North and Target companies, WHERE YOU ARE:** append after "You have web search: …":
"Use the search tool to check specifics that may have changed since your training — what is posted, what a company
announced, what a sector's growth number is — even when you feel confident. For researched work such as the 40 or the
industry list, gather current sources rather than writing from your training knowledge."

**#5 — all six, NON-NEGOTIABLES:** "Turns under 250 words, except tables." → "Keep each turn to what the next step
needs: one question, or one draft or table for review."

**#6 — YOUR KEYS tables:** after #1 lands, shorten each row to key + meaning; drop the limits and enum lists from the
prompt (they are in the schema). Do this per coach after #1, not before.

**#7 — totals and ranks in code** (`write.ts`, before `validateProfileFile`): for `jhg.targetCompanies.companies`,
set `scores.total = growth + interest + access + proof`, sort by total desc, interest desc, proof desc, assign
`rank` 1…n; echo "ranked by the portal" in the result. Then in `target-companies.ts` Part B: "you explain; the portal
totals and ranks" and drop the arithmetic from C1.

**#8, #9, #10, #11:** no edit proposed (flagged above).

## What this does and does not do for the Sonnet question

Sonnet 5.5 at `low` is the documented starting point for a chat workload and halves every rate that is left after
the caching change. The findings above make the *contract* exact — the schema says what each field is, code does the
arithmetic and the cap checks, the model is told when to search — which is what makes a cheaper model accurate: it has
less to infer and nothing to compute. None of it is measured. Before switching the model for everyone, run two or
three real sessions per coach on Sonnet with these edits and read them; the meter (`claudeUsage`) gives the cost side
per coach.
