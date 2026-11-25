# Decision — how a member completes the profile: chat, script, or page-first guide

**Date:** 2026-11-25. **Status:** decision record, drafted for Rafael's sign-off. Method: the journey map of
`docs/UX_JOURNEY_JOBHACKING.md` re-run for three candidate interfaces side by side, then Refactoring UI's seven principles as a
decision matrix, then cost and quality from `docs/COACH_ASSESSMENT_2026-11-16.md §3` and `checks.ts`. Design detail lives in
`docs/UX_SCRIPTED_COACH.md`; the hand-by-hand map in `docs/UX_JOURNEY_SCRIPTED_COACH.md`. Nothing here is built.

## The three candidates

| | **A · Model conversation** (today) | **B · Scripted chatbot as the main interface** | **C · Page first, guided step panel beside it, one conversational coach** |
|---|---|---|---|
| The member meets | a floating coach; a chat with Claude beside each page | the same floating coach; predefined questions in a chat, free text accepted nowhere | the page's rows, editable; a *guide* panel whose footer slot is the current step; Coach 4 (Story Bank) stays a conversation |
| Who asks | the model, from a prompt | a script registry | the script registry — entered per coach or per empty row; most rows need no asking |
| Who writes prose | the model, in turns | the model, one call per draft point | same as B |
| Who researches / ranks / checks | jobs + code | jobs + code | jobs + code |
| Free text | always | never (or a capped side door) | never in the guide; the page's own editors; the Story Bank conversation |

---

## 1. The journey, three ways

Persona Ana (38, Auckland, delivery lead, has a `.docx` CV, vague target). Same eight stages. Emotion is the dominant feeling
by the end of the stage; drop-off is the inferred risk; the **Metrics** column says what would confirm it.

| Stage | A · Model chat | B · Scripted chat | C · Page + guide | Metrics |
|---|---|---|---|---|
| **0 · First sign-in** | 😊 one door — only with `features.coach`; first turn 3–6 s, tokens spent before she typed a word | 😊 instant first step, free; still one door — four empty pages behind it she can't touch until the bot reaches them | 😊 **instant, free, two doors**: the rail says *Start Narrative*, every empty row says *Fill this in ›*, and any row she already knows she types now | sign-up → first non-empty section (min); % who touch a row before opening the guide |
| **1 · Narrative** | 😊 CV-first table; one well-trodden path | 😊 CV-first; headline with a live counter | 😊 same as B; contact details she fills on the page in a minute if she prefers | CV attached (%); time to *Completed · Narrative* |
| **2 · True North** | 😤→😊 fifteen one-at-a-time questions, then the first job wait; the stage members quit | 😐→😊 six grouped steps; *Back*; keepers/titles as checkboxes over data; still linear — she can't skip to salary | 😊 **the same six steps, or any row directly**; the postings job runs from the page or the guide; the statement fills in either way | sittings per hand-over; postings jobs started / landed; % statements complete |
| **3 · Target companies** | 😰→😊 page-first already; the matrix | 😊 flags as two-button follow-ups; careers status as ten rows | 😊 identical to B — this coach *is* already C | % who score 40 in one sitting; `Connections.csv` before scoring |
| **4 · Story Bank** | 😐 hard thinking; the skeptic digs — **the program's best coaching moment** | 😤 four questions per story, a draft, a radio for status; nobody digs | 😐 **keeps the conversation**; CV-first; the hardest stage stays a conversation because that is what it is | stories with a sourced figure (%); sittings |
| **5 · Master CV** | 😊 payoff | 😊 section by section was always a script; M1 becomes code | 😊 same; a CV she pasted on the page day one is read, not re-asked | days to a stored CV; checks failed at first hand-over |
| **6 · LinkedIn** | 😊 quick | 😊 derivations + two drafts | 😊 same | blocks over limit at hand-over |
| **7 · Share** | 😊 proud · 😐 no way back | same | same | — |
| **8 · After the six** | 😊→😤 then what (fixed 2026-11-25: Job Search by code) | 😊; a returner sees a step, not a transcript tail | 😊; a returner sees the rail and the rows — *what changed since* is the page | 30-day return |
| **Drop-off risk** | **high** at 2 and 3 | medium at 2, **high at 4** | **low at 2** (two ways in), medium at 4 (unchanged from A) | |
| **Where emotion peaks** | the market's own words (2), *I know someone there* (3), the skeptic (4) | 2, 3 | 2, 3, **4** | |

**Critical moments the three disagree on**

1. **The first screen.** A and B have one door. C has two — the row and the guide — and the row costs nothing. This is where
   pain #1 of the journey map (no-coach onboarding) disappears: the page is the onboarding, the guide is help.
2. **Fifteen questions.** A asks them one at a time for 15 minutes. B asks six grouped steps. C asks six steps *or none*: a member
   with a number types it in the row. Same keys, three speeds.
3. **The skeptic.** A and C keep the one conversation that produces something a form cannot — a result with a number pulled out of
   a reluctant memory. B loses it and the journey's hardest stage gets harder.
4. **"I typed and it didn't listen."** B's unique failure: a chat that will not take a sentence. A never has it; C never shows a
   textarea whose purpose is talk, except on Coach 4.

---

## 2. Refactoring UI — the seven principles as a decision matrix

Scored 0–10 for the *surface each candidate makes the member live in*, read from the components on `main`
(`CoachPanel · Transcript · Composer · ScoreMatrix · JobStatus · CvStart · GateStart`, `SectionsPage`) and the drawings in
`UX_COACH_AGENTIC.md` and `UX_SCRIPTED_COACH.md`.

| Principle | A · Model chat | B · Scripted chat | C · Page + guide | Why the difference |
|---|---|---|---|---|
| **Hierarchy** | 7.5 — prose turns with no fixed focal point; the question is wherever the model put it; `WriteStatus` a second box | 8 — one question bold per step, but a step rendered *inside* a coach turn is a third box kind (form-in-a-bubble) | **9** — the question is the one bold element in the footer slot; one box kind in the transcript; the page's rows carry the values | C puts the one emphasised element where the eye already goes (the input) and never renders a value twice |
| **Spacing** | 8 — 24 / 8 rhythm holds; tables at 55ch crush in the dock | 8 — grouped steps; the action row with four controls wraps badly at 392 | **9** — same rhythm; the slot is the composer's geometry; forms live in the 392 lane (300–500 rule) | both B and C fix the dock's tables by not having them; C has fewer controls per screen (the page takes the edits) |
| **Typography** | 8 — 15 / 1.6 prose; the model's markdown varies (headings in a 440 lane) | 9 — four sizes, two weights, one mono | **9** — same | the script removes the model's typographic improvisation |
| **Colour** | 8 — Send + error is the budget; but search results, tables and write lines compete for ink | 9 — one red per screen (Continue) | **9** — same; and on the page the budget was already right | a scripted screen can *guarantee* the red budget; a model turn can only be asked to |
| **Depth** | 9 — one floating dock; `WriteStatus` box the only slip | 9 — nothing added | **10** — nothing added; the page is flat | — |
| **Images / icons** | 8 — `Check`, `Paperclip`, chevrons; the `Thinking…` pulse on text | 9 — same set, the dot pulses, text never | **9** — same | — |
| **Layout** | 7 — a 440 lane holding a 4-hour session; the wide mode exists *because* the lane couldn't; on 1024–1279 the page is a sliver | 8 — the lane fits a step; still a lane for everything | **9.5** — **the page is the layout**; the guide is a lane for one step at a time, which is what a lane is for; wide mode becomes rare | this is the decisive row: A fights its own container; C uses each surface for what it is good at |
| **Overall** | **7.9** | **8.6** | **9.2** | |

**Blur test.** Squint at A: a column of grey prose with a red button. Squint at B: a column of grey blocks, one bold line, a
red button. Squint at C: a page of rows with values, a narrow lane with one bold line and a red button — and the rows are
where the member's eyes return because they *fill in*. C is the only one whose hierarchy says *the profile is the thing*.

**What C cannot score higher on without breaking a rule:** a progress bar (false precision), colour-coded parts (colour alone),
step illustrations (a 440 lane), a celebratory hand-over (motion the brand forbids). 9.2 is the ceiling the system allows.

---

## 3. Cost and quality — the two constraints Rafael added

### Cost per member (shape, not a measurement — the meter must be read first)

| Line | A | B | C |
|---|---|---|---|
| Model turns | 6 conversations × 30–100 turns, 1h cache tail writes at 2× (meter under-prices them) | 0 | **1 conversation** (Coach 4, CV-first, Sonnet eval pending) |
| Draft calls | 0 (drafting happens in turns) | ~14 one-shot, small model, profile slice | **~14**, same |
| Research jobs | the same jobs | the same jobs | the same jobs |
| Search in the transcript | still possible on Coaches 2–3 (the `research-due` defect class) | impossible | impossible outside Coach 4, where `search: 3` is wording only |
| First-turn profile YAML (Coaches 4–6) | paid per session and restart | n/a | once, Coach 4 |
| **Order of magnitude** | dominant and unmeasured; sourcing alone was ~$40 before the jobs | cents to low dollars | **one conversation + cents** |

C costs what one coach costs today plus small change. B is marginally cheaper than C and loses Stage 4 for it.

### Quality — defined as the program defines it: checks pass, nothing fabricated, the member confirmed every value

| Dimension | A | B | C |
|---|---|---|---|
| Fabrication risk | the search-defect class; improvised lists; stale-conversation precedent | zero outside drafts; drafts paste facts from stored keys, a figure not in `numbers[]` rejected | same as B, plus Coach 4's conversation with the existing guards (`storyFacts` status, S2) |
| Checks pass at hand-over | after a fix loop of turns | **by construction** for T1/T4/C4/C5/N7/M1/L2 (radio, status rows, date picker, pasted figures, copied roles) | same |
| Comparable across the cohort | no — every member's questions differ by run | yes — same questions, same order | yes, and the page's values are comparable regardless of route |
| Depth of the interview | the model's strength, on every coach | lost everywhere | **kept where it is the product** (Coach 4) |
| Completion | long sessions, two red stages | shorter steps, *Back*, but linear | shortest path: two ways into every section; resume at a step or a row |
| New quality the chat never had | — | live counters (220 / 60 / 2,600), banned-phrase flags before Continue, coverage lines | same |

---

## 4. The decision

**C — page first, a guided step panel beside it, one conversational coach.**

| Criterion | Weight | A | B | C |
|---|---|---|---|---|
| Journey: drop-off at Stages 2 · 3 · 4 | 30 % | 2 | 3 | **5** |
| Refactoring UI overall | 20 % | 7.9 → 3 | 8.6 → 4 | **9.2 → 5** |
| Cost per member | 25 % | 1 | **5** | 4 |
| Quality (checks · fabrication · depth) | 25 % | 2 | 3 | **5** |
| **Weighted** | | **2.0** | **3.8** | **4.7** |

Why not B, which is cheaper: it buys the last few cents by giving up the one stage where a conversation is the product and by
making the first screen a single linear door — the two things the journey map says cost completions. Why not A: it is the
most expensive, the least measurable, and its surface fights its own container.

**What C is, in one paragraph.** The six JobHacking pages stay the product and every section stays editable by hand. A guide —
the current panel with its composer slot turned into *the step* — walks a member through a coach when she wants walking, and
opens on the exact step behind any empty row she taps. Research is a job, drafting is a one-shot call the member edits before
it is written, checks and ranks are code. Coach 4 keeps a model conversation because the Story Bank is an interview. Job Search
switches on at 6 of 6, by code.

### What this decides, concretely

1. The panel's composer becomes the step on Coaches 1 · 2 · 3 · 5 · 6; the transcript holds answers as member blocks with *Change ›*.
   No free-text composer on those coaches; no "Ask your coach" side door in v1.
2. Coach 4 keeps the current panel (CV-first, conversation, `update_profile`); its cost is the line to meter per cohort and the first
   candidate for the Sonnet eval.
3. Steps are grouped by decision (≤ 4 fields or one list); every step has a twin row on the page (the registry rule, now a contract).
4. Drafts: ≤ 3 variants, editable in place, two retries, *Write my own* always; the small model; the code check as the gate.
5. Review steps point at the page; on a phone, read-only `SectionList` rows. The panel never renders the profile a second way.
6. The open step re-reads the profile on focus — hand edits are never overwritten (the first PR's hard rule).
7. Build order: Coach 2, then 3 · 1 · 5 · 6. The step renderer ships with the first. **Amended the same day** (`docs/RESEARCH_LIBRARY.md`):
   Part C's industries come from a shared **research library** (one entry per industry × region, refreshed monthly, filled by a job only
   where the library is missing), not a per-member research job — so Part C is a pick, Coach 1's *Market pays* is pre-filled, and Coach 3's
   gap fill reads the library's employers before the model. Persona tests (`tests/personas/`) run after each coach's PR.
8. Measure first: fix the meter's cache-write rate (1h, not 5m), promote `meter.mjs` to `scripts/coach-meter.mjs`, read
   November per coach; add to the admin usage tab — % hand-overs with zero failed checks first time · % at 6 of 6 · median hours
   to 6 of 6 · drafts used unedited / edited / *Write my own*.

### Open, and left open on purpose

- Whether a scripted coach can be given a conversation back as a *mode* once Coach 4's bill is known (admin-only switch for the eval).
- The prompts' voice lines as one mute aside per part, or a plainer voice — a copy decision, not a structural one.
- Which small model runs the drafts — settled by the *unedited / edited / Write my own* ratio after the first cohort, not before.
