# JobHacker Compass — every coach search, assessed for an API call

**Status:** assessment (2026-11-17). Hangs off `docs/AGENTIC_PIPELINE_PLAN.md` (the spine: §3 principle 3 *deterministic
pipeline, few agents*; §4 the steps; §5 the sources by country; §8 phase B) and `docs/COACH_ASSESSMENT_2026-11-16.md §1.2`
(*research is a job, not a turn*). Verdicts follow those two; nothing here changes a decision they made.

**What prompted it.** Coach 3 told a member *"While the tool is unavailable, I'll start from what you already know. Which
companies, in Auckland or Australia, are already on your mind?"* — the model's wording after the Anthropic `web_search`
tool answered with an error instead of results. Coach 3 builds forty companies with five searches a call
(`COACHES[].search`, `lib/engine/coach/keys.ts`) and six rounds a turn (`MAX_TOOL_ROUNDS`, the turn route); the cap ran
out, the coach bluffed, and nothing recorded why (the turn route never reads `web_search_tool_result` error blocks;
`sourcesOf` skips them). The one research job that exists, `postings`, also searches with the model (`POSTINGS_MAX_SEARCHES
= 12`) — a job, but not yet an API call.

---

## 0. The rule for a verdict

Three shapes, in order of preference — the plan's principle 3 applied search by search:

| Verdict | Meaning | Searches in the conversation |
|---|---|---|
| **API** | a structured source exists (plan §5); code queries it in a job, de-duplicates, verifies; the model only extracts or scores a typed result (Haiku) | 0 |
| **Job + search** | no structured source for this step; the model searches *inside a job* with a typed result, every URL opened by code (`urlWasFound` or a GET), the result cached as shared data where it is the same for every member | 0 |
| **Keep** | a one-off wording check, not research: nothing found online becomes a claim, one or two calls at most | ≤ 2 |

A verdict of **API** never means the model stops reading: a posting's JD is still fetched and quoted, a careers page is
still confirmed by an ATS answer, a growth figure still carries the link. It means the *list* comes from a source, not
from a search engine.

---

## 1. The inventory — every search a coach makes today

Read from the six prompts (`lib/engine/coach/prompts/*.ts`), the postings job (`lib/engine/prompts/postings.ts`,
`lib/engine/handlers/postings.ts`) and the growth-source directory (`prompts/knowledge/growth-sources.ts`).

| # | Coach · part | What the search is for | Tool today | Cap | Writes |
|---|---|---|---|---|---|
| 1 | **1 Narrative** · competencies | check 3–5 core-competency phrases against live postings' wording | coach `web_search` | 3 / call | `narrative.superpowers` |
| 2 | **2 True North** · Part B | 15–20 live postings for the competencies + region (+ titles, boards) | **job** `postings`: model search inside `callJson`, then code GETs each URL | 12 / job, 30 URL checks | `jhg.trueNorth.postings` |
| 3 | **2 True North** · Part C | ten growing industries in the geography that buy the primary cluster's problem, each with a growth number and an opened link | coach `web_search` | 5 / call | `jhg.trueNorth.industries[]` |
| 4 | **2 True North** · Part C | a growth number per sub-sector of each picked industry → sunrise / sunset ("no number after two searches → ask the member") | coach `web_search` | same 5 | `industries[].subSectors[].growthSignal · source · outlook` |
| 5 | **3 Target companies** · Part A | the 40, in four passes: leaders and fast growers · competitors expanding · customers and suppliers · companies posting the target titles now — each with a growth signal and a link that is not the company's own site | coach `web_search` | 5 / call | `jhg.targetCompanies.companies[]` |
| 6 | **3 Target companies** · Part A | the careers page that *lists* its jobs (ATS board where one exists), opened; "after two searches, none" | coach `web_search` | same 5 | `companies[].careersUrl · careersUrlStatus` |
| 7 | **3 Target companies** · Part A | a growth number for a sub-sector True North did not cover | coach `web_search` | same 5 | `extraSubSectors` |
| 8 | **3 Target companies** · Part C | the Top 10's careers pages shown with what the coach saw; the member confirms ✓ / corrected / none | coach `web_search` | 5 / call | `top10[].careersUrl · careersUrlStatus` |
| 9 | **3 Target companies** · Part D | the Top 3's dated signal (funding closed, new leader, site opened, hiring wave) with its source | coach `web_search` | 5 / call | `top3[]` |
| 10 | **4 Story Bank** · any | a title or phrase is current market wording | coach `web_search` | 3 / call | — (wording only) |
| 11 | **5 Master CV** · any | same | coach `web_search` | 3 / call | — |
| 12 | **6 LinkedIn** · any | same; headline variants "in the words recruiters search for" | coach `web_search` | 3 / call | — |

Twelve uses; nine are research (2–9), three are wording checks (1, 10–12). Only #2 is a job today. None is an API call.

---

## 2. The assessment — one verdict per search

| # | Verdict | Source (plan §5) | How it runs | What the model still does |
|---|---|---|---|---|
| 2 | **API** | Adzuna `jobs/{nz,au,us,ca}` (primary) · Trade Me `Search/Jobs.json` (NZ; OAuth, terms to check) · Careerjet (AU/US/CA) · SERP `google_jobs` top-up (the one metered line) | the **planner** (Haiku) turns competencies + titles + region into queries; **sourcing** (code) calls the adapters, merges, de-dupes on company · title · location, writes `jobPostings/{source}_{externalId}`; the job keeps 15–20, GETs each posting page | extract 2–3 JD phrases per kept posting (Haiku, one batched call) — the only model call |
| 5 | **API-first job** `companies` | pass *posting the titles now* = `jobPostings` grouped by company (free, already fetched for #2) · pass *fast growers* = the directory's ranking pages per country (Deloitte Fast 50 NZ/AU, TIN200, NZ Hi-Tech, LinkedIn Top Startups) fetched and extracted once per edition into `companies/{domain}` · pass *competitors / customers / suppliers* = **no API**: Crunchbase (paid) or a model proposal verified by code | a job with four units; the first two are code + Haiku; the third is **job + search** with a GET per link; candidates land as 80–100 in `companies/{domain}`, the job keeps 40 by boundary fit (code) and industry match | name the competitor / customer candidates from the picked industries; extract growth signals from the fetched pages |
| 6, 8 | **API** | the **ATS registry** (`_registry.mjs`, 55+ providers) + the public ATS APIs — Greenhouse boards · Lever postings · Ashby · Workable · SmartRecruiters · Teamtailor; Workday / SuccessFactors pages by GET | a `careersPages` job: detect the provider from the company domain, call the board, `careersUrlStatus = confirmed` **by code when the board answers** (plan §5 verification rule); the member's ✓ in Part C stays as the human checkpoint, the coach no longer searches | nothing — "none" is a code result after the registry and a GET of `/careers` · `/jobs` fail |
| 3 | **Job + search, shared** `industries` | official statistics have APIs — Stats NZ (Open Data API), ABS Data API, BLS API, Statistics Canada WDS — but the *list* of ten industries that buy a cluster's problem is judgement; the growth numbers behind them are mostly pages (Infometrics, MBIE sector reports, ABS releases) | one job per member: the model proposes ten from the directory, code opens every source link and drops the dead ones; **cache the result per country × industry** at the top level (`industries/{country}_{slug}` — principle 5, researched once for every member, nightly refresh); the second member in the same geography pays nothing | propose and read; never label from memory (the outlook needs a number and an opened link — a code check, like T5) |
| 4, 7 | **Job + search, shared** — the same `industries` job | as #3; a sub-sector's number is one search when the industry row is cached | the sub-sector outlooks are rows of the same cached document; #7 (Coach 3's extra sub-sector) is one more row, requested through `run_research kind:"industries"` with `subSectors[]` | — |
| 9 | **API where a signal is a count; job + search for the rest** | *hiring wave* = `jobPostings` per company over 30 days (code) · *funding closed* = Crunchbase or the news directory (BusinessDesk, NBR, NZX / ASX announcements — fetched) · *new leader · site opened* = news; SERP `google_news` or the same fetch | the **enrichment** step (plan §4 step 3) writes `companies/{domain}.growthSignal · growthSource` once per company; Coach 3 Part D reads the Top 10's signals from the profile rows and picks three — no search in the turn | pick the three, write the first move |
| 1 | **Keep → lookup** | until phase B: keep, cap 2 (wording only) · after: a `lookup_wording` tool that reads `jobPostings` titles and JD phrases for the region (Firestore, zero search) | — | compare wording |
| 10–12 | **Keep → lookup** | same as #1; Coaches 4–6 run after the postings exist, so the lookup is ready for them first | — | — |

**Summary.** Of the nine research searches, five become API calls outright (2, 6, 8, and the count half of 9, plus the
posting-derived half of 5); three become a job with search and a *shared cache* (3, 4, 7); one is mixed (the
competitor / customer pass of 5, and the news half of 9). The three wording checks stay as two calls each until the
`jobPostings` store exists, then become a lookup. **After phase B no coach needs `web_search` for research**; the caps
drop to the wording minimum (§4).

---

## 3. What this is, in the plan's terms

Nothing new. Every verdict above is a step of plan §4 with a caller:

| Plan step | This assessment's rows | Status |
|---|---|---|
| 1 · planner | queries for #2, #5 | phase B — not built |
| 2 · sourcing — adapters, `jobPostings`, `companies` upserts, ATS detection | #2, #5 (first pass), #6, #8 | phase B — not built; the country enum (decision 7) is its precondition |
| 3 · enrichment — growth signal with source, cached | #5 (growth signals), #9 | phase B/C — not built |
| 4 · fit scoring | #5 keeps 40 by boundary fit | phase C |
| `industries` job (`COACH_ASSESSMENT §1.2`) | #3, #4, #7 | phase B — "follows the `postings` shape" |
| `careersPages` job (`COACH_ASSESSMENT §1.2`) | #6, #8 | phase B |

So "assess every search for an API call" and "build phase B" are the same work. The one addition this assessment makes
to the plan: **`industries` is shared data**, cached per country × industry at the top level like `companies/{domain}`,
not a per-member search — the plan lists it only as a per-member job.

---

## 4. Build order — in data-flow order, one PR each

| # | PR | Builds | Caps after |
|---|---|---|---|
| 0 | `fix/coach-search-errors` — **built 2026-11-17** (`searchErrorsOf · searchErrorNote` in `lib/engine/coach/turn.ts`, `SEARCH_ERROR_WORDS` in `transcript.ts`; the codes on the coach turn and on the session — `lastSearchErrors` for the next turn's note, `searchErrors` totals; one mute line under the turn in `Transcript.tsx`) | the turn route reads `web_search_tool_result` error blocks (`max_uses_exceeded · too_many_requests · unavailable · invalid_input · query_too_long`), logs the code on the session and the usage record, and puts one operator-note line in front of the coach (*"search failed: max_uses_exceeded — say so; do not improvise a list"*). Coach 3's `search` raised to 8 as a stopgap, nothing else. The note rides the same turn when the model goes on to a tool call (a text block after the tool results), else the next turn's operator note | unchanged |
| 1 | `feat/engine-sourcing` — **built 2026-11-17** with PR 2 (`lib/engine/sourcing/`: `keys.ts` country enum · `adzuna.ts` · `careerjet.ts` · `plan.ts` · `ats.ts` · `fetch.ts`; rules for `companies` and `jobPostings`; `.env.example`). Deviations: the planner is **code** (titles × city, then competencies, ≤ 8 queries) until an eval shows Haiku's queries find more; Trade Me and SERP are not wired (decisions §5 1–2); the ATS registry is the six keyless JSON boards, not the upstream 55 | the country enum on the pipeline · `jobPostings/{source}_{externalId}` and `companies/{domain}` with rules (readable by any signed-in member, server-written) · adapters: Adzuna first (NZ + AU + US + CA on one key), then Careerjet, Trade Me behind its terms, SERP behind a config switch · the ATS registry port · the planner (Haiku, structured) | — |
| 2 | `feat/postings-from-sources` — **built 2026-11-17** in the same PR (`handlers/postings.ts`: `viaSources` when an adapter key is set and the region is a pipeline country, else `viaSearch` as before; `PhrasesSchema · phrasesTask · withPhrases` in `research/postings.ts` — one call at `low`, no search, a phrase counts only when the snippet contains it; `result.via` says which path ran). Open: the aggregators carry a **snippet**, not the JD — a GET of the posting page for the full text is the next step for the phrases | the `postings` job reads the adapters, not the model: `POSTINGS_MAX_SEARCHES = 0`; the GET verification and `toProfilePostings` stay; phrase extraction becomes one Haiku call over the fetched JDs. `tests/` keeps the schema contract | Coach 2: 5 → 2 |
| 3 | `feat/companies-job` | `run_research kind:"companies"` for Coach 3 (`COACH_RESEARCH.targetCompanies`), four units as §2 row 5; `careersPages` through the ATS registry for every candidate; the result lands unscored on `jhg.targetCompanies.companies[]` via `applyCoachPatch` and the coach's next turn opens on the table (the Part A conversation becomes *delete · add · approve*, as the prompt already says). Prompt v6 for Coach 3: Part A is "the portal does the search", like Coach 2's Part B | Coach 3: 5 → 2 |
| 4 | `feat/industries-job` | `run_research kind:"industries"` for Coaches 2 and 3; `industries/{country}_{slug}` cache; T5's check reads the cached source | Coach 2 stays at 2 |
| 5 | `feat/enrichment` (plan step 3) | growth signals and sources on `companies/{domain}`; hiring-wave counts from `jobPostings`; Coach 3 Part D reads, never searches | Coach 3: 2 → 1 |
| 6 | `feat/wording-lookup` | `lookup_wording` over `jobPostings` for Coaches 1, 4, 5, 6; `search` → 0 for the four | Coaches 1, 4–6: 3 → 0 |

PR 0 is a fix and goes first. PRs 1–3 are the phase B the plan already names; 4–6 close the remaining rows.

---

## 5. Decisions needed (Rafael)

| # | Question | Proposed default |
|---|---|---|
| 1 | SERP provider — SerpApi `google_jobs` vs JSearch (RapidAPI) — the only metered sourcing line (plan §10) | SerpApi, behind a switch, off by default; Adzuna + Careerjet + ATS cover the first cohort |
| 2 | Trade Me Jobs API terms for this use (plan §10) | ask first; ship NZ on Adzuna + SERP until answered |
| 3 | Crunchbase for the competitor / customer / funding passes, or model proposal + code verification only | model + verification for v1 (cents); Crunchbase when a cohort pays for it |
| 4 | Official statistics APIs (Stats NZ, ABS, BLS, StatCan) in the `industries` job, or the directory's pages fetched and cached | pages, cached; the stats APIs are a later source of the same row |
| 5 | Coach 3's Part A conversation once the 40 arrive from the job — approve in batches of ten as today, or the whole table once | batches of ten, unchanged |

---

## 6. Open items

- Adzuna NZ coverage of Seek NZ for three real target roles — the ten-minute dev-key test in plan §10. **PRs 1–2 ship without a key**: the postings job falls back to the model's search until `ADZUNA_APP_ID · ADZUNA_APP_KEY` (or `CAREERJET_AFFID`) are set on the host; set them and run Coach 2 Part B once to read the coverage.
- Which of the directory's ranking pages extract cleanly (Deloitte Fast 50 is a page per edition; TIN200 is paid).
- `COACHES[].search` is per API call, not per turn: six rounds × five searches today. The caps in §4 are per call too;
  the operator note from PR 0 is what makes a cap honest.
