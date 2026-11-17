# Coach 3 — scoring the 40 with the portal's evidence

**Status:** built 2026-11-17 (`feat/coach-company-evidence`), as designed below with one storage change (§2 *Stored*): the evidence is derived data and lives on `users/{uid}/coachEvidence/companies`, not in the profile — so the schema, the six files and the Packer samples are untouched; `FileFacts` on the page follows. Extends `docs/UX_COACH_AGENTIC.md §9–§10` (the scoring
matrix) and `docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §2 row 5` (the companies job). Nothing here adds a second form, a
page or a route: it is the same matrix, with two of its four columns filled in by code and a reason beside every row.

---

## 0. The ask

Coach 3 scores every company on four signals — 🚀 Growth · 💚 Interest · 🔑 Access · 🧾 Proof. Today the member types all
four from memory in the matrix (§10), and the coach challenges the fives afterwards. Two of the four are facts the portal can
read; two are the member's alone:

| Signal | Whose | The portal's part |
|---|---|---|
| **Growth** | the portal **suggests**, the member confirms or changes | *hiring for the archetype* (postings for the cluster's titles at that company now — `jobPostings`, the ATS board) and *funding / growth event* (the companies job's `growthSignal · growthSource`, dated) |
| **Access** | the portal **suggests**, the member confirms or changes | the member's **LinkedIn connections** (`Connections.csv`, parsed by code) matched to the company — who, in what role |
| **Interest** | the member | context only: how the company sits against their boundaries (location, company type, never-join, culture must-haves) |
| **Proof** | the member | context only: what the company posts for (the postings' phrases) beside the member's core competencies |

**Rule, unchanged from §9:** code fills, flags, totals and ranks; the member decides; the coach converses. A suggested number
is still the member's number once sent — they can change any of the four, and a changed suggestion is recorded so the coach
can ask why.

---

## 1. The flow

```
Part A  companies job lands (40 rows: signal · source · careers page)                      ← built (PR 3)
        ↓
Part B  coach: "Before you score, two things make this honest: your LinkedIn connections,
        and the postings. Upload Connections.csv — I never read it; the portal matches names."
        ↓
        member attaches Connections.csv (Paperclip, or the matrix header's own prompt)
        → the route parses it in code, matches Company → the 40, stores the matches,
          answers the coach with counts only ("31 connections match 14 of the 40")
        ↓
        coach calls score_matrix kind "companies" (no items: every stored company)
        → the route builds, per company: suggested Growth + why · suggested Access + who ·
          Interest context · Proof context   (lib/engine/coach/evidence.ts, pure)
        → the panel shows the matrix with Growth and Access pre-filled and the evidence under each name
        ↓
        member sets Interest and Proof for every row, changes any suggestion, sends once
        → route: rankCompanies, flags (incl. "changed a suggestion"), writes scores + evidence,
          hands the coach the scored table + what was overridden
        ↓
        coach challenges from the flags, one company at a time (unchanged)
```

Where the CSV never goes: the model. The route reads it, matches, stores; the coach hears "14 of 40 have a connection", never a
name list in the transcript. Names reach the coach only as they already do — `knownContact` on a company row the member
confirmed.

---

## 2. The evidence, in code (`lib/engine/coach/evidence.ts`)

Every suggestion is a function of stored data and the rubric's own anchors (`rubrics.ts` — the words the member sees inside the
select). Nothing is judged by the model.

**Growth — suggested from two facts**

| Fact | Where | Read |
|---|---|---|
| hiring for the archetype | `jobPostings` where `companyKey` matches and `title` matches a cluster title / target title, posted ≤ 30 days; else the ATS board's count (`confirmCareersUrl`) | *"hiring 3 Product roles now (Seek, 12 Nov)"* |
| growth event | `companies[].growthSignal · growthSource` from the job (opened by code) | *"Series B NZD 20m — BusinessDesk, Sep 2026"* |

| Suggest | When |
|---|---|
| **5** *Funding, hiring wave or expansion this quarter* | archetype postings now **and** a dated event ≤ 90 days |
| **4** *Several dated signals* | archetype postings now, **or** two dated events ≤ 12 months |
| **3** *One recent signal* | one dated event ≤ 12 months, no archetype postings |
| **2** *Steady, nothing new* | a signal without a date, or older than 12 months |
| **1** *Shrinking or silent* | nothing on file |

**Access — suggested from the member's connections**

| Suggest | When |
|---|---|
| **5** *Someone I can message today* | ≥ 1 first-degree connection at the company (`Connections.csv` Company ≈ name) |
| **3** *A community, event or posting* | no connection, but an archetype posting now (a route exists) |
| **1** *Nobody, no route* | neither |

Second-degree (4) and cold application (2) are the member's to set — the portal cannot see them. A connection whose `Position`
matches a hiring-authority or peer title (the cluster's titles, "Head of", "Director", "VP", "Chief") is named first in the
evidence line, so the member knows which 5 is a strong 5.

**Interest — context, no suggestion**

One line from the boundaries: *"Auckland · scaleup — within your boundaries"* · *"Sydney — outside Will-work-in; remote: yes"* ·
*"on your never-join list"* (should not be here — C7). Culture must-haves are not readable; the line says nothing about them.

**Proof — context, no suggestion**

The company's postings' phrases beside the member's competencies, matched on words: *"they post for 'roadmap ownership',
'stakeholder alignment' — you have Stakeholder alignment"*; when nothing posted: *"no postings read — a guess unless you know
their problem"*. The phrases are the ones the postings job quoted (verbatim from the JD), never written here.

**Stored.** `users/{uid}/coachEvidence/companies` — `{ byName: { [company]: CompanyEvidence }, suggested: { [company]: (n|null)[] },
connections: { total, matched } | null, final: { [company]: { values, overrides } }, builtAt, scoredAt }` (`lib/engine/coach/evidence-server.ts`).
Derived data, regenerated on every `score_matrix`, server-written, owner-readable — **not** on the profile, so `scores` stays the
member's final numbers in the one schema and nothing in the six files changes. The coach and the admin read the difference
between `suggested` and `final`. Showing it read-only beside a Top 40 row (`FileFacts`) is the next step.

---

## 3. The LinkedIn connections (`lib/engine/coach/connections.ts`)

- The file: LinkedIn → Settings → Data privacy → *Get a copy of your data* → **Connections** → `Connections.csv`. Three note lines, then
  `First Name,Last Name,URL,Email Address,Company,Position,Connected On`. Thousands of rows; email usually blank.
- **Parsed by code on the turn route**, like a PDF is transcribed there — never a model call, never in the transcript. `isCoachDocumentName`
  grows to `.csv`, recognised by its header as the connections file (any other CSV is refused with one line).
- **Matched by company name**: normalised (`slug`, drop Ltd/Limited/Pty/Inc/NZ/Group), exact first, then token containment; a match
  below two tokens needs the member's confirmation in the evidence line ("*Halter* matched *Halter Ltd* — right?"). Ambiguous names (one
  word, generic) are left to the member.
- **Stored**: the matches per company (`evidence.access.contacts`, ≤ 5 named, the rest counted) and the whole list under
  `users/{uid}/connections/{id}` — owner-readable, server-written — so the next companies job re-matches without a second upload.
  `lib/member-data.ts` lists it (reset coach · reset all · delete cover it). The email column is **dropped at parse**; URL and
  `Connected On` are kept.
- **Said to the member once, in the matrix header, before the file is asked for:** *"Your connections stay in your account; your coach
  sees counts, not names, unless you name someone."*

---

## 4. The matrix, with evidence

The same `ScoreMatrix` (`§10`), one variant: rows carry `evidence`, two selects arrive filled. Grayscale first; the design is the
same three levers — size, weight, colour — and the same red budget.

```
┌ panel (docked, 440) ─────────────────────────────────────────┐
│ Score the forty. Growth and Access are filled from what the   │
│ portal found — change any you disagree with. Interest and     │
│ Proof are yours.                                              │
│                                                               │
│ SCORE YOUR COMPANIES · 1–5                                    │ ← .section-label
│ Growth and Access are suggested from your postings and your   │ ← text-sm mute, one sentence
│ LinkedIn connections (31 match 14 companies). ▸ Why these     │
│ GROWTH     INTEREST    ACCESS     PROOF                       │ ← sticky .section-label header
│ ───────────────────────────────────────────────────────────── │
│ Halter                                              — / 20    │ ← 15 px ink · mono mute, live
│   Growth 5 · hiring 3 Product roles now (Seek, 12 Nov) ·      │ ← text-xs mute, wraps (2 lines max)
│   Series B NZD 20m — BusinessDesk ›                           │    the source is a .link, the only link
│   Access 5 · Jane Doe, Head of Product · Tom Lee, +2 more     │ ← text-xs mute; names in jh-body
│   Proof · they post for "roadmap ownership", "discovery" —    │
│   you have Product discovery                                  │
│ [ 5 · Fun…▾][ Interest ▾][ 5 · Som…▾][ Proof   ▾]             │ ← filled selects read as filled;
│ ───────────────────────────────────────────────────────────── │    empty ones carry the axis word
│ Xero                                                — / 20    │
│   Growth 3 · one signal: FY26 result +11% — NZX, Aug 2026 ›   │
│   Access 1 · no connection on file                            │
│   Interest · Wellington — outside Will-work-in; remote: yes   │ ← context without a number
│   Proof · no postings read — a guess unless you know          │
│   their problem                                               │
│ [ 3 · One…▾][ Interest ▾][ 1 · Nob…▾][ Proof   ▾]             │
│ …                                                             │
│ ▸ What the numbers mean                                       │
│ 12 of 40 scored                           [ Send scores ]     │ ← mono mute · .btn-primary (one red)
└───────────────────────────────────────────────────────────────┘

wide (§11): name + evidence block (max-w-prose) · four selects (7rem) · total — one row ≈ 3 lines
```

| Principle | Decision |
|---|---|
| **Hierarchy** | Three levels, unchanged: the company name is the only 15 px ink; the evidence is `text-xs jh-mute` with the **people's names and the matched competency in `jh-body`** (the one thing in the evidence the member must read); the four digits are mono. A filled select is visually the same control as an empty one — the number inside and the evidence line say it was suggested; no badge, no tint. The source link is the row's one `.link` |
| **Evidence is a block, not a tag line** | §10's one truncated meta line cannot carry a reason. Each row gets up to four short lines, each starting with the axis word in `.label` weight (`Growth 5 ·`, `Access 5 ·`, `Interest ·`, `Proof ·`), wrapping to two lines then clamped (`line-clamp-2`). A row reads top-down: *what we know → what you decide* |
| **Spacing** | 4 between evidence lines, 8 between the evidence block and the selects, 12 inside a row, 16 between the form's blocks — the scale, nothing new. Forty rows at ~5 lines each is long: the sticky axis header, `done of 40` and *Expand for more room ›* carry the scroll |
| **The scale** | Anchors stay inside every select; a suggested value shows as `5 · Funding, hiring wave…` like any chosen value. The `<details>` legend gains one line: *"Suggested numbers come from your postings, the company's growth source and your connections — change any you disagree with."* |
| **Progress** | `done` counts rows with all four numbers — suggested ones count, so the member's work is the two empty columns; the counter says *12 of 40 scored*, not *24 of 80 numbers* |
| **Overrides** | A changed suggestion is sent as `{ item, values, overrides: ["access"] }`; `ScoredRows` shows the four digits with the changed one in `jh-body` (not red — a change is not an error) and a mute `was 1` beside it; the coach's flags gain *"You raised Access at Xero from 1 to 4 — who or what is the route?"* and *"You lowered Growth at Halter from 5 to 3 — what do you know?"* |
| **Missing connections** | While no `Connections.csv` is on file, Access is suggested from postings only (3 or 1) and the header's sentence says so with the one action: *"Access is a guess until you add your LinkedIn connections — [Add Connections.csv]"* as a `.btn-secondary btn-sm`; adding mid-matrix re-suggests Access in place (the draft keeps the member's other numbers) |
| **Red budget** | Unchanged: *Send scores* is the panel's one red while the matrix waits; the composer's Send is secondary. No colour on suggestions, overrides, links or counts |
| **Depth** | None added. `divide-y` on `jh-line`. The evidence block has no background — a tint for forty rows would fill the panel grey |
| **Targets** | Native selects `.field h-11`; the source link is a 44 px-tall inline target (`py-2`) |
| **Decided against** | A "portal" badge on suggested selects (a fourth visual element per row for no new information — the evidence line already says it); showing all connections in a sheet (names in a list the coach cannot see is a page, not a turn — the member has LinkedIn for that); letting the model write the evidence lines (every line here is a template over stored facts); auto-sending the suggested Growth/Access without the member (a number the member did not confirm is not theirs — principle 8) |

**Refactoring UI score, as designed: 9/10.** Hierarchy holds the blur test (name → evidence → controls → totals); spacing is on
the scale; one link, one red; grayscale works. The point lost is density: forty rows × five lines is a 200-line scroll docked —
mitigated by the sticky header, the counter and *Expand*, not solved. The alternative that would reach 10 — ten rows a page — was
decided against in §10 (the matrix is scored once, as one turn) and stays so; the wide panel is the answer to the long scroll.

---

## 5. Changes, by file

| File | Change |
|---|---|
| `lib/engine/coach/evidence.ts` **new, pure** | `growthSuggestion(company, postings, today)` · `accessSuggestion(company, contacts, postings)` · `interestContext(company, boundaries)` · `proofContext(postings, competencies)` · `evidenceFor(…)` → `CompanyEvidence`; the thresholds above as constants. Tested |
| `lib/engine/coach/connections.ts` **new, pure** | `isConnectionsCsv(text)` · `parseConnections(text)` (drops email) · `matchConnections(connections, companies)` with the name normalisation. Tested |
| `lib/engine/coach/rubrics.ts` | `MatrixRow.overrides?: string[]`; `parseRows` accepts them; `MatrixNote.evidence?: CompanyEvidence[]`, `MatrixNote.suggested?: (number \| null)[][]` |
| `lib/engine/coach/companies.ts` | `companyMeta` → `companyEvidence` lines; `applyCompanyScores` stores `evidence` beside `scores`; `companyFlags` gains `override_up` / `override_down`; `companyScoresMessage` lists the overrides |
| `lib/engine/coach/turn.ts` | `isCoachDocumentName` + `.csv`; the connections file is handled on the route, never passed to the model |
| `app/api/coach/turn/route.ts` | a `.csv` attachment → `parseConnections` → `users/{uid}/connections` + re-match → one line to the coach (counts); `score_matrix kind:"companies"` → `evidenceFor` per stored company → `matrix` event carries `evidence` + `suggested`; `scores[]` with `overrides` |
| `components/coach/ScoreMatrix.tsx` | `evidence` + `suggested` props: pre-filled draft, the evidence block per row, the header sentence + *Add Connections.csv*, the legend line; `ScoredRows` shows overrides |
| `components/coach/Composer.tsx`, `CvStart.tsx` | `accept` grows to `.csv` (Composer only — a CSV is never a CV start) |
| ~~`lib/careerops/types.ts`, `profile-schema.ts`, `tools.ts`~~ | not touched — the evidence is derived data on `coachEvidence/companies` (`lib/engine/coach/evidence-server.ts`), never a profile field |
| `lib/member-data.ts`, `firestore.rules` | `connections` and `coachEvidence` subcollections — owner read, server write; listed for reset / delete |
| `lib/engine/coach/prompts/target-companies.ts` v7 | Part B: ask for `Connections.csv` first (one line on privacy), then call `score_matrix`; read the overrides back; never ask Access or Growth row by row |
| `components/jobhacking/FileFacts.tsx` | the evidence read-only beside a Top 40 row — **next step**, reads `coachEvidence/companies` |
| `docs/UX_COACH_AGENTIC.md §10` | a pointer to this note |

**Build order:** `connections.ts` + `evidence.ts` with tests (pure, half the work) → route + types → `ScoreMatrix` → prompt v7 →
`FileFacts`. One PR.

---

## 6. Decisions needed

| # | Question | Proposed |
|---|---|---|
| 1 | Keep the whole `Connections.csv` under the account (re-match on every companies job) or only the matches | **keep it**, email dropped; it is the member's own export, and re-matching is the point |
| 2 | Suggest Access **4** when the connection is old (`Connected On` > 3 years) | **no** — the anchor says *second-degree*; an old first-degree is still a message away |
| 3 | Let the member upload the CSV from the Target companies page too (outside the coach) | **not in this PR** — the coach asks for it where it is used; the page can offer it later behind the same route |
| 4 | Show `evidence` on the share document (`/share/<token>`) | **no** — connections are private; the share stays scores and lists |
