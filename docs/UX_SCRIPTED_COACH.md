# The scripted coach — the journey re-mapped and the panel designed

**Date:** 2026-11-25. **Status:** design of record (decision C, `docs/DECISION_PROFILE_INTERFACE_2026-11-25.md`). **Built the same day,
first PR (`feat/scripted-coach`):** the engine (`lib/engine/coach/script/`), `StepSlot` and `StepTranscript`, `POST /api/coach/step`, and Coach 2's
script through Part A and the deterministic half of Part B; the panel hands over to the conversation for the clusters and Part C until their jobs exist. Companion to `docs/UX_JOURNEY_SCRIPTED_COACH.md`
(which hand owns each step: member · code · agent). This note does two things: re-runs the journey map of
`docs/UX_JOURNEY_JOBHACKING.md` with the predefined-question coach in place of the model conversation, and designs the panel
that carries it — Refactoring UI applied, scored, through the existing system (`docs/UX_AUDIT_COMPASS_TABS.md §0`,
`docs/UX_COACH_AGENTIC.md`).

**The thing to get right in one sentence.** A script shown one bubble at a time is a fifteen-question form in a chat costume —
slower than the form *and* flatter than the conversation. The design below avoids both failure modes with one move: **the
composer slot becomes the step**, and the transcript above it becomes the record of decisions.

---

## 1. What changes in the journey — stage by stage

Same persona (Ana), same eight stages, same pages. The **Emotion** and **Pain** rows are re-read for a coach that asks
predefined questions, runs jobs and drafts once; a ✦ marks where the script is *better* than the conversation, a ✕ where it is
worse, and what the design does about it.

| Stage | With the model (today) | With the script | Verdict |
|---|---|---|---|
| **0 · First sign-in** | 😊 one door — if `features.coach`; the first turn costs tokens and 3–6 s | ✦ The first step opens **instantly** (no model call) and costs nothing, so the coach can be *everyone's* onboarding — pain #1 of the journey map dissolves: there is no no-coach path to design for | better |
| **1 · Narrative** | 😊 fast first win; CV-first table | ✦ Same CV-first; contact details in two grouped steps instead of a few turns. ✕ The skill-list "that's a trait" push-back becomes a word-list flag — adequate. ✦ The headline arrives as three variants with a **live 220 counter**, something a chat bubble could never show | even / better |
| **2 · True North** | 😤→😊 the long one; fifteen boundary questions one at a time; the first job wait | ✦ Boundaries as **five grouped steps** (pay · work rights · place · culture · never) ≈ 8 min, not 15. ✦ *Back* exists. ✦ Keepers and titles are checkboxes over data code found — zero improvisation, the search-defect class (#3) cannot occur here. ✕ The clusters draft is the one place the member sees "the model's idea" of their career — must be editable in place, not accept/reject | better |
| **3 · Target companies** | 😰→😊 already page-first; the matrix | = Already the most scripted coach. ✦ Flags become follow-up steps with two buttons instead of a paragraph to argue with. ✦ Careers-page status is a ten-row form (the §10 "same shell later") | even / better |
| **4 · Story Bank** | 😐 hard thinking; the skeptic's "tell me more" | ✕ **The one real loss.** The four interview questions per story are fine; what no rule replaces is the coach hearing a weak result and digging. Mitigation: the STAR+R draft job is told to end every result in a figure from `numbers[]`, and a story whose result has no figure gets a scripted *What changed, in a number?* step before the draft runs. ✦ Status per figure is a radio, not a negotiation | worse, mitigated |
| **5 · Master CV** | 😊 the payoff | ✦ Section by section is *already* a script; the draft per role with figures pasted from the stories makes M1 code. ✦ The quality check is a list of lines with *Fix ›* — visible, not spoken | better |
| **6 · LinkedIn** | 😊 quick | = Derivation + two drafts. The page's per-block Copy and counter were always the product here | even |
| **7 · Share** | — | unchanged | — |
| **8 · After the six** | 😊→😤 then what | = 6 of 6 opens Job Search by code (decided 2026-11-25). ✦ A returning member sees *where they stopped* as a step, not as the tail of a long transcript | better |

**New pain points the script introduces** (and the design's answer, §3–§5):

| # | Pain | Where | Answer |
|---|---|---|---|
| S1 | **Wizard fatigue** — forty-odd steps across a coach, each a bubble and a tap | all | group fields into one step by *decision*, not by question (≤ 4 fields, one screen on a phone); a mono `3 / 9` under the Part line |
| S2 | **"I can't talk to it"** — a chat that will not take a sentence | all | the composer is not a textarea; the step's input *is* the composer, so there is nothing to type into by mistake; optional *Ask your coach ›* link (§6) |
| S3 | **Form in a bubble** — inputs inside a coach turn read as a third box kind | all | the live step lives in the footer slot, never inside the transcript; what lands in the transcript is the *answer* as the member's block |
| S4 | **The draft wait** — 5–15 s of nothing between *Continue* and three headlines | 1 · 2 · 4 · 5 · 6 | the `JobStatus` line (*● Drafting your headline*) in the step slot; same grammar as a research job |
| S5 | **Accept / reject fatigue on drafts** | 4 · 5 · 6 | drafts are **editable in place** before the write — never a binary; *Try again* capped and counted |
| S6 | **Flat voice** — a survey where a coach was | all | the prompts' own lines (*Before we aim, we set the fence*) become the part's one mute aside — said once per part, not per step |
| S7 | **Lost back-path** — a form you can't go back in | all | *‹ Back* on every step; an earlier answer in the transcript has *Change ›* that reopens its step |
| S8 | **The review table duplicates the page** | save points | the review step *points at the page* (rows flash) with [Looks right] [Change something ›]; the panel never re-renders the profile |

---

## 2. The anatomy — one step, docked

```
┌ panel · 440 ─────────────────────────────────────────┐
│ COACH 2 OF 6 · TRUE NORTH                        ⤢ × │   ← eyebrow, as today
│ PART A · BOUNDARIES                            3 / 5 │   ← .section-label + font-mono text-xs mute (step within part)
│                                                      │
│ YOU                                                  │   ← transcript: the record of decisions
│ Pacific/Auckland · email · documents in English      │     the member's block (bg-jh-mist, r-12) — the ANSWER, not the question
│ ✓ Updated Contact details · View ›        Change ›   │   ← write line (bare) + tertiary Change
│                                                      │
│ YOU                                                  │
│ Authorised in NZ, AU · no sponsorship needed         │
│ ✓ Updated Work rights · View ›            Change ›   │
│                                                      │
├──────────────────────────────────────────────────────┤   ← the footer slot — THE STEP (was: the composer)
│ Before we aim, we set the fence.                     │   ← the part's aside, text-sm mute, once per part
│                                                      │
│ What's your target pay, per year?                    │   ← the question: 16 / 600 ink — the one bold thing on screen
│ The range you aim at, and the floor below which      │   ← help, text-sm mute, ≤ 2 lines, optional
│ you say no.                                          │
│                                                      │
│ CURRENCY   [ NZD                               ▾ ]   │   ← .label + .field h-11; label recedes, value leads
│ LOWER      [ 140,000                             ]   │
│ UPPER      [ 170,000                             ]   │
│ FLOOR      [ 130,000                             ]   │
│            Floor is above the lower end              │   ← jh-red only on a real violation, under the field
│                                                      │
│ ‹ Back        I don't know yet        [ Continue ]   │   ← .link · .link (only where the prompt allows it) · .btn-primary
└──────────────────────────────────────────────────────┘
```

On *Continue*: the step collapses upward into the transcript as a member block in the answer's own words (*NZD
140,000–170,000 · floor 130,000*), the write line follows (*✓ Updated Salary range · View ›*), the page row flashes 600 ms,
and the next step fills the slot. The transcript is therefore a **log of what the member decided**, read top to bottom like
any conversation — only the questions are not repeated in it (they live in the step; a *Change ›* reopens them).

| Principle | Decision | Why |
|---|---|---|
| **Hierarchy** | Exactly one emphasised element per screen: the question (16 / 600 ink). Labels `.label`; help, aside, counts mute; the member's past answers 15 / 400 ink in the mist block | A step has one job; when the question is the only bold thing, the eye knows where the work is |
| **Boxes** | One box kind in the panel — the member's block. The step is **not** a card: it is the footer slot with the Sheet's own `border-t`. Inputs are `.field`, bare | §1 of the agentic doc already fought a second box (`WriteStatus`); a boxed step would be the third |
| **Spacing** | 24 between transcript turns · 16 between the question block and the fields · 8 between fields · 24 above the action row. The slot's padding is the Sheet's | Group > within-group, always |
| **Red budget** | **Continue** — and a validation line when a rule is broken. *Back* and *I don't know yet* are `.link`. When a step has no Continue (a pick that advances on tap), the panel shows no red at all | One red per screen is the brand's rule; it also tells the member what finishes the step |
| **Measure** | Question and help `max-w-[36ch]` in the dock; fields full-width of the 392 lane; wide: the same `max-w-2xl` column | Forms 300–500 px; the lane is the form |
| **Motion** | None on step change: the old step becomes a block, the new step appears — no slide. The flash on the page row is the one animation, as today | A layout that moves itself is the one thing a member cannot predict (§11) |
| **Depth** | None added | The dock already floats; nothing inside it should |

**Grouping rule (S1).** A step is one *decision*: pay (currency · lower · upper · floor), work rights (authorised in ·
sponsorship · status), place (will work in · exclude · remote · hybrid days · relocate · travel — six, so split in two), culture
(must-haves · deprioritise · soft dislikes), the never list (hard no's · never apply · exclude levels · notice). Fifteen
questions become **six steps**. Ceiling: four fields, or one list, per step; whatever fits a 390 px screen without scrolling
the inputs under the keyboard.

---

## 3. Input kinds — each step says which, the panel owns the widget

| Kind | Widget | Example step | Rules |
|---|---|---|---|
| `text` | `.field` single line; `textarea` when the cap > 200 | hard no's, first move, what happened | live counter (mono mute) only when there is a cap; red only when over |
| `number` | `.field inputmode=numeric` with the member's own formatting kept as a string | salary, notice days | cross-field rules shown under the offending field (*floor ≤ lower*) |
| `pick` | ≤ 4 options: `Segmented` (the existing component) · 5–12: native `<select>` · each option may carry a mute sub-line | preferred channel · currency · company type · verified / estimate / cannot confirm | a pick with no other field **advances on tap** — no Continue |
| `multi` | checkbox rows in `SectionList` grammar; ordered multi adds a mono `1 · 2 · 3` as they are ticked | keepers (3–5 of 8), titles per bucket, stories per cluster, Top 3 of 10 | min / max shown as *3 of 5 picked*; the Continue disables, never hides |
| `bucket` | one row per item, three words as a `Segmented` per row | titles → target · analog · exclude | the same shell as `ScoreMatrix` rows; sticky header |
| `chips` | the existing `KeywordArea` behaviour (typed text is local, the list is emitted) | job boards, authorised in, skills list | never control the textarea from the parsed list |
| `matrix` | `ScoreMatrix` as built | skills, companies | unchanged |
| `status-row` | one row per link: the URL · [✓] [paste a corrected link] [none] | the ten careers pages | not finished until every row has a status (C4) |
| `date` | native date, `min`/`max` set by code | Top 3 *by date* | within 7 days by construction (C5) |
| `upload` | the `CvStart` empty state, or a `.btn-secondary btn-sm` with the format line | CV, `Connections.csv` | *Skip* as `.link` |
| `draft` | §4 | headline, clusters, STAR+R, CV role, LinkedIn About | editable in place; *Use this* is the Continue |
| `review` | §5 | each save point | points at the page, never renders it |
| `job` | `JobStatus` in the slot + the filler question beneath it as a `text` step | postings, companies, industries | the filler's answer is real input (`titles.exclude`) |

Decided against: five-dot ratings, steppers, drag-to-order (number the ticks instead), a progress bar (the mono `3 / 5` says it),
any custom select.

---

## 4. The draft step — the model's only appearance

```
├──────────────────────────────────────────────────────┤
│ ● Drafting three headlines                           │   ← JobStatus grammar, 5–15 s; the dot is the one moving pixel
```
then
```
├──────────────────────────────────────────────────────┤
│ Three headlines from your competencies — pick one,   │   ← question 16/600
│ then make it yours.                                  │
│                                                      │
│ ○ I help logistics companies ship on time by turning │   ← radio + the text at 15 ink; the selected row gets
│   delivery plans into dependable releases, clear     │     border-l-2 jh-line-2 — a position, not a colour
│   escalation and calm incident command      187/220  │   ← mono mute counter per variant
│ ○ I help software teams deliver on time through …    │
│ ○ I help ops leaders cut delivery slip through …     │
│                                                      │
│ [ textarea — the picked text, editable         ]     │   ← appears on pick; the member edits here, before the write
│                                           187 / 220  │
│                                                      │
│ ‹ Back   Write my own   Try again (1 left)  [ Use this ] │
└──────────────────────────────────────────────────────┘
```

| Decision | Why |
|---|---|
| **Variants as radios, the pick opens an editor** — never *accept / reject* | S5: a binary on prose makes the member feel judged by the machine; an editor makes the draft theirs. The write happens on *Use this*, through `update_profile`, exactly as a confirmed table does today |
| **The code check is live in the editor** (N2's counter, the banned-phrase flag, "we" in an action line) | The member sees the rule before Continue, not as a red check after hand-over |
| **Try again is a `.link` with a count** (two retries, then *Write my own*) | An uncapped regenerate is a slot machine; the cap keeps the cost predictable and the member honest |
| **Write my own** is always present | The draft is help, never a gate; a member who hates all three types the headline and the same counter checks it |
| **A multi-row draft** (clusters, a CV role's 3–5 bullets, a LinkedIn Experience entry) renders as `SectionList` rows, each with an inline *Edit* that opens its textarea; *Use these* writes the list whole | Lists are taken whole by `applyCoachPatch` — the UI should write them whole too |
| **Nothing from a draft is ever on the page before *Use this*** | No "proposed" state on the page (agentic doc §3) — colour-alone is banned and a schema for *unconfirmed* is a second home |

---

## 5. The review step — the page is the table

A save point in the prompts shows "one table for a yes". In the script the table already exists: it is the page's rows,
which have been flashing as the member answered.

```
├──────────────────────────────────────────────────────┤
│ Your boundaries are on the page — have a look.       │   ← the question
│ Six rows, from Salary range to Boundaries.           │   ← help, mute
│                                                      │
│ ‹ Back          Change something ›    [ Looks right ] │
└──────────────────────────────────────────────────────┘
```

*Looks right* writes `progress: "in_progress"` (the save point). *Change something ›* lists the part's steps as `SectionList`
rows (label · the stored value · ›) and reopens one. On a phone — where the page is under the sheet — the review step shows
the same `SectionList` rows *read-only* as the "look" (the only time the panel shows profile values, and only as a list of
rows the page also draws, never a second layout). Decided against: a table in the panel on desktop (it is two renderings of
one thing); auto-advancing past the review (the member's yes is the program's contract).

**Hand-over** is the review step with the checks: the failed ones as the existing two-column table (check · what to fix),
each row's *Fix ›* reopening its step; *Complete {coach}* as the one primary once every row passes; the CLOSE line verbatim as
the coach's last block; *Open True North ›* as `.btn-secondary` (agentic doc §4, unchanged).

---

## 6. The side door — *Ask your coach*

Optional, v1-undecided. A `.link` in the action row (*Ask your coach ›*) opens a one-turn free-text input in the slot; the
model answers from the stored profile and the current step's question, **writes nothing**, and the slot returns to the step.
The exchange lands in the transcript as a normal pair of blocks. Cap: a few a part; the count is mute under the link. If it
ships, it is the only textarea whose purpose is talk, and it is never the default state — S2 holds because the default slot is
always a step.

Without it, the panel is fully predefined, and that is a legitimate product: predictable, cheap, zero fabrication.

---

## 7. Resume, back, and the rail

| Moment | Behaviour |
|---|---|
| **Opening a coach in progress** | The slot shows the first step whose keys are not stored — `COACH_PARTS` one level down. The transcript above holds the earlier answers. One mute line at the top of the slot: *You stopped at Salary range.* |
| **‹ Back** | Reopens the previous step with its stored value in the fields; *Continue* rewrites only if something changed |
| **Change › on an answer** | Same as Back, from anywhere in the transcript |
| **Editing on the page while a step is open** | Allowed (no scrim, as today); the open step re-reads the profile when it regains focus so a hand-edit is never overwritten by a stale field |
| **Start anyway (gate skipped)** | The missing coaches' keys the step needs become *inline* steps at the point of need (*Target companies needs your target titles — which are they?*), never a send-back |
| **The rail** | Unchanged (`CoachRail`): six rows, ✓ · ● · ○; the Part line and the `3 / 5` are the only progress the panel adds |
| **Closing mid-step** | The step's typed values persist on the device (the coach store already keeps the composer draft); the launcher's tail says *Continue True North* |

---

## 8. Mobile

Below `sm` the sheet is the screen. The step slot is `sticky bottom-0` with the fields above the keyboard; the transcript
scrolls behind it. The grouping ceiling (§2) is set by this screen: question + help + four `.field h-11` + the action row ≈
420 px — fits a 390 × 844 viewport with the keyboard closed, and the active field scrolls into view when it opens. The
`bucket` and `status-row` kinds with ten+ rows scroll *inside* the slot with their header sticky — the §10 pattern. The review
step's read-only rows are the mobile "look" (§5).

---

## 9. Score — the panel as drawn, against the seven principles

| Principle | Score | What holds / what to watch |
|---|---|---|
| Hierarchy | 9 | One bold element (the question); labels recede; answers in the one box kind. Watch: a `draft` step with three long variants *and* an editor is the densest screen — keep the variants to ≤ 3 lines each at 15 px |
| Spacing | 9 | The 24 / 16 / 8 rhythm; group > within-group. Watch: the action row with four controls (*Back · Write my own · Try again · Use this*) at 392 px — wrap to two lines, primary alone on the second, never shrink the text |
| Typography | 9 | 16/600 question, 15/400 answers, 14 mute help, 12 mono counts — four sizes, two weights, one mono role. Nothing under 400 |
| Colour | 9 | One red (Continue / Use this / Looks right), one `jh-red` validation line; the selected variant is a border position, not a colour; the check is `rb-green-dark` as today |
| Depth | 10 | Nothing added inside a surface that already floats |
| Images / icons | 9 | `Check` on write lines, `Paperclip` on uploads, chevrons on tertiary links — the set already in use; no illustration in the slot (the empty state is `CvStart`, already drawn) |
| Layout | 9 | Left-aligned everything except the one empty state; the slot is the composer's geometry, so nothing in the Sheet moves between a model panel and a scripted one |
| **Overall** | **9** | Against today's 7.5 → 9 target: the same number, reached by removing the thing the panel could not design for — a free-text reply to a model — rather than by adding |

**What would make it a 10 and is deliberately left out:** per-step illustrations, a progress bar, colour-coded parts, a
celebratory hand-over animation. Each adds a thing the brand's rules forbid or the member must learn.

---

## 10. Decisions to take before anything is drawn in code

1. **The composer becomes the step.** No general textarea in a scripted coach; the step's input is the only input. (This is
   the whole design — a yes here and the rest follows.)
2. **Answers land in the transcript as member blocks**, in the answer's own words, with the write line and a *Change ›*. The
   questions do not repeat in the transcript.
3. **Grouping by decision**, ≤ 4 fields or one list per step — fifteen boundary questions become six steps.
4. **Drafts are editable in place**, three variants max, two retries, *Write my own* always present.
5. **Review steps point at the page** on desktop; read-only `SectionList` rows on a phone. No table in the panel.
6. **The prompts' voice lines** survive as one mute aside per part — or are dropped for a plainer survey voice.
7. **Ask your coach** in v1 — yes, no, or admin-only for the eval.
8. **Build order** — Coach 2 first (the research jobs exist; highest drop-off), then 3 · 1 · 5 · 6 · 4; the step renderer is
   shared from the first PR.
