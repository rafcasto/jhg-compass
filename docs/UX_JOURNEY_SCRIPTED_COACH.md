# The scripted coach — manual · code · agent, step by step

**Date:** 2026-11-25. **Status:** analysis, for a decision. Read against `docs/UX_JOURNEY_JOBHACKING.md` (the journey as built),
the six prompts in `lib/engine/coach/prompts/`, `lib/engine/coach/parts.ts` (the parts), `checks.ts` (N1–L4), `rubrics.ts`
(the two matrices), `tools.ts` (`update_profile · run_research · score_matrix`) and the two jobs in `lib/engine/handlers/`.

**The question.** The member still talks to a chatbot beside the page. But the chatbot is **not a model in a conversation**: it
asks **predefined questions**, in a fixed order, and writes the answers. Where does a member simply *type or pick*, and where
does an **agent** (a research job, a bounded generation call, a code derivation) earn its place by helping them decide?

**The one-line answer.** The six coaches already *are* a state machine — `COACH_PARTS` says which keys each part produces and
`done()` says when a part is finished; `checks.ts` says when a coach may hand over; `applyCoachPatch` derives the lists, the
ranks and the goal. What the model does today is three things on top: it **asks the questions** (scriptable), it **drafts
prose** (a bounded call, not a conversation), and it **pushes back** (half codable as flags, half lost). The research is
already a job. So the scripted coach is the same engine with the conversation replaced by a question script, and the model
kept only at the drafting points — each one a one-shot, code-checked job the member approves.

---

## 0. The four hands — a vocabulary for the tables below

| Hand | Who decides | What it looks like in the panel | Where it already exists |
|---|---|---|---|
| **M · Member types** | the member, free text or a number | one question, one input, a *Save* — the row on the page flashes | every `SectionsPage` editor; `update_profile` |
| **P · Member picks** | the member, from a list code built | radio / checkbox / select / the `ScoreMatrix` | `ScoreMatrix`, `Segmented`, the CV-first buttons |
| **C · Code derives / checks / ranks** | nobody — a rule | a write line on the page, a red check line with the fix | `applyCoachPatch`, `checks.ts`, `rankCompanies`, `lists.ts`, `rankRows`, `commonFlags` |
| **A · Agent proposes** | a job (research: code opens URLs; or **draft**: one structured model call over the stored profile) — the member approves, edits or rejects | `JobStatus` while it runs, then a table or a draft with *Use this · Edit · Not this* | `run_research` (`postings`, `companies`), `evidence.ts`; **draft jobs do not exist yet** |

Rules that do not change (CLAUDE.md): the member says yes before anything is written · code checks and ranks, never the model ·
research is a job, every link opened by code · one profile, one home · the page is the product.

**What a predefined script loses, honestly.** The prompts' best moves are *pushback*: "hardworking is a trait, not a skill",
"a dream, not a target", "research more is not a first move", "would a skeptical executive say *tell me more*?". Some of that is
already a code flag (`commonFlags`, `tie_at_cut`, the companies rubric's flags) and the rest can be a **scripted follow-up
triggered by a rule** (§8). What cannot be scripted is the *unscripted* reply to a member who says something the script did not
expect. That is the trade: predictable cost and zero fabrication for less adaptiveness. The design below keeps the model
exactly where the trade is worth it — drafting from the member's own answers — and nowhere else.

---

## 1. The map at a glance

| Coach | Part | Hand | The agent's job, when there is one |
|---|---|---|---|
| **1 · Narrative** | Who you are | **M** · C (timezone, location) | — |
| | What you're good at | M (list) · **P** (`ScoreMatrix skills`) · C (rank, cut, flags) · P (playoff pairs) · **A-draft** (competency wording vs postings) | *competencies*: 3 lead skills → 3–5 noun phrases in the market's words |
| | Your headline | **A-draft** (3 variants) · P · C (N2) | *headline*: formula over who / outcome / competencies |
| | Where you're going | M (4 answers) · **A-draft** · P/M (edit) · C (N4) | *bridge story*: 3–4 sentences + the one-liner |
| **2 · True North** | Boundaries | **M · P** · C (T2, T7) | — |
| | What the market posts | **A-research** `postings` · C (keepers by frequency) · **P** (title buckets) · **A-draft** (clusters) · P (primary) | *postings* (exists); *clusters*: group titles by business problem |
| | Industries & North Star | **A-research** `industries` (planned) · P (pick 2–3) · M/P (company type) · C (goal.\*) | *industries*: ten growing industries with a number and an opened source |
| **3 · Target companies** | The 40 | **A-research** `companies` (exists, page-first) · P (remove / approve) · M (add a name → job) | *companies* (exists) |
| | Fit scores | **A-evidence** (Growth, Access from `evidence.ts`) · **P** (`ScoreMatrix companies`) · C (rank, flags) | *evidence* (exists) |
| | Top 10 & careers pages | C (ranks 1–10) · **P** (✓ / corrected / none per link) · M (hiring-authority title, known person) · **A-draft** (thesis, business problem) | *thesis*: one line in the company's language from its postings + the member's competencies |
| | Top 3 | **P** (3 of 10) · M (first move, by date) · C (C5) | — (a *why now* comes from the growth signal already stored) |
| **4 · Story Bank** | The stories | M (roles) · **A-draft** (candidate stories from the CV's bullets) · M (what happened / you did / changed / proof) · **P** (verified · estimate · cannot confirm) · **A-draft** (STAR+R + title + hero metric) · C (S1–S3) | *stories*: bullet → interview answers → STAR+R |
| | Framing, proof asset, snapshots | **P** (stories per cluster) · **A-draft** (emphasize line, cross-cutting advantage) · M (proof-asset URL) | *framing* |
| **5 · Master CV** | Agree the frame | M (current domain) · C (header from Narrative) · P (keepers to lead with) | — |
| | Section by section | **A-draft** (per section, from stories only) · P/M (approve / edit) · C (M2–M4) | *cv-section*: XYZ bullets from `stories[]`, numbers pasted exactly |
| | Quality check | **C** (banned phrases, "we", "responsible for", order) · M (languages, locked sections) | — (M1 — every figure traces to a story — is code once numbers are pasted from `numbers[]`) |
| **6 · LinkedIn** | each block | **A-draft** (from the CV + stories) · P (variant) · M (edit) · C (L1–L4, counts) | *linkedin-block*: headline ×3, About ×2, experience per CV role, skills |

**Count.** Of the ~22 parts: 6 are pure member input with code checks; 4 are research jobs (two built); 10 are *drafting*
points where the model writes from the member's own answers, once, and the member approves; 2 are the matrices. Nothing in the
program needs an open-ended conversation to produce its keys.

---

## 2. Coach 1 — Narrative

| Step | Keys | Today (the model) | Scripted | Hand |
|---|---|---|---|---|
| Opening | — | the fixed line + one line + first question | the fixed line (it is already verbatim in the prompt), the time (*about an hour*), then Q1 | — |
| CV-first | — | reads the CV, proposes contact · headline material · competencies · story bones as a table | **keep as an A-draft job:** `narrative-from-cv` — one structured call over the document → a table the member confirms cell by cell. The rest of the script skips what the table filled | **A** |
| 1 · Contact details | `jhg.identity.*`, `contact.phone · linkedin · portfolio · github` | asks "a few at a time", proposes the IANA timezone | Q: phone · city, country · LinkedIn URL · portfolio / GitHub · other emails · X (professionally?) · *email, call or either* (P) · documents language (P, default en). **Timezone is code** from the city (a lookup, confirm in one tap). Name and email from the account, shown not asked | **M**, C |
| 2a · The skill list | (none yet) | "list 15, fast; I reject traits" | Q: *List the skills you enjoy using and would use again — aim for 15, one per line.* **Trait filter in code**: a small list of trait words (hardworking, team player, passionate…) flags a row — *That's a trait; what's the skill under it?* — with an inline rewrite | M, C |
| 2b · The matrix | `jhg.narrative.skillScores` | `score_matrix skills` | unchanged — the matrix is already the scripted form | **P**, C |
| 2c · Flags | — | reads back, pushes back on each flag | each `commonFlags` / `skills.ts` flag becomes a **scripted follow-up** with two answers: *An unproven skill in your top 6 — give one result with a number, or drop it* → M (the result) or P (drop → rescore). Inflated / flat scores → *Rescore the three you'd drop first* (P, rescore) | C → M/P |
| 2d · Playoff | `jhg.narrative.leadSkills` | pairs, "which would you rather be known for" | the top 6 by `topCut`, **pairs presented by code** (a 6-item bracket is ≤ 5 questions), the member taps one each. Result: 3 lead skills, spelled as scored (N7 passes by construction) | **P**, C |
| 2e · Competencies | `narrative.superpowers` | turns lead skills into 3–5 market noun phrases, checks wording against live postings | **A-draft `competencies`**: input = lead skills + the postings already stored for this member if any (`jhg.trueNorth.postings[].phrases`) or a `postings` job run with the lead skills as titles; output = 3–5 phrases, each with the posting phrase it echoes. Member ticks 3–5, edits wording | **A**, P |
| 3 · Headline | `narrative.headline` | three versions from the formula; the member picks | **A-draft `headline`**: two scripted questions first — *Who do you help?* (M) · *What do they get?* (M) — then the formula *I help [who] achieve [outcome] through [c1], [c2] and [c3]* yields three variants (broad / tighter / sharpest). Member picks or edits; **N2 is live** (≤ 220, one sentence, no final stop) as a counter under the field. A member may skip the draft and type their own | **A**, P, C |
| 4 · Bridge story | `personalization.exitNarrative`, `jhg.narrative.bridgeStoryOneLine` | asks four things, drafts both | four scripted questions — *Where do you come from? · What do you do now? · What do you want next? · Why does the move make sense?* (M) — then **A-draft `bridge-story`**: 3–4 sentences ≤ 1,200 + *I was X, I did Y, now I do Z because W*. Approve / edit | M, **A**, C |
| 5 · Hand over | `progress` | the checks, fixes, the CLOSE line | `coachChecks("narrative")` already; a failed check is a scripted question that jumps back to its step. The CLOSE line is verbatim and already asks for `Connections.csv` and the CV on the Master CV page | **C** |

**Verdict.** Coach 1 scripts well. The three drafting points (competencies, headline, bridge story) are each one call over
answers the script collected first — the model never asks, it only writes. The pushback that matters (traits, unproven skills)
is a word list and a flag.

---

## 3. Coach 2 — True North

| Step | Keys | Today | Scripted | Hand |
|---|---|---|---|---|
| Part A · Boundaries | `jhg.trueNorth.boundaries.*` → `policy.*`, `personalization.compTargets · locationPolicy · negotiationScripts`, `notes` | ~15 one-at-a-time questions, pushback only where it hurts | the same ~15 questions, in the prompt's order, each typed or picked: currency (P, the eight codes), lower / upper / floor (M, numbers; **floor ≤ lower checked live**), authorised in (M), sponsorship Y/N (P), visa status (M, one line), will work in / exclude / remote Y/N / hybrid days / relocate / travel (M/P), hard no's (M, list), culture must-haves + deprioritise Y/N (M, P), soft dislikes, notice days (M, integer), exclude levels (P from a level list), never apply (M), negotiation lines ≤ 3 (M). *I don't know yet* is a button on culture, dislikes, negotiation. Then **one review table** (the prompt's own save point) → write with `in_progress`. The derived `policy.*` / `personalization.*` lines are **code** (the prompt's rules are already deterministic) | **M · P**, C |
| Part B · boards | — | asks which boards they check | Q: *Which job boards do you already check?* (M, chips) → passed as `boards[]` | M |
| Part B · postings | `jhg.trueNorth.postings[]` | `run_research postings`, then the table | **unchanged** — the job exists; `JobStatus` on the page; *Saved as it lands* aside; the filler question meanwhile (*Which titles would you never apply for?*) becomes real input for `titles.exclude` | **A-research** |
| Part B · keepers | `keepers[]` | proposes 3–5 recurring phrases | **code**: phrase frequency over `postings[].phrases` (`withPhrases` already keeps only phrases present in the snippet) → the top 8 as checkboxes; member picks 3–5. No model | **C**, P |
| Part B · titles | `titles.target · analog · exclude` | title by title: target / analog / exclude | **code lists every title that repeats**; one row each with three radio words. ≥ 1 target, ≥ 1 exclude enforced | C, **P** |
| Part B · clusters | `clusters[]` | groups into 2–3 named by business problem, with keepers, buys, level, fit | **A-draft `clusters`**: input = target + analog titles, keepers, the postings' phrases; output = 2–3 clusters (name = the problem, titles most-posted first, axes ⊂ keepers, buys one sentence, level as posted). Member edits names, drags a title, and **picks the one primary** (P, radio — T4 by construction). The level per cluster is the postings' most frequent (code), overridable | **A**, P, C |
| Part C · industries | `industries[]` | researches ten growing industries with a number and an opened link | **A-research `industries`** — the planned third job (`AGENTIC_PIPELINE_PLAN §8 B`), the `postings` shape: country → the knowledge file's growth-source directory → ten industries, each with a number and a URL code opened; sub-sectors the same; **outlook is code** (growing → sunrise, flat/shrinking → sunset, no number → ""). Member picks 2–3 in order (P) and 1–3 sub-sectors each (P). *No number after two sources* → the member is asked for a source (M) or it stays empty | **A-research**, P |
| Part C · company type | `companyType` → `goal.companyType` | one phrase | P from the four enums (startup · scaleup · established · public_sector) plus a free line | P/M |
| Part C · the North Star | `goal.*`, `watchlist.positive · negative`, `personalization.targetRoles[]` | written "exactly by these rules" | **all code** — the rules in the prompt are formulas over stored keys (`goal.role = level + first title of the primary cluster`…). Show the statement filling in; the member confirms once | **C** |
| Hand over | | T1–T7 | `coachChecks("trueNorth")`; T3's *thin results* is a job result code, so the script can say it | C |

**Verdict.** Coach 2 is the most *research*-heavy coach and the one where the script is strongest: two research jobs (one
built, one planned), two code derivations (keepers, titles), one drafting job (clusters), and fifteen plain questions. The only
model text is the clusters' names and the *buys* sentence.

---

## 4. Coach 3 — Target companies

| Step | Keys | Today | Scripted | Hand |
|---|---|---|---|---|
| Part A · the 40 | `companies[]` | `run_research companies`, ten at a time, delete / add / approve | **already page-first** (*Source my 40*, Remove, *Add a company* → job with `names[]`). The script's job is the review: *Here are the first ten — remove any you'd never consider* (P), and per company *Know anyone there?* (M, name, optional). Short of 40 after passes → the script says the true number and offers *Run again in an adjacent industry / region* (P → job with `region`) | **A-research**, P, M |
| Part B · connections | `users/{uid}/connections` | asks once for `Connections.csv` | the ask is in Coach 1's CLOSE already; here it is one scripted step with an upload control and *Skip* | M (upload) |
| Part B · the matrix | `companies[].scores` | `score_matrix companies` with evidence; Growth and Access pre-filled | **unchanged** — `evidence.ts` suggests, the member sets Interest and Proof, changes any suggestion (`override`) | **A-evidence**, **P**, C |
| Part B · flags | `challenges[]` | challenges one company at a time | each rubric flag → a scripted follow-up with the company named: *Interest 5 with Access 1 and Proof 2 — a dream or a target?* [Keep — here's my route: ▭] [Lower it]; *You raised Growth from 2 to 4 — what signal?* (M, becomes `challenges[].resolution`). Rescore through the same matrix with `items[]` | C → **M/P** |
| Part C · Top 10 facts | `top10[].hiringAuthorityTitle · knownPerson · sayItLoud` | drafts together | hiring-authority title (M, with a `<datalist>` of common titles), known person (M, from memory only), Say-It-Loud Y/N (P) | **M**, P |
| Part C · thesis & problem | `top10[].thesis · businessProblem` | one line in the company's language | **A-draft `company-thesis`**: input = the company's postings (shared `jobPostings`), its growth signal, the member's competencies and lead skills; output = thesis (one line) + business problem or *needs a signal*. Approve / edit per row | **A**, P/M |
| Part C · careers pages | `top10[].careersUrl · careersUrlStatus` | "open each and reply 1 ✓ / 1 <link> / 1 none" | ten rows, each: the link code found (`confirmCareersUrl` status shown), three controls — ✓ · paste a corrected URL · none. Not finished until all ten have a status (C4) | **P/M**, C |
| Part D · Top 3 | `top3[]` | picks three with the strongest dated signal, a first move, a date | *Pick three of your Top 10* (P, checkboxes, ranked rows with their signal and date visible); per pick: *why now* **pre-filled from `growthSignal` + `growthSource`** (C, editable), *first move* (M — with a rule: a move that contains "research" is flagged: *Research is not a first move*), *by date* (P, a date picker limited to the next 7 days — C5 by construction) | P, **M**, C |
| Hand over | `watchlist.companies`, `companyLists.*`, `notes` | derived | already **code** (`lists.ts`, `applyCoachPatch`) | C |

**Verdict.** Coach 3 is already the most scripted coach in the repo — the page runs the job, the matrix is a form, the ranks
are code. The remaining model text is the thesis line and the business problem; everything else is a pick, a URL status or a
typed first move.

---

## 5. Coach 4 — Story Bank

| Step | Keys | Today | Scripted | Hand |
|---|---|---|---|---|
| Roles | — | 3–5 roles, most recent first | **from the CV when stored** (`setup.cvMarkdown` / the handed document → the `### Company -- Location` headings, code); else typed rows: company · title · dates | C / M |
| CV-first | — | every result bullet is a candidate story | **A-draft `story-candidates`**: one call over the CV → table *role · the bullet · the figure it claims*. The member ticks the ones worth telling | **A**, P |
| Per story · interview | `storyFacts[]` raw | what happened · what YOU did · what changed · where the proof lives | four scripted questions per story (M), then **status** (P: verified · estimate · cannot confirm) and **numbers** (M, each figure as written; *estimate* forces "about" in the result by code). The source kinds in the prompt (reviews, thank-yous, dashboards…) become a *Where else might a story be hiding?* prompt list between stories | **M · P** |
| Per story · the draft | `stories[]`, `narrative.proofPoints[]`, `storyFacts[].title` | drafts title, STAR+R, hero metric; tests "tell me more" | **A-draft `star`**: input = the four answers + numbers + status; output = 3–6 word title, STAR+R (result using only `numbers[]`, "about" on estimates), reflection, hero metric ≤ 60. Approve / edit. **Code guards**: hero metric figures ⊂ numbers (S3), a *cannot confirm* story never leaves `storyFacts` (S2), "we" in the action line flagged | **A**, P/M, C |
| Coverage | — | aim for ten, cover all three lead skills and the clusters | **code**: a coverage line — *6 stories · Lead skill "X" has none yet · aim for 8–10* (the `STORY_BANK_TARGET` summary already exists) | C |
| Part B · framing | `personalization.adaptiveFraming[]` | per cluster, which stories prove it + one line | per cluster: *Which stories prove this?* (P, ordered checkboxes) → **A-draft `framing`** writes `emphasize` ≤ 200 and the `proof` string (code: `cv.md — ` + titles) | P, A, C |
| Part B · cross-cutting | `personalization.crossCuttingAdvantage` | 1–3 sentences | A-draft from the clusters' *buys* + the lead skills; approve / edit | A, M |
| Proof asset | `personalization.portfolio`, `contact.portfolio` | outline, publish, bring the URL | Q: *Do you have a public page that proves your strongest story?* [Yes — URL] [Not yet — skip]; `whenToShare` (M). The outline is an **optional A-draft** | M, (A) |
| Snapshots | `snapshots[]` | optional, one per Top-3 | optional: *Point a story at a Top-3 company* (P story × P company) → A-draft fills context / challenge / relevance from the two | P, A |

**Verdict.** The hardest coach to script *well*, because its value is the skeptic's "tell me more". The script keeps the
discipline in three places code can hold it — status per figure, numbers pasted not paraphrased, coverage per lead skill —
and leaves the narrative shaping to one draft call per story.

---

## 6. Coach 5 — Master CV

| Step | Keys | Today | Scripted | Hand |
|---|---|---|---|---|
| Frame | `jhg.artefacts.currentDomain` | role family, what a reader judges, lane to avoid, keywords | **mostly stored already**: primary cluster, keepers (shown, not asked). Q: *The field you work in today, in plain English* (M). *Lane to avoid signalling* (M, optional) | M |
| Header | the `# CV --` block | copied from the Narrative | **code** (M3 by construction). Q: *Have you claimed a custom LinkedIn URL?* [Yes — paste] [Not yet] | C, M |
| Headline line | `contact.title` | target role in employer wording \| 3–4 phrases | code proposes `goal.role` + the keepers; member edits; `contact.title` = before the first ` \| `, ≤ 120 (C) | C, M |
| Summary | `## Professional Summary` | 3–4 sentences with a number each | **A-draft `cv-summary`** from the bridge story one-liner, lead skills, the top hero metrics. Approve / edit. **Banned-phrase list is code** (the prompt lists it) | A, M, C |
| Each role | `## Work Experience` | context sentence + 3–5 XYZ bullets from claimed stories | per role: *Which stories belong to this role?* (P) → **A-draft `cv-role`**: *Accomplished X as measured by Y, by doing Z*, numbers pasted from `numbers[]` (so **M1 becomes code**: every figure in a bullet must appear in a claimed story's numbers). Approve / edit per bullet | P, **A**, C |
| Projects · Education · Certs · Awards | the sections | one line per strongest story; ask what the CV doesn't hold | Projects: code proposes one line per snapshot / top story (P); Education / Certifications / Awards: **from the handed CV when there is one** (code), else typed rows (M) | C / M |
| Skills · Languages | `## Skills` | each skill evidenced by a bullet | Skills: the lead skills + competencies + each cluster's axes, **only those a bullet mentions** (C); Languages (M, with levels from a list) | C, M |
| Optional | `languageLearning[]`, `lockedSections[]`, `cvHouseRules[]` | two optional questions + house rules | three scripted optional questions; house rules default to the program's (single column, no photo…) with *Add a rule* | M, P |
| Quality check | — | run it out loud | **code**: section order (M2), banned phrases, "we", "responsible for", adjectives in the summary (a short list), figures not in `numbers[]`. Each hit is a line with *Fix* that reopens the bullet | **C** |

**Verdict.** The CV is where "every number traces to a story" becomes *enforceable*: the draft job may only paste figures from
`numbers[]`, and the check is string containment. The model writes the sentences; the facts are never its.

---

## 7. Coach 6 — LinkedIn

| Block | Today | Scripted | Hand |
|---|---|---|---|
| Headline | three variants | **A-draft** ×3 (best overall · search-heavy · value-heavy) from the CV headline + keepers; P; the counter *187 / 220* is already on the page | A, P |
| About | six answers → two frameworks | the six questions scripted (M: who for · the problem · three stories (P from the bank) · the method · what working with you is like · a call to action) → **A-draft** ×2; P + edit | M, P, A |
| Experience | one entry per CV role | **code copies** title · company · location · dates from the CV (L2 by construction); **A-draft** writes the 2–3 sentence positioning paragraph; bullets copied; skills per role P ≤ 5 from the Skills list | C, A, P |
| Skills | 20–25 proven, first three pinned | code proposes from CV Skills + stories; member orders (drag) and pins three | C, P |
| Featured | 2–3 items, proof asset first | rows: kind (P) · title (M) · URL (M); the proof asset pre-filled first (C) | C, M, P |
| Education · Certifications | from the CV, ask what it doesn't hold | code from the CV; M for gaps; *I don't know* stays "" | C, M |
| Hand over | L1–L4 | `coachChecks("linkedin")` | C |

**Verdict.** Coach 6 is almost entirely derivation plus two drafting points. It scripts cleanly.

---

## 8. Pushback as rules — what the model's judgement becomes

The prompts' recurring challenges, and how a script carries each without a model:

| The coach says today | Rule | Fires as |
|---|---|---|
| "That's a trait, not a skill" | word list (hardworking, team player, passionate, detail-oriented, fast learner…) | inline flag on the skill list with a rewrite box |
| "Unproven skill in the top six" | `proof ≤ 2` and rank ≤ 6 (already a flag) | follow-up: a result with a number (M) or drop (P → rescore) |
| "Loved but unpaid is a passion, not a lead skill" | `love ≥ 4 && pays ≤ 2` | one line; not blocking |
| "Inflated or flat scores" | `commonFlags` (a scale that does not separate) | *Rescore the three you'd drop first* (P) |
| "A dream, not a target" | `interest = 5 && access ≤ 2 && proof ≤ 2` (companies rubric) | follow-up with [Here's my route] [Lower it] |
| "You raised Growth — what signal?" | `override` on a suggested axis (already carried) | follow-up (M) → `challenges[].resolution` |
| "Research more is not a first move" | `/research|look into|find out/i` on `firstMove` | inline flag, must change |
| "We is not proof" | `/\bwe\b/i` in `action` or a CV bullet | inline flag |
| "A number without a source is a claim" | status required per figure; `cannot confirm` never leaves `storyFacts` | by construction (S2, M4, L4) |
| "Would a skeptical executive say *tell me more*?" | — | **lost.** The one judgement call with no rule; the draft job can be told to end each result with a number, which is the proxy |
| "Staying open to everything reads as clear about nothing" | `titles.target` > 8 or clusters > 3 | one line when the member over-selects |

---

## 9. What the script is, in this codebase

Nothing here needs a second way to write the profile. The scripted coach is:

1. **A script registry** beside the parts — `lib/engine/coach/script/<coach>.ts`: an ordered list of steps, each `{ id, part,
   question, input: "text" | "number" | "pick" | "multi" | "matrix" | "upload" | "review", keys: [...], options?, validate?, draft?: DraftKind,
   research?: ResearchKind }`. `COACH_PARTS[coach][part].done(profile)` already decides which part is current; the step within a
   part is *the first whose keys are not stored* — the same rule, one level down. Resume is free; "never ask what you already
   know" is the registry's own contract.
2. **The same write.** Every answer goes through `applyCoachPatch` with the coach's `COACH_PATCH_SCHEMAS` — merge key by key,
   lists whole, derivations, `rankCompanies`, `lists.ts`, checks on `progress`. `foreignPaths` keeps a step on its coach's keys.
3. **Draft jobs** — a third job family next to research: `ENGINE_JOB_TYPES` grows by `draft`; a handler takes `{ kind, uid }`, reads the
   stored profile (never the transcript), makes **one structured call** (Haiku-class for wording, as the pipeline plan's model
   table says; the member's facts are inputs, never outputs), and returns a proposal **the member approves before it is written**
   — through the same `update_profile` path. Kinds from the tables above: `narrative-from-cv · competencies · headline · bridge-story ·
   clusters · company-thesis · story-candidates · star · framing · cv-summary · cv-role · linkedin-headline · linkedin-about · linkedin-role`.
   A draft that pastes a figure not in `numbers[]` is rejected by code before the member sees it.
4. **Research jobs** — as today: `postings`, `companies`; `industries` to build (the plan's phase B); a step with `research` shows
   `JobStatus` and asks its filler question meanwhile.
5. **The panel** — `CoachPanel` renders a step instead of a model turn: the question as the coach's bubble, the input as the
   composer (text, a number field, radios, the `ScoreMatrix`, an upload, a *review table* with ✓ per row), *Skip* only where the
   prompt allows *I don't know yet*. The transcript keeps the same two voices; the write lines, the flash, the Part line, the rail
   and the gate are unchanged. **No free-text reply to the coach** — the one visible difference, and the honest one.
6. **A free-text escape, bounded.** *Ask the coach a question* opens one model turn with the profile and the current step as
   context, answers, and returns to the script — it never writes. Optional; without it the panel is fully predefined.

**What it costs and saves.** Today a conversation is ~20–60 model turns per coach with a 1h cache and the transcript growing
(`COACH_ASSESSMENT §3`); the script is ~10 draft calls per coach, each small, with no transcript, plus the research jobs that
already run. Fabrication risk goes to zero outside the draft calls, and inside them to the wording only. Adaptiveness goes down
by exactly what §8 cannot encode.

---

## 10. The decision

| | Model conversation (today) | Predefined script (this note) | Hybrid |
|---|---|---|---|
| Who asks | the model | the registry | the registry; the model only drafts and answers an optional side question |
| Who decides | the member | the member | the member |
| Who researches | jobs (code) | jobs (code) | jobs |
| Who ranks / checks / derives | code | code | code |
| Who writes prose | the model, in turns | the model, one call per draft point, code-checked | same |
| Pushback | adaptive | rules (§8) | rules + the side question |
| Cost per member | high, variable | low, predictable | low |
| Risk | the search defects, improvisation, long transcripts | a member the script did not foresee; a flat voice | small |

**Recommendation.** Build the script as the panel's default and keep the model at the fourteen draft points and the optional
side question (*Hybrid*). Order: Coach 2 first (the research jobs exist, its derivations are formulas, and it is the stage with
the highest drop-off in the journey map), then Coach 3 (already page-first), then 1, then 5 and 6, then 4. Each coach is one
PR: its script file, its draft kinds, the panel's step renderer shared from the first.

Open before the first PR: whether a member may switch a coach back to the model conversation (proposed: admin-only, for the
eval); which draft kinds run on which model; whether *Ask the coach a question* ships in v1.
