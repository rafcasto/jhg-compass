# The agentic coach — Refactoring UI applied (2026-11-16)

**Spine:** `docs/AGENTIC_PIPELINE_PLAN.md` — these are the surfaces of its phases A and B.

**Scope:** the surfaces the agentic workflow of `docs/COACH_ASSESSMENT_2026-11-16.md` adds or changes on the JobHacking
portal — the docked panel while a research job runs, the CV-first start, the code-checked hand-over, the rail of six,
the empty-row link, the live-write highlight — and the panel as built today. Menu unchanged (JobHacker Compass ·
Artefacts). Everything through the existing system: `docs/UX_AUDIT_COMPASS_TABS.md §0` (one button system, labels
recede, radii 4/8/12/16/24, the red budget, `.icon-btn` + `aria-label`, 44 px targets, `jh-mute` the floor for readable
text) and `docs/UX_COACH.md §3` (the panel is `Sheet dock="right"`, 440 px, a transcript not bubbles).

**Method:** the seven principles, scored 0–10 per surface from the source (`components/coach/*`, `SectionList`,
`globals.css`). One rule above all of them here: **the page is the product; the panel is the conversation about it.**
Whatever the coach produces — postings, companies, a drafted headline — is read on the page in the page's own row
grammar, and the transcript carries the *talk* and a one-line pointer. The panel never grows a second rendering of the
profile.

| Surface | Now | Target | One-line verdict |
|---|---|---|---|
| The panel as built (transcript · writes · composer · launcher) | **7.5** | 9 | Right anatomy; two box kinds in the transcript, a pulsing sentence, a hover transform the brand forbids |
| A research job in progress (new) | — | 9 | One status line with a mono count; nothing floats, nothing spins, the page fills when it lands |
| CV-first start (new) | — | 9 | One empty state, one primary action; proposals in the transcript as a table, writes on the page on *yes* |
| Hand-over with code checks (new) | — | 9 | Failures as a two-column table; completion as the status line + the rail's ✓; the next coach is a secondary button |
| The rail of six (new) | — | 9 | `SectionList` as it is, under the two menu headings; gated rows are mute text, not a fourth glyph |
| Empty-row link + write highlight (new) | — | 9 | A tertiary link, not a button; a 600 ms mist fade, no scroll theft |

---

## 1. The panel as built — 7.5 → 9

What holds: left-aligned prose at 15/1.6 in `jh-ink`; the member's turn as the one block (`bg-jh-mist`, radius 12); 24 px
between turns, 8 inside; `Coach 2 of 6` as the eyebrow; the composer's Send as the panel's one red; the launcher in ink
with the single red dot for *your turn*; `shadow-jh-3` on the one floating element.

| Principle | Finding (file) | Fix |
|---|---|---|
| Hierarchy | `WriteStatus` is a **second box** — `border border-jh-line bg-jh-mist/40 rounded-sm` — so a write and a member turn read as the same kind of thing (`Transcript.tsx`) | Unbox it: `✓ Updated Salary range · View ›` as a bare line, `text-sm text-jh-ink`, the check in `rb-green-dark`, 8 px above the coach's next sentence. One box kind in the transcript: the member's |
| Depth / motion | `Thinking…` pulses a whole sentence (`animate-pulse` on text) | Pulse a 6 px `jh-mute` dot before a static *Thinking…*; text never blinks |
| Depth | Launcher `hover:-translate-y-0.5` — the brand's "no transform on hover" rule (§0.1) | Lift by shadow only (`shadow-jh-3` stays; hover tints ink 4 %) |
| Hierarchy | The eyebrow says which coach; nothing says **how far into it** — a two-hour conversation with no position | A `.section-label` line under the eyebrow, derived in code from the stored keys, not from the model: *Part B · What the market posts*. Zero tokens; the Parts are the prompt's own headings. **Built 2026-11-16** — `lib/engine/coach/parts.ts`, the first part whose keys are not stored, *Hand over* once all are, nothing once complete |
| Spacing | `Composer` button `h-11 px-4` with `.btn-primary`'s `py-3` — two height rules on one button | `btn-primary h-11` only; let the class carry the padding |
| Colour | The error line is `jh-red` — correct, a genuine negative. The quota line is mute — correct | — |

Red budget inside the panel after this: **Send**, and the error line when there is one. Nothing else.

---

## 2. A research job in progress — the new state

**What happens:** the coach says *I'm reading the postings now* and a job runs for one to three minutes. The member is
waiting but not stuck: the page beside is live and the composer is open.

```
┌ panel ───────────────────────────────────────────────┐
│ COACH 2 OF 6 · TRUE NORTH                        ⤢ × │
│ PART B · WHAT THE MARKET POSTS                       │
│                                                      │
│ I'll read the postings for your three competencies   │
│ in Auckland now — a minute or two. Meanwhile, which  │
│ job boards do you already check?                     │
│                                                      │
│ ● Reading postings · 7 of 20              Stop       │   ← role="status"; dot pulses; count is font-mono text-xs
│                                                      │
│ YOU                                                  │
│ Seek and LinkedIn mostly.                            │
│                                                      │
│ ✓ Added 18 postings · View ›                         │   ← the write line, when the job lands
│                                                      │
│ 18 postings opened. Four phrases keep coming back:   │
│ | Phrase | Postings |                                │
│ | … | … |                                            │
│ Which of these would you put on your CV tomorrow?    │
└──────────────────────────────────────────────────────┘
```

| Principle | Decision |
|---|---|
| **Hierarchy** | The job is **a status line**, the same grammar as a write: 6 px dot (`bg-jh-mute`, `animate-pulse` — the one moving pixel), `text-sm text-jh-ink` verb phrase from the job's `progress` field, `font-mono text-xs text-jh-mute` count. Not a card, not a skeleton, not a spinner block. The result's weight goes to the **page**, where 18 rows appear in `CompanyRow` grammar — the table in the transcript is the *review*, three to five rows, never the forty |
| **Spacing** | The line sits in the coach's turn with the turn's 8 px rhythm; the member can keep talking above it (`space-y-6` holds) |
| **Colour** | No red. A job that fails is one `jh-red` line *Couldn't read the postings — try again* with a `.link` retry; a job the member stops is mute *Stopped* |
| **Typography** | The count is the one mono element; the verb phrase is body. No percentage — *7 of 20* says what a bar would and reads at a glance |
| **Depth** | Nothing floats. When the panel is closed and the job finishes, the launcher's red dot already means *your turn* — reuse it; no toast, no badge count |
| **Layout** | The live source is `users/{uid}/engineJobs/{id}` through `useLiveDoc` — the admin tab reads the same document. The status line is one component (`JobStatus`) used by the transcript and, later, by the Target companies page when a scan runs from there |
| **Stop** | A `.link` *Stop*, right-aligned on the status line — tertiary. It sets the job's `cancel` flag (the handler checks it between units). Not `.btn-ghost`: ghost is red |

Rejected: a progress bar (false precision on a count of pages read; the mono count is honest); the job as a card with
its own header (a third box kind); a modal "Researching…" (the whole point of the dock is the page stays live).

---

## 3. CV-first start — the first turn

**Before any conversation**, Coach 1 (and 4, 5 when `cv` is empty) opens on an empty state in the panel body:

```
│                                                      │
│              Start from your CV                      │   ← h2 font-display 20/600 ink, centred (an empty state may be)
│   I'll draft your contact details, headline and      │   ← text-sm jh-mute, max-w-[36ch]
│   competencies from it, and we'll confirm each one.  │
│                                                      │
│            [ Add your CV ]                           │   ← .btn-primary (the panel's one red; Send is not on screen yet)
│            Start without one                         │   ← .link, tertiary
│                                                      │
```

| Principle | Decision |
|---|---|
| **Hierarchy** | One primary action. *Start without one* is a link, not a secondary button — two buttons of equal size would make the choice look balanced when the program's advice is not |
| **Layout** | Centred: the one place centring is right (empty state, short headline, single CTA). `.md`/`.txt` today; PDF through the SDK's document block when added. The file control is the native input behind the button — no drop zone in a 440 px lane |
| **The composer** | Gains one `.icon-btn` (Paperclip, `aria-label="Add a document"`) left of the textarea, 40 px target — so a CV can arrive mid-conversation too. Attached file shows as a `.pill-visible` above the textarea with an `.icon-btn` ×; it is sent with the next turn |
| **Proposals** | The coach's draft comes back **as a table in the transcript** (field · proposed value), ≤ 55ch fits the dock; the member says *yes* / corrects in words; the write happens on yes and the page fills. **No "draft" state on the page**: a proposed value the member has not confirmed never appears beside their real data (it would need a schema and a colour for "unconfirmed", and colour-alone is banned) |
| **Colour** | None beyond the one primary |

Rejected: a two-column "your CV / your profile" diff view (a second rendering of the profile; the page is the rendering);
a wizard step before the conversation (the conversation *is* the step).

---

## 4. Hand-over with code checks

The tool result returns `checks` (pass / fail with the check's own sentence) and `readiness`. The coach shows failures
once, as the prompts already say — a short table — and the completion lands as a write line.

```
│ Two things before we close True North:               │
│ | Check | What to fix |                              │
│ | T3 · 15 postings | 12 opened — 3 more, or we keep  │
│ |                  | the smaller true number        │
│ | T6 · exclude titles | none yet — any to rule out?  │
│ …                                                    │
│ ✓ Completed · True North                             │   ← writeLine() already renders this
│                                                      │
│ Your True North is complete and on the page beside   │
│ you. Coach 3, Target companies, starts from it.      │
│                                                      │
│ [ Open Target companies › ]                          │   ← .btn-secondary, full width
│ CareerOps can run once your Master CV is in.         │   ← text-sm jh-mute (readiness, from code)
```

| Principle | Decision |
|---|---|
| **Hierarchy** | The close line is prose; the action is **`.btn-secondary`** — Send stays the one red, and moving to the next coach is navigation, not the page's primary action |
| **Colour** | A failed check is **not red**: it is a row in a mute table — the page's rail already shows the section as `partial` (`CircleDashed`, mute). Red stays for genuine negatives (a write error) |
| **The rail beside** | The section rows flip to ✓ as the writes land (already live); the coach's row in the rail of six (§5) flips to ✓ on `progress: complete` |
| **Readiness** | One mute sentence from `intakeSteps`, never a banner |

---

## 5. The rail of six

Three homes, one component: **JobHacking → Settings** for flagged members (replacing the six upload slots, `UX_COACH.md
§5`), the panel's body when no conversation has started on this page, and later the expanded page's rail.

```
YOUR COACH                                            ← .section-label
2 of 6 complete                                       ← text-sm jh-mute; the ink progress bar SectionsPage already draws

JOBHACKER COMPASS                                     ← .section-label (the menu's own heading)
✓  Narrative            about 1 hour              ›   ← SectionList rows variant; count slot carries the time
◐  True North           2–3 hours                 ›
○  Target companies     After True North          ›   ← summary text says the gate; glyph stays `empty`

ARTEFACTS
○  Story Bank           After Target companies    ›
○  Master CV            After Story Bank          ›     CareerOps can run from here   ← one mute line under the row
○  LN                   After Master CV           ›
```

| Principle | Decision |
|---|---|
| **Hierarchy** | `SectionList` unchanged — glyph · label (15/600 ink) · summary (14 mute) · chevron. The *state* carries the hierarchy: `done` green check, `partial` mute dashed, `empty` mute-2 circle. **No fourth glyph for "locked"**: the summary line *After True North* says it, and a tappable row that explains beats a dead one |
| **Spacing** | The two groups are `SectionGroupInfo` — the same `.section-label` headings `DesktopSidebar` draws, 24 px between groups, rows `divide-y` inside one card |
| **Typography** | The duration sits where `count` sits (mono xs mute) on desktop; on the row it joins the summary. Labels are the menu's words (`JH_NAV_LABEL`: *LN*) |
| **Colour** | The row in conversation gets the rail's active treatment (`bg-jh-red-soft text-jh-red`) only in the rail variant — the one active-nav red the system allows. In the rows variant, nothing is red |
| **Layout** | The Settings page keeps *Export profile.yml* (`.btn-secondary`) and, under a `.section-label` *Danger*, *Start a coach over* as `.btn-ghost` with a confirm — the one red besides Save on that page, for a genuinely destructive act |

Rejected: a stepper / timeline graphic (a list with states *is* the timeline; a graphic would be a second visual system
for the same six things); per-coach cards with outcome blurbs (six same-sized boxes — "everything looks the same";
the outcome belongs in the panel's first line, not the list).

---

## 6. Empty-row link and the live-write highlight

**The empty section.** Today an empty section shows its `ask` and an editor. Add one line under the ask:
*Fill this in with your coach ›* as `.link text-sm` → `openCoach(coachForPage(page))`, section in the query. Tertiary,
because the section's own **Save** is the red and *Edit …* buttons are already the secondary tier; a third button would
flatten the hierarchy. On mobile the same link opens the full-height sheet.

**The highlight.** When a write lands, the row whose key is in `note.labels` gets `bg-jh-mist` for 600 ms — 150 in,
450 out, ease-out — then returns to white. `prefers-reduced-motion: reduce` → no fade, the value simply changes.
`scrollIntoView({ block: "nearest" })` only when the row is off-screen; never move a member who is reading something
else. One microinteraction, the one that proves the talk and the page are one thing.

---

## 7. Scale check — the whole surface

| Scale | Used |
|---|---|
| Type | 12 (section-label, mono counts) · 14 (summaries, status lines, links) · 15 (transcript, row labels) · 20 (empty-state h2) |
| Spacing | 4 · 8 · 12 · 16 · 24 |
| Radii | 8 (`.btn`, `.field`, `.icon-btn`) · 12 (member block, cards) · pill (launcher, attached-file pill) |
| Shadow | `shadow-jh-3` on the launcher and the docked panel only; `shadow-jh-1` on cards |
| Red | Send · a write error · the rail's active row · *Start a coach over* · the launcher's 6 px *your turn* dot |
| Text colour floor | `jh-mute`; `jh-mute-2` only on the `empty` glyph and the chevron |
| Targets | 44 px rows, 40 px `.icon-btn`, 44 px Send and launcher |

**RUI score after:** 9 / 10 across the six surfaces. The remaining point is the 1024–1279 px question `UX_COACH.md §13`
leaves open (overlay vs a 400 px dock) and the expanded page, which this note does not design.

---

## 8. Build order (matches `COACH_ASSESSMENT_2026-11-16.md §5`)

1. §1 fixes to the built panel (unbox the write line, the dot, no transform, the Part line, one height rule) — one PR, no behaviour change. **Built 2026-11-16**; the Part line landed with the phase's last PR.
2. §5 rail on Settings + §6 link and highlight — the specified UI, no prompt change. **Built 2026-11-16, JobHacking only**: `CoachRail` on JobHacking → Settings (members with the coach; the six slots stay for the others) and in the panel while a coach is gated; *Start a coach over* under *Danger*; the empty-row link and the 600 ms `jh-flash` on `SectionsPage` / `SectionList`, driven by the panel's `write` events through the coach store (`flashSections` → `flashKeysFor`).
3. §4 hand-over with `checks` — with the tool-result change. **Built 2026-11-16**: `lib/engine/coach/checks.ts` runs the coach's checks against the merged profile at every save point and hand-over; the result carries `checks.failed[] {id, check, fix}` (or `"all passed"`), the stored `progress` and `readiness`; a hand-over with a failure is stored `in_progress` so the rail's ✓ waits; the readiness sentence renders mute under the completed write line (`WriteNote.readiness`). The model keeps only what code cannot decide (M1 figure tracing, banned phrases, keeper traceability, hero-metric figures, framing titles). Prompts v4: the hand-over paragraphs name the checks and defer to the result; the turn-length rule is the audit's #5; Part B of Target companies says the portal totals and ranks (#7).
4. §3 CV-first — with the document input. **Built 2026-11-16**: `CvStart` (the empty state, `.btn-primary` *Add your CV* · `.link` *Start without one*) shows for Narrative, Story Bank and Master CV (`coachStartsFromCv`) while `setup.cvMarkdown` is empty and no turn exists; the composer's `.icon-btn` Paperclip attaches a file as a `.pill-visible` that goes with the next turn; the route takes `document: { name, text }` (`.md`/`.txt`, ≤ 60,000 chars) and puts it before the member's words on that turn (`documentBlock`), after the profile on a first turn; the member's turn shows the file name. Nothing is stored from the document — the three prompts' *When a CV is in front of you* paragraph has the coach propose a table and write only what is confirmed. **PDF built the same day**: the browser sends the bytes (`CoachPdf`, ≤ 3 MB), the turn route transcribes them once with one `low`-effort call through the SDK's `document` block (metered on the coach), and from there it is a text document like any other — the stored transcript carries words, not base64.
5. §2 `JobStatus` — with the first research job (`postings`). **Built 2026-11-16**: `components/coach/JobStatus.tsx` reads `users/{uid}/engineJobs/{id}` live — the dot, the verb phrase from `progress`, the mono `n of m`, a `.link` Stop (`DELETE /api/engine/jobs/{id}`); ✓ `Reading postings · 18 found · View ›` when it lands; one `jh-red` line when it fails. A coach turn carries the jobs it started (`TranscriptTurn.jobs`, the `job` stream event). The job's result is written to the page by the handler (`applyCoachPatch`), so the write line is the page's own; the coach gets the 20-row table on its next turn through the operator note (`landedSince`).

---

## 9. The scoring matrix — scored once, in code (2026-11-16)

**Why.** Coach 1 §2 asked four 1–5 questions per skill, one at a time — sixty turns for fifteen skills — and the model
summed and ranked. The rubric lived in prose with one anchor ("prove = 2 if no result in 10 seconds"), so the same prompt
gave every member a different scale; and the table was never stored — only three `leadSkills` survived, so Story Bank could
not see which skills were proven. The fix is the move §4 made for companies: **anchors, totals, ranks, tie-break and flags in
code, the same for every member; the model converses about the result.**

**Where it lives.** `lib/engine/coach/rubrics.ts` is the registry — a `Rubric` is four axes with five anchors each, a
tie-break order, a cut, and bounds; `rankRows` (total = sum; ranked by total, the tie-break axes, then the matrix's order),
`parseRows`, `cleanItems`, `commonFlags` (inflated · flat · tie at the cut), `scoredTable`. Each rubric's own flags and stored
shape sit beside it: `skills.ts` — `SKILL_AXES` (Good at it · Love it · Can prove it · Market pays), ties Prove → Pays → Love,
`TOP_CUT = 6`, `skillFlags` (unproven top-six · loved-not-paid · paid-not-loved), `scoresMessage`; `companies.ts` — §10. Stored on `jhg.narrative.skillScores[] {skill, good, love, proof, pays, total,
rank}` — in the schema shape, in `narrative.yml`, shown read-only beside Core competencies (`CompetencyFacts`). **N7**: once
scored, the lead skills are three of the top six, spelled as scored.

**The conversation.** The coach collects the list (rejecting traits is still its job) and calls **`score_matrix`** with
`kind: "skills"` and the items (`SCORE_MATRIX`; a coach's tool offers only its own rubrics — `coachRubrics`). The route cleans
the list (`cleanItems`, 3–20, de-duplicated), streams a
`matrix` event, stores it on the coach turn (`TranscriptTurn.matrix`) and answers the tool: *end your turn with one line, no
question*. The member scores everything and sends; the route takes `scores[]`, validates them against the pending matrix
(`pendingMatrixOf` — the last one shown with no scored member turn after it), computes, **writes the scores itself through
`applyCoachPatch`** in the rubric's stored shape (the write line reads *Updated Core competencies*), and hands the coach
`scoresMessage` as the member's words. The member's turn in the transcript carries `scored {kind, rows}` and renders as the
scored table (`ScoredRows`) — never the generated prose.

```
┌ panel ───────────────────────────────────────────────┐
│ Here are your fifteen. Score them all, then we talk  │
│ about what stands out.                               │
│                                                      │
│ SCORE YOUR SKILLS · 1–5                              │   ← .section-label; one mute line under it
│ GOOD      LOVE      PROVE     PAYS                   │   ← .section-label header, grid-cols-4
│ ──────────────────────────────────────────────────── │
│ Release management                        17 / 20    │   ← 15 px ink · font-mono text-xs mute, live
│ [ 4 · Oth… ▾][ 5 · Wou… ▾][ 5 · Sev… ▾][ 3 · Ask… ▾]│   ← four native selects, .field h-11, 92 px each
│ ──────────────────────────────────────────────────── │
│ Incident management                        — / 20    │
│ [ Good    ▾][ Love    ▾][ Prove   ▾][ Pays    ▾]    │   ← the axis word is the placeholder option
│ …                                                    │
│ ▸ What the numbers mean                              │   ← <details>, text-sm mute; the anchors, once
│ 9 of 15 scored                     [ Send scores ]   │   ← mono mute · .btn-primary (the panel's one red)
│ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │
│ Or tell your coach what to change…        [ Send ]   │   ← .btn-secondary while the matrix waits
└──────────────────────────────────────────────────────┘
```

| Principle | Decision |
|---|---|
| **Hierarchy** | The skill name is the only ink in a row; the axis words, totals and the legend are `jh-mute`; the four numbers are `font-mono text-xs`. Once sent, the member's block shows ranked rows — rank mute, name ink, the four digits mono mute, the total `font-semibold` ink — and **one `jh-line-2` divider after rank 6: the cut**. No colour carries a judgement; the coach's words do |
| **The scale** | The anchors ride **inside each `<select>`** (`3 · Solid, unsupervised`) so the number is never read alone, and a `<details>` lists them once. Same words for every member, from code |
| **Spacing** | 8 between selects, 12 inside a row (`py-3`), 16 between the form's blocks; the form sits in the coach turn's 8 px rhythm with `pt-2` |
| **Targets** | Native `<select>`, `.field h-11` — 44 px, and the OS picker on a phone. 392 px of body gives 92 px a select; the number is first so truncation costs nothing |
| **Red budget** | While a matrix waits, *Send scores* is the panel's one red; the composer's Send becomes `.btn-secondary` (`Composer tone`) and its placeholder says what it is for — the member can still say "drop Excel". The matrix locks (`disabled`) while the coach writes |
| **Depth** | None added: no card, no shadow. `divide-y` and `border-y` on `jh-line` make the rows |
| **Decided against** | Five-dot ratings (five 44 px targets × four axes = 60 lines for 15 skills); a table with the name as a cell (120 px names truncate to nothing); a Sheet of its own (the matrix is the conversation's turn, not a dialog); a stepper (two taps a number) |

**Files.** `lib/engine/coach/rubrics.ts` · `skills.ts` · `companies.ts` (pure) · `tools.ts` (`SCORE_MATRIX`, `scoreMatrixTool`) ·
`transcript.ts` (`MatrixNote {kind, items, meta}`, `ScoredNote {kind, rows}`, `matrix` event, `pendingMatrixOf`) · `checks.ts` (N7) ·
`turn.ts` (recap) · `app/api/coach/turn/route.ts` · `components/coach/ScoreMatrix.tsx` (`ScoreMatrix`, `ScoredRows`) ·
`Transcript.tsx` · `Composer.tsx` (`tone`) · `CoachPanel.tsx` · `WorkbookPanels.tsx` (`CompetencyFacts`) · Narrative prompt v7,
Target companies v5 · `tests/engine-coach-skills.test.ts`, `tests/coach-score-matrix.test.tsx`.

---

## 10. The companies matrix — Part B of Target companies on the same form (2026-11-16)

**Why.** Part B asked for 160 numbers in the chat — forty companies × four scores, "in batches of five", each batch a
write and a turn. `rankCompanies` already did the arithmetic (§4); the member still typed every number. The scoring
moments across the six coaches are exactly two — Coach 1's skills and Coach 3's fit scores — so the matrix is one
component over a registry, not a second one.

**The rubric** (`RUBRICS.companies`, `lib/engine/coach/companies.ts`): 🚀 Growth signals · 💚 Interest · 🔑 Access · 🧾 Proof,
five anchors each (Access: *nobody, no route* → *someone I can message today*); ties Interest → Proof, as the prompt and
`rankCompanies` already say; **cut = 10** — the Top 10. The rows are **the stored 40**: `score_matrix` with `kind:
"companies"` and no items puts every company on `jhg.targetCompanies.companies` in the matrix (`matrixCompanies`), with a
mute line under each name — *sub-sector · growth signal · knows Sam* (`companyMeta`) — because a company needs more context
than a skill to score honestly; items, when given, must each be a stored company (a rescore of the ones challenged). The
answer is laid onto the stored list (`applyCompanyScores`) and written through `applyCoachPatch`, where `rankCompanies`
ranks it — so the Top 40 on the page **is** the result and no new read-only surface is needed; the write line reads
*Updated Top 40*.

**The flags** (`companyFlags`): the prompt's four challenges where the numbers can tell — *dream* (Interest 5, Access and
Proof ≤ 2), *access with no route* (Access 5 and no `knownContact`), *growth with no source* (Growth 5 and no `growthSource`),
*Proof 5 in the top ten* (the coach asks which competency solves which problem — the one judgement that stays the model's) —
plus the shared inflated · flat · tie-at-the-cut. The coach challenges one company at a time and records each in
`challenges[]`, exactly as before, minus the typing.

**The form at forty rows.** Same `ScoreMatrix`: the axis header is `sticky top-0` inside the panel's scroll container so the
columns stay named through the scroll; **one Send at the end** — batching was what the chat forced, the matrix does not
need it; the member can rescore a handful later through a second, shorter matrix.

**Not scoring, same shell later.** Part C's *Say-It-Loud* (Y/N × 10) and *careers page status* (✓ / corrected / none × 10) are
one-choice-per-row forms the same skeleton could render; left until a member has used the companies matrix.


