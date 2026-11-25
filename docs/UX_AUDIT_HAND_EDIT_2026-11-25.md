# The hand-edit gap — every section a member fills without the coach, audited

**Date:** 2026-11-25. **Status:** audit, for decisions. Trigger: Rafael, as a member, got lost on the Headline. Decision C
(`docs/DECISION_PROFILE_INTERFACE_2026-11-25.md`) made the **page** the primary interface — so every section must stand alone,
carrying the coach's guidance. This note walks the six pages as a member who opens a section and types, reads what the
editor offers against what the coach's prompt teaches, and scores the surface. Read from `components/careerops/ContactPolicy.tsx`,
`Personalization.tsx`, `CvPanel.tsx`, `components/jobhacking/TrueNorthPanel.tsx`, `StoryBankEditor.tsx`, `WatchlistSection.tsx`,
`WorkbookPanels.tsx`, `LinkedinProfilePanel.tsx`, `components/compass/GoalFields.tsx`, `lib/jobhacking/sections.ts`, and the six prompts.

**The finding in one line.** The prompts hold the program's knowledge — a formula, a cap, five anchors, a weak/strong pair,
four questions — and the pages quote none of it. Each section is a generic field with a placeholder doing the teaching; three
sections cannot be filled by hand at all; one writes the wrong key. The Headline is the first case, not the only one.

---

## 1. The journey, page-only — Ana, without opening the panel

| Stage | What she finds | Emotion | Can she finish it by hand? |
|---|---|---|---|
| **1 · Narrative** | Contact: four fields, fine. **Headline**: one field, *e.g. Product leader for climate-tech scale-ups*, "what you do and for whom". **Bridge story**: a textarea, *e.g. Built and sold a SaaS after five years…* **Core competencies**: a textarea — which writes `crossCuttingAdvantage`, Coach 4's key | 😐 → 😤 at the Headline | Contact yes. Headline, story: a guess. Competencies: **writes the wrong field** |
| **2 · True North** | The statement (good). Roles: a free title + archetype rows. Seniority: free text. **Salary: a free string** *e.g. AUD 140,000–165,000*, a floor string, a comp textarea that repeats both, scripts. Location: a city, a flexibility string, rule lines. **Boundaries: read-only** — *Your coach writes… Upload it* | 😤 | Roles/seniority: a guess (no postings — the job can't be started from the page). Salary: yes, unvalidated. **Boundaries: no** |
| **3 · Target companies** | *Source my 40* · Remove · Add (good). **Scores: no way to score by hand** — ranks never appear. Top 10 facts, careers status, Top 3 first move: **no editor** | 😐 → 😤 | The 40: yes. Top 10 / Top 3: **no** |
| **4 · Story Bank** | Editor: title · *result* · "Provenance" select; proof points (name · hero metric); snapshots | 😤 | A story without Situation · Task · Action · Reflection, no `numbers[]` with a source, no 60-char cap on the hero metric, no "aim for 8–10 · lead skill X has none" |
| **5 · Master CV** | Paste Markdown; a placeholder mini-CV | 😐 | Yes — but the checks that exist (M2 order, M3 contact lines, M4, the banned phrases) run only at the coach's hand-over; by hand, nothing says the summary says "passionate" |
| **6 · LinkedIn** | **Read-only**: *Written by your coach… Upload a new profile.yml to change them* | 😡 | **No** |
| Empty states everywhere | *Not set* · *Not in your profile yet*; Boundaries and Top 40 say *Upload True North* — the path decision 2026-11-25 retired | 😤 | — |

**Page-only, as built, is viable for Stages 1 (partly), 2 (partly), 5, and not for 3's second half, 4, or 6.** That is the
gap Rafael hit; the Headline is where it first shows.

---

## 2. Section by section — what the prompt teaches vs what the field offers

| Section | The prompt's guidance | The editor today | Gap |
|---|---|---|---|
| **Headline** | *I help [who] achieve [outcome] through [c1], [c2] and [c3]* · ≤ 220 · no final full stop · weak vs strong · three lead-in questions | one field · placeholder · "Previously the lane statement" | formula, cap, example, questions — all missing; a Compass word on a JobHacking page |
| **Bridge story** | four questions (where from · now · next · why it makes sense) · 3–4 sentences ≤ 1,200 · the one-liner *I was X, I did Y, now I do Z because W* | textarea · a two-sentence placeholder | questions, cap counter, one-liner (`bridgeStoryOneLine` has no editor) |
| **Core competencies** | list 15 skills · reject traits · score the matrix · playoff → 3 lead skills → 3–5 noun phrases in the market's words | textarea → **`personalization.crossCuttingAdvantage`** (Story Bank's S4 key) | **wrong key**; `narrative.superpowers` and `leadSkills` have no editor; the matrix exists but only the coach can call it |
| **Target roles** | titles from opened postings · target / analog / exclude · clusters named by the business problem · level as posted | a free title · archetype rows (`axes · buys`) | no postings on the page (the job starts only from the coach), no buckets, no clusters; "archetype" is upstream vocabulary |
| **Seniority** | the primary cluster's level, as posted | free text *e.g. Senior* (audit T4 asked for a `<datalist>`) | no list, no link to the postings' levels |
| **Salary range** | currency code · lower · upper · floor ≤ lower; `goal.salary` and `compTargets` derived | `goal.salary` string · `minimumSalary` string · `compTargets` textarea · scripts | three fields that overlap, none validated; a member types the same number three times |
| **Location** | will work in · exclude · remote · hybrid days · relocate · travel; `locationFlexibility` and `locationPolicy` derived | city · a flexibility string · free rule lines *Remote: Y, AEST hours* | the derived strings are typed by hand in a syntax |
| **Company type** | one phrase; the companies' enum (startup · scaleup · established · public_sector) | a select (Compass's) | fine |
| **Boundaries** | hard no's · culture must-haves + deprioritise · soft dislikes · notice · never apply · levels to exclude | **read-only** panel; empty state → *Upload True North* | no editor at all; the script's `culture` and `never` steps are the editor and live only in the panel |
| **Top 40** | the job, then four 1–5 scores with anchors, ranked by code | *Source my 40* · Remove · Add — good | **no scoring by hand**; `ScoreMatrix` exists, the page never shows it |
| **Top 10 · Top 3** | hiring authority title · known person · thesis · business problem · Say-It-Loud · careers ✓/corrected/none · why now · first move · by date (7 days) | read-only lists | no editor; `careersUrlStatus`, `firstMove`, `byDate` unreachable by hand |
| **Watchlist** | the Top 10 in rank order + title keywords | editor exists | residual CareerOps words (*Scout*, *Pi*, *AI tokens*; audit C5/C6) |
| **Story Bank** | STAR+R · every figure with `verified · estimate · user_cannot_confirm` and a source note · hero metric ≤ 60 · 8–10 · cover each lead skill · no "we" | title · result · "Provenance" · proof points · snapshots | no S/T/A/R fields, no `numbers[]` / source note, no cap counter, no coverage line; *Provenance* is jargon for a three-word choice |
| **Master CV** | section order · header lines = Narrative · XYZ bullets · banned phrases · no "we" · every figure from a story | paste · preview | `coachChecks("masterCv")` exists and never runs here |
| **LinkedIn** | one block per section · LinkedIn's limits · Experience = CV roles | **read-only**, *upload a new profile.yml* | no editor; the counters exist but measure what the coach wrote |
| **Empty states** | *the coach is the onboarding* (2026-11-25) | *Not set* · *Not in your profile yet* · *Upload True North* · *Fill this in with your coach ›* (coach flag only) | three of four say nothing about what fills the row or how |

---

## 3. Refactoring UI — the hand-edit surfaces scored

Scored for a member typing on the page. The system itself holds — `.label` recedes, `.field` is the one input, one red per
form, radii and spacing on scale. The low scores are **form design and empty states**, not hierarchy.

| Page | Score | What fails | What holds |
|---|---|---|---|
| **Narrative** | 6.5 | Placeholders teach, then vanish when typing (the one thing a placeholder must not be asked to do); no counters where caps exist (220, 1,200); a Compass word in a hint; competencies on the wrong key | labels, the facts under each field (`FileFacts`), the save line |
| **True North** | 6 | Structured data as free strings (salary, flexibility, rules in a `Key: value` syntax); the same number typed three times; a read-only section with an upload CTA; "archetype" | the statement as the menu; the datalist proposal (T4) |
| **Target companies** | 7 | The ranked rows are right; the score, the status and the first move have no control on the page; the cooldown is now visible | page-first sourcing; `CompanyRow` grammar |
| **Story Bank** | 5.5 | A story is one textarea; the discipline (status per figure, numbers) that *is* the product has no field; "Provenance"; no coverage count beside the 8–10 target | the row grammar; the *aim for 8–10* summary |
| **Master CV** | 6 | A Markdown textarea with no checks, no structure, no *Download* | the preview; the formats line |
| **LinkedIn** | 4 | Read-only; the empty state points at the retired upload | the per-block Copy and counter |
| **Empty states** | 4 | Three copies, two of them for a path that no longer exists; the one useful link needs the coach flag | — |

**Blur test.** Squint at True North's Salary editor: four equal boxes. Nothing says which one matters or that they are one
number written three ways. Squint at the Headline: a box. The coach's formula is the hierarchy the box lacks.

---

## 4. The fix is one structural move, then a list

**One guidance registry, three readers.** `lib/jobhacking/guidance.ts` beside `sections.ts`: for every section key — `why`
(one line), `how` (the formula, the anchors, or the questions), `example` (weak / strong, or one good answer), `cap`. Written
once from the prompts' own text. Read by **the page's section header** (why under the ask), **the editor** (how + example
under the fields, the cap as a live counter), and **the script's step** (`help`, the aside, the field help). The page and the
guide say the same words because they read the same line.

**The editor is the step.** Where a script step exists, its fields *are* the section's editor: the `pay` step's
currency · lower · upper · floor replaces the three salary strings; the `place` and `move` steps replace the flexibility
syntax; `culture` and `never` make Boundaries editable; `titles` and `keepers` land on Target roles once the postings job can
start from the page. One `StepFields` component, rendered in the slot or on the page — the design's "every step has a twin
on the page" becomes literal, and a member who prefers the page gets the same validation (floor ≤ lower, at least one
exclude) as a member in the guide.

| # | Fix | Section | Size | Why first |
|---|---|---|---|---|
| 1 | The guidance registry + the three readers | all | medium | every other fix is content for it |
| 2 | **Headline as blanks** — the formula composed into `contact.title`, competencies pre-filled, N2 live, weak/strong under a disclosure, *Write it my way* | Narrative | small | the reported gap |
| 3 | **Core competencies on the right key** — a 3–5 chips editor for `narrative.superpowers` (+ lead skills); *Score my skills ›* opens the matrix on the page | Narrative | small–medium | a defect, and the input the headline formula needs |
| 4 | Bridge story: the four questions as labelled fields that compose the story (or a textarea with the questions as help), a 1,200 counter, the one-liner field | Narrative | small | — |
| 5 | True North editors = the script's step fields (salary · location · boundaries editable) | True North | medium | removes the triple-typed number and the read-only section |
| 6 | *Read the postings* on the True North page header (the postings job, like *Source my 40*), with keepers and title buckets under Target roles | True North | medium | without it, roles and seniority are guesses by hand |
| 7 | *Score my companies* on Target companies (the matrix, with `evidence.ts` suggestions); careers status rows and Top 3 picks under the lists | Target companies | medium | the second half of Stage 3 by hand |
| 8 | Story Bank editor: STAR+R fields behind a *more* disclosure per story, `numbers[]` + status + source note, the 60-char counter, the coverage line per lead skill | Story Bank | medium | the product's discipline, on the page |
| 9 | Master CV: run `coachChecks("masterCv")` live under the editor as a check list with *Fix ›*; the banned-phrase list; *Download* | Master CV | small | the checks exist |
| 10 | LinkedIn: one textarea per block with the existing counter; Experience rows copied from the CV | LinkedIn | medium | read-only is the worst score on the board |
| 11 | Empty states: one line per section — what fills it and from where (*Your coach writes this in True North, or type it here*); retire the *Upload* CTAs | all | small | the first thing a lost member reads |
| 12 | Words: *Provenance* → *How sure*; *archetype* → *role type*; drop *Previously the lane statement*, *the agents* on JobHacking | all | small | — |

**Order.** 1 → 2 → 3 → 11 → 12 in one PR (the Narrative page stands alone after it); 5 → 6 with Coach 2's next PR (Part C and
the library); 7 with Coach 3's; 8 and 10 with Coaches 4 and 6; 9 any time.

---

## 5. Metrics — what would show the gap closed

Per section: % of members whose first write came from the page vs the guide · saves that fail a live check (N2, floor ≤ lower)
before vs after · hand-edited sections that pass the coach's checks at the next hand-over · time on a section before the first
save · the *Write it my way* rate on the Headline (how often the formula is wrong for someone).

**What this audit does not change.** The six coaches; the page as the product; one profile with one home; code checks and
derives; the panel's grammar. Every fix above is content the prompts already contain, a field the schema already has, or a
component that already exists (`ScoreMatrix`, `JobStatus`, `checks.ts`, the counters) shown where a member can reach it.
