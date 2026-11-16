# The coach as an agentic workflow — assessment (2026-11-16)

**Spine:** `docs/AGENTIC_PIPELINE_PLAN.md` — this note is its phase A.

**Ask (Rafael, 2026-11-16):** on the JobHacking portal, move the coach from a chat to a more agentic workflow that helps a
member build the profile and the support files CareerOps reads; keep the menu as it is (JobHacker Compass · Artefacts);
add or remove fields where it matters; bring the cost down. **Correction (same day):** the Pi is no longer the brain — the
brain is the Claude engine in this repo (`docs/CAREER_OPS_CLAUDE.md`); the alternative on the table is Claude's Managed
Agents (§4). **UX:** the Refactoring UI pass on every surface this note adds is `docs/UX_COACH_AGENTIC.md`.

**Method:** a read of `main` at `82f84e1` — the engine (`lib/engine/*`), the six prompts, `update_profile`, the registry
(`lib/jobhacking/sections.ts`), what each reader consumes (`lib/careerops/profile-yaml.ts` for the Pi, the setup document
for the engine), the two specs (`docs/UX_COACH.md`, `docs/CAREER_OPS_CLAUDE.md`) and the prompt audit of 2026-11-12 —
against Anthropic's cost-optimization method (free wins before tradeoffs, one lever per diff, nothing kept without a
measurement). **No usage was measured:** the meter (`users/{uid}/claudeUsage/{YYYY-MM}`) is the source of truth and I
could not read it from here; every cost figure below is a code estimate in relative terms, to be replaced by Admin →
Claude → Usage before any tradeoff is taken.

---

## 0. Where it stands — verified against the code

| Built | Not built (still in `docs/UX_COACH.md`'s plan) |
|---|---|
| Six coaches, each a prompt + `update_profile` closed to its own keys, writing through the upload's path (`applyCoachPatch` → `mergeProfile` → one `setDoc`, `profileYaml` and `portalsYaml` rebuilt) | The expanded `/jobhacking/coach` page and its rail of six (the only place a member would see *2 of 6 complete · next: True North*) |
| Launcher + docked panel that follows the page; one mute hand-off line; the panel starts a conversation by itself | The empty-row link from a section to its coach (`SectionsPage` has no reference to the coach) |
| Streaming SSE, writes as `role="status"` lines, up to 6 tool rounds a turn | The 600 ms row highlight on a live write |
| Caching: two system blocks at 1h (prompt · knowledge), the conversation at 1h, the page/section as a mid-conversation `system` message | §5 — Settings for a flagged member: the six upload slots still render; nothing shows the coach rows |
| Validator warnings in the tool result; every tool parameter described; the search instruction for Sonnet (audit #1–#4) | §6 — *The member changed Salary range by hand* note on the next turn (a member's own page edit is invisible to the coach) |
| Transcript bounded at 256 KiB with a recap restart; the meter per coach and per model; `config/engine` + prompt overrides; the quota (off) | Audit #7 (totals and ranks in code), #5/#6 (shorter prompts once the schema carries the rules), #8 (Coach 3 prints Coach 2's opening) |
| `features.coach` gate, admins always; the engine foundation — job document, QStash, signed `run`, handlers | **Any CareerOps module on the engine.** `ENGINE_JOB_TYPES = ["ping"]`; `HANDLERS = { ping }`. The Pi still runs CareerOps today. No eval for the coach. |

Two facts set the frame for everything below:

1. **The coach is an interview, not an agent.** It asks one question at a time for one to four hours a coach; the member
   dictates; the model types it into the profile. The only autonomous work is web search inside the turn — up to 30
   searches a turn on coaches 2 and 3, in the member's waiting time, with the results sitting in the transcript for the
   rest of the session. That is the shape to change.
2. **The brain is this repo's engine — decided and founded, not yet populated.** The engine reads the *whole* setup
   document (stories, proof points, the `jhg` working blocks, the ranked lists, the LinkedIn block); the Pi reads only
   `cvMarkdown` + `profileYaml` + `portalsYaml`, and is transitional. So every field is weighed in §2 by **the engine's
   modules** (Evaluator · Tailor · Writer · Researcher · Scout, `docs/CAREER_OPS_CLAUDE.md §3`) — which makes the coaches'
   working material (clusters, keepers, story facts, Top 10 theses) *inputs*, not overhead — and the Pi's `profile.yml`
   contract is kept only while the Pi still runs. The research jobs of §1.2 are the natural **first modules** on the
   engine: the Researcher and the Scout's second pass, written once, used by the coach today and by the portal later.

---

## 1. From interview to agent — five moves

Ranked by what they do for the member first, with their cost effect noted. None changes the menu.

### 1.1 Start from what the member already has, not from a blank page

Today every coach starts from an empty profile and asks. Most members arrive with a CV and a LinkedIn profile. The
agentic shape: **the first turn of Coach 1 offers to read a CV** (markdown or text today — `isTextCvFile`; a PDF is a
small addition through the SDK's document input) and drafts contact details, headline, competencies and the bridge
story *as proposals*; the conversation becomes *confirm, correct, sharpen* instead of *dictate*. The prompts' rule holds —
"never fabricate the member's data" — because the source is the member's own document and nothing is written without a
yes. Coach 4 (Story Bank) does the same with the CV's bullets: each becomes a candidate story to verify, which is the
Gem's method anyway. Coach 5 (Master CV) starts from the stored `cv` when there is one.

This is not the retired six-file upload (decision 5): it is one document the member already owns, and the CV is a
required CareerOps input regardless (`setup.cvMarkdown`). *Narrative in about an hour* becomes about twenty minutes.

- Where: the turn route — when a CV is attached (or `setup.cvMarkdown` exists and the coach's keys are empty), add it to
  the first user turn as a document block; the prompt gets one paragraph ("When a CV is in front of you, draft from it
  and confirm; ask only what it does not say").
- Cost: fewer turns per coach — the largest single reduction, since cost grows with turn count.

### 1.2 Research is a job, not a turn — and the engine's first modules

Coaches 2 and 3 do the heavy work the program is known for — 15–20 live postings, ten industries with growth numbers,
forty companies with careers pages — inside the chat, under the 300 s route limit, five searches a call, six calls a turn.
The engine already has the other shape built and idle: `engineJobs` + QStash + `/api/engine/run` + structured outputs
(`callJson`). Make each research step **one job with a typed result**:

| Step | Job (structured output) | Writes | The conversation then |
|---|---|---|---|
| True North Part B | `postings`: competencies + region → 15–20 postings (title · company · location · url · phrases · verified) | `jhg.trueNorth.postings` | shows the table, asks keeper / title / cluster decisions |
| True North Part C | `industries`: primary cluster + geography → 10 industries with growth signal + source | shown, member picks → `jhg.trueNorth.industries` | the pick and the sub-sector outlooks |
| Target companies Part A | `companies`: industries + sub-sectors + boundaries → 40 candidates with careers URL + status | `jhg.targetCompanies.companies` (unscored) | the member's four scores per company, in batches |
| Target companies Part C | `careersPages`: Top 10 → opened and verified URLs | `careersUrl · careersUrlStatus` | confirmation only |

The coach's turn says *I'm reading the postings now — a minute or two*; the panel shows the job's live progress (the
job document is already read live by the admin tab); the result lands on the profile and the next turn discusses it.

- Why it is the agentic move: the member stops waiting on search while a 300 s route counts down; a job can retry, can
  run more than six rounds, can run several units in parallel (one message per industry), and its result is typed and
  validated by code rather than typed by the model into a 40-row tool call.
- Why it is the right first port: `postings` and `companies` are the Researcher and the Scout's pass 2 of
  `docs/CAREER_OPS_CLAUDE.md §3` with a different caller. The handler, the prompt, the schema and the eval are the same
  code the Target companies page will call later to score a posting or refresh a careers page.
- Cost: the search results never enter the transcript. Today each result block is written to the cache once and re-read
  on every later call of the session; the transcript restarts (256 KiB) that research sessions hit come from exactly this.
  With research as a job, the conversation carries a 20-row table instead of hundreds of KB of pages.

### 1.3 Code checks, the model converses

The hand-over checks (N1–N6, T1–T7, C1–C7, S1–S4, M1–M4, L1–L4) are run by the model, by hand, at the end of each coach.
Audit #7 already names the fix for totals and ranks; generalise it: `applyCoachPatch` returns a **`checks` list** in the
tool result (what passes, what does not, in the check's own words), computed by code from the stored profile, and the
prompt's hand-over section becomes "call `update_profile` with `progress: complete`; if the result lists failed checks, fix
them with the member". The model never recounts forty totals or re-measures a headline.

- Also: `readiness` on the same result — *CareerOps can run from here* once `cv` and the goal and one watched company
  exist (`intakeSteps` is the function; it is zero tokens). The coach says it; the rail (1.5) shows it.

### 1.4 The coach sees the page, and the page points at the coach

Two halves of one loop, both specified and neither built:

- **Member edits reach the coach.** Before each turn, diff the coach's own keys against what they were after its last
  write (store a hash or the stored YAML slice on the session) and append *The member changed Salary range by hand:
  AUD 190,000–230,000* as the per-turn `system` message beside the page context — cache-safe, no history edit.
- **Empty rows open the coach.** `SectionsPage`'s empty row gets *Fill this in with your coach ›* → `openCoach(coachForPage)`
  with `?section=`; the coach already receives the section and the prompt already says "let's do this one works".
- **The write highlight** (600 ms `bg-jh-mist` on the row that just changed) — the one microinteraction that makes the
  docked panel worth docking.

### 1.5 One progress model across the six — and a quick path to CareerOps

The coaches are strictly sequential (`missingBefore` → 409). That is the program's pedagogy and should stay the *default*
path. But the member has no view of the whole: no rail, no *next*, no *what CareerOps still needs*. Build the §3 expanded
page's rail as a list first (the cheap version — the two menu headings, six rows, state glyph, *about 1 hour*, *After True
North*, *N of 6 complete*) on JobHacking → Settings for flagged members (§5) and as the panel's empty state; make the
*next* row the launcher's tail label.

One deliberate exception to the order: **Master CV is the CareerOps unlock** (`docs/UX_COACH.md §12`). A member with a CV
should be able to put it on the Master CV page on day one (the page's `CvPanel` already allows this) and have the Master
CV coach *refine* it later, rather than wait four coaches. The gate stays for starting the coaching conversation; the
page itself was never gated.

**What stays as it is:** the docked panel (B of §3), one question at a time, the opening and close lines, the
non-negotiables, the single `update_profile` tool, prompts in the repo with admin override, the two menu groups.

---

## 2. Fields — keep · show · add · retire (menu unchanged)

Weighed by who reads each field, **the engine's modules first** — Evaluator (scores a posting against True North: clusters,
keepers, boundaries, titles), Tailor (the CV from the Story Bank: stories, story facts, house rules, locked sections),
Writer (answers, cover letters: bridge story, standard answers, notes), Researcher (company intelligence: Top 10 theses,
hiring-authority titles, known contacts), Scout (careers pages, title keywords) — then the JobHacking pages, then the
Pi's `profile.yml` while it still runs. The menu does not change; a *section* on an existing page does, where noted. Every
row is a candidate for Rafael's call — the program owns the fields.

**Kept without question — the working material the engine will read:** `jhg.trueNorth.boundaries · keepers · titles ·
clusters · industries`, `jhg.targetCompanies.companies[].scores · top10[].thesis · businessProblem · hiringAuthorityTitle ·
knownPerson · top3[].whyNow · firstMove`, `jhg.artefacts.storyFacts · cvHouseRules · lockedSections · currentDomain`,
`stories · narrative.proofPoints · snapshots`, `linkedin.*`, `notes`. On the Pi these were "stored, not read"; on the engine
they are the inputs that make a tailored CV or a score *the member's* and not the template author's.

### 2.1 Show what the coach already writes but the JobHacking member cannot see

| Field | Written by | Today | Proposal |
|---|---|---|---|
| `policy.visaStatus · authorizedIn · needsSponsorship` (**Work rights**) | Coach 2 Part A | section `only: "compass"` — invisible on JobHacking; the Evaluator treats a posting that won't sponsor as a hard blocker | drop the `only` flag: show **Work rights** under True North on JobHacking too (a section, not a menu row) |
| `personalization.portfolio` (**Portfolio / demo**) | Coach 4 Part B | `only: "compass"` | show under Story Bank as a second section (the page has one section "for now") |
| `notes` — hard no's, never-apply, culture must-haves, notice period, CV house rules | Coaches 2, 3, 5 | Compass-only *Notes for the agents*; every agent reads it whole | a read-only *What your agents are told* block beside **Boundaries** — the member should see the literal text an agent acts on |

### 2.2 Two mappings — only while the Pi still runs

`buildProfileYaml` derives `narrative.headline` from `goal.role + subsector` and ignores the coach's `narrative.headline`
(it reaches `candidate.title` through `contact.title`), and collapses `narrative.superpowers[]` into one
`crossCuttingAdvantage` entry. The engine reads the setup document directly, so neither matters once the modules run here;
fix them (prefer `narrative.headline`; emit the list) only if the Pi stays in service past the first port. Otherwise
leave `profile-yaml.ts` alone and retire it with the Pi.

### 2.3 Add — only what a reader needs and no page has

| Candidate | Reader | Where it would live |
|---|---|---|
| **Standard answers** — work rights, salary expectation, notice/start date, why this company, relocation — the Writer's `careerOpsAnswers`, today asked on the Compass Apply screen only | Writer | a section under **Story Bank** (*Answers you give every time*); most of its values are already in Boundaries and can be pre-filled by code, not by a conversation |
| **Availability / start date** | Evaluator, Writer | one field in **Boundaries** (`noticePeriodDays` exists; a date is what a form asks) |
| **A CV document as input** (PDF) | the coach, 1.1 | an attach control in the composer; stored as `cvMarkdown` after the member confirms the extraction |

Nothing else. The schema already carries more than any reader consumes.

### 2.4 Retire or stop asking — collected at conversation cost, read by no module built or planned

| Field | Why it is on the list | Proposal |
|---|---|---|
| `jhg.identity.twitter · alternateEmails · contactNote · preferredChannel` | four questions in Narrative §1; no page shows them, no module reads them | stop asking; keep the keys for uploaded files |
| `jhg.trueNorth.postings[].phrases` (2–3 verbatim JD quotes × 15–20 postings) | the heaviest working block; the Evaluator reads `keepers` (3–5), not the raw quotes | the research job keeps phrases in the job result; the profile keeps `keepers` and the postings' title · company · url |
| `jhg.targetCompanies.challenges[]` | written, read nowhere | drop from the conversation |
| `jhg.targetCompanies.top10[].sayItLoud` | a Y/N with no consumer | drop unless the program uses it in the live session |
| `jhg.artefacts.languageLearning[]` | niche; the Master CV coach spends turns on it | ask once; no drafting |
| `linkedin.education · certifications` detail (years, issuer, credential link) | the member types these into LinkedIn directly; the coach drafts nothing | take them from the CV without asking; leave blanks blank |
| `companyLists.all · top10 · top3` **and** `jhg.targetCompanies.companies · top10 · top3` | the same forty companies stored five times; every Story Bank / Master CV / LinkedIn session's first turn carries all five | keep one source (`jhg.targetCompanies`) and derive `companyLists` on read (`jhSectionSummaries` already derives) — a schema change with `public/*.example.yml` and `tests/profile-files-examples.test.ts` updated together |

---

## 3. Cost — the profile and the levers

### 3.1 Where the tokens go (code read; no measurement)

Per call, in request order: `tools` (one `update_profile` schema — ~1–5K tokens, Target companies the largest) →
`system` (prompt ~2.5–3K tokens; knowledge file ~3K on coaches 2–5; both cached 1h, **shared across members** for the same
coach) → `messages` (first turn: the whole profile as YAML — small for Coach 1, large from Coach 4 on, see 2.4's last row;
then the history, including every web-search result block; cached 1h, per member). A turn runs up to 6 calls; each call
re-reads the whole prefix at the cache-read rate and writes its new tail at the cache-write rate.

Relative buckets, largest first:

| Rank | Where the cost is | Why |
|---|---|---|
| 1 | **Web-search results in the transcript** (coaches 2, 3) | each result block is written to the cache once at the 1h write rate (2× input) and re-read on every later call of a 2–4 hour session; up to 30 searches a turn at $0.01 each plus their pages; they are what pushes a session past 256 KiB into a cold restart |
| 2 | **Cache writes at the 1-hour rate on the conversation tail** | every turn's new content (member text, coach text, tool call, tool result) is written at 2× the input price. A member in conversation types every one to three minutes; the 1h TTL buys protection against pauses that are rare inside a session |
| 3 | **Turn count** | six conversations of 30–100 turns each; cost per session grows with roughly the square of turns before caching, linearly after. Fewer turns (1.1) beats every per-token lever |
| 4 | **Opus 5.5 for a chat workload** | at `low`, the right starting effort; the model is the tradeoff lever, not the first move |
| 5 | The first-turn profile on coaches 4–6 | the whole profile, five copies of the company lists included — paid once per session and again at every restart |
| 6 | Output tokens | turns are short by design; `max_tokens` 32,000 is a backstop, not a cost |
| — | Knowledge files, tool schema, the operator note | small, cached, shared; nothing to do |

**The meter under-reports cache writes.** `DEFAULT_PRICES.cacheWrite` is the 5-minute rate (1.25×: $5/MTok on Opus) and
the comment promises a `cacheWriteFactor` in config that does not exist; the route caches at 1h, which the API bills at
2× ($8/MTok). Every `estimatedUsd` on the admin tab is low on that line. Fix before reading the month: price cache writes
by the TTL the call used (or carry both rates in the table).

### 3.2 Ranked shortlist — by savings ceiling, not application order

| Lever | Type | Ceiling (code estimate) | What it needs |
|---|---|---|---|
| Research as jobs with typed results (1.2) | free win (architecture) | **largest** on coaches 2–3: removes search pages from the transcript and most restarts | the job types `postings · industries · companies · careersPages`, their schemas, a prompt paragraph per coach |
| Start from the member's CV (1.1) | free win | **large**: fewer turns on coaches 1, 4, 5 | document input on the first turn; one prompt paragraph |
| Conversation cache at **5m**, system blocks at 1h | free win | **medium**: tail writes at 1.25× instead of 2×; the longer-TTL blocks come first, which the API allows | decide from the gap distribution: `coachSessions.turns[].at` already holds every timestamp — count gaps over 5 minutes before switching; a `max_tokens: 0` keep-alive is the alternative for pauses well short of an hour |
| Code checks in the tool result (1.3) | free win | **medium**: removes the long hand-over turns and the re-check loops | `checks` from `applyCoachPatch`; prompt hand-over sections shortened (audit #5–#7) |
| Profile slice per coach on the first turn | free win | **small–medium**: each coach gets the sections its prompt says it reads | `profileForCoach(key)` — a pure function, tested like `tools.ts` |
| Retire the unread fields (2.4) | free win | **small** per field, cumulative across turns | prompt edits; schema stays |
| Meter: cache-write rate by TTL | accuracy, not savings | — | one table change + test |
| **Sonnet 5.5 for the coach** | tradeoff | halves every remaining rate | the audit's condition: two or three real sessions per coach read side by side, or the minimal eval below — never on the price list alone; switch between cohorts (old sessions carry Opus thinking blocks) |
| Effort sweep (`low` vs `medium`) | tradeoff | likely flat for chat | only with an eval; `low` is already the floor on Opus 5.5 |
| Haiku 5.5 for the research jobs' extraction step (not the conversation) | tradeoff | small, on the job line only | the job has a checkable output (URLs open, counts match) — the one place a cheap model fits |

**Skipped, deliberately:** context editing and server-side compaction (every pass rewrites the cached conversation; the
256 KiB restart with a recap is already the cheaper shape, and 1.2 makes it rare); tool search / `defer_loading` (one tool,
under 10K tokens); Batch API (a member is waiting); task budgets (turns are short; the budget is for long autonomous
loops); a multi-model advisor/orchestrator (no bulk to hand off inside a conversation — the jobs of 1.2 are the
orchestration, in code).

### 3.3 Measure before the tradeoffs

- **Read the meter first.** Admin → Claude → Usage, per coach, with cache read vs write vs uncached input. A healthy loop
  reads far more from the cache than it writes; if `cacheWrite` is a large share, lever 3 (TTL) is the one to take first.
- **The gap distribution** from `turns[].at` decides the TTL; the restart count (`messagesJson === "[]"` after a turn)
  decides how urgent 1.2 is. A read-only script that aggregates both from Firestore is at
  `/private/tmp/claude-501/-Users-rafaelcastillo--claude-spares-spare-kflIfn/423fadf5-4102-4e5b-a6b5-87e03333b6b0/scratchpad/meter.mjs`
  (it needs `.env.local`'s service account; I was not permitted to run it from this session). Worth promoting to
  `scripts/coach-meter.mjs` beside `grant.mjs`.
- **A minimal eval for the model question:** 20–30 real member turns per coach, frozen (member text + the profile at that
  point), run through Opus-low and Sonnet-low, outputs side by side plus the `update_profile` patch each produced; judged
  by Rafael on a three-line rubric (asked the right next thing · wrote only confirmed data · wrote the right keys). Cost
  per task from `usage`. That is one afternoon and it settles a halving of the bill either way.

---

## 4. The brain — this repo's engine, or Claude's Managed Agents?

The question behind the correction. Both run Claude; the difference is who runs the loop and where the state lives.

| | The engine in this repo (`lib/engine`, Claude API + tool use) | Managed Agents (beta) |
|---|---|---|
| Who runs the loop | your route or job handler on Vercel | Anthropic, with a per-session sandbox (bash · files · code execution), Skills and MCP |
| State | Firestore — the profile the pages read live, the meter, the sessions | the agent (versioned config) and its sessions on Anthropic's side; your data reaches it through tools |
| Writing the profile | `update_profile` → `applyCoachPatch` in-process | a **custom tool** whose result your server returns — the same `applyCoachPatch`, one network hop later, on every write |
| Streaming to the panel | SSE from the route (built) | the session's SSE event stream, relayed by your server |
| Gating and quota | `features.coach`, the monthly meter, 429 (built) | a hard **session budget** in dollars per session; the monthly per-member meter stays yours |
| Prompts | repo default + admin override in Firestore (built) | agent versions; the admin editor would publish a new version |
| Long and unattended work | a job per unit, 300 s each, fan-out through QStash | sessions with no route limit; **scheduled deployments** (cron); **outcomes** (a grader iterates a deliverable against your rubric); **multi-agent workflows** |
| Cost shape | tokens; caching you control | tokens plus sandbox container time (hourly beyond an allowance); caching handled for you |

**Read against the three things the brain does:**

- **The coach conversation** — a human-paced chat whose only side effect is a Firestore write the pages read live. Managed
  Agents would add a hop per write, a second state store, and a sandbox the coach has no use for; it would remove nothing
  the route does today. Keep it on the engine.
- **The research jobs (1.2) and the later modules — score a posting, tailor a CV, research a company.** Each is one
  structured call or a short loop; the engine's job document and fan-out fit, and the result must land on Firestore
  anyway. Keep them on the engine; a unit that cannot finish in 300 s is split, not moved.
- **Unattended, scheduled, long work** — the Scout's nightly careers-page scan across a member's forty companies; a
  "keep tailoring until it passes the rubric" deliverable; a research agent that reads many pages. This is where Managed
  Agents earn their place: no cron of yours, no route limit, an outcome grader you do not have to write, and a session
  budget as a hard cap. The engine would need Fluid Compute or a scheduler to match it.

**Recommendation — one brain, two execution targets.** The brain stays in this repo: the engine owns identity, the
profile, the meter, the admin surface and every tool that writes Firestore. Managed Agents is adopted, if at all, as an
execution target *behind* the same `engineJobs` document — a handler that opens a session instead of calling
`messages.stream`, relays its events to the job's `progress`, and writes its result where every handler writes — so the
pages, the meter and the admin tab never know the difference. Decide it when the first unattended job is ported (the
Scout), not for the coach. Two brains — a Managed Agent holding member state beside Firestore — is the one shape to avoid:
the profile has one home (`CLAUDE.md`), and so should the agents' memory of a member.

What this needs from Anthropic's side before that decision: a workspace-scoped key (already the deploy's shape, `DEPLOY.md`),
Managed Agents availability on the first-party API (it is), and a read of container-time pricing against the Scout's
nightly volume.

---

## 5. What to do first — one PR each

1. **Meter accuracy + the read.** Cache-write rate by TTL; promote the aggregation script; read November. Zero member-visible change.
2. **Rail + Settings §5 + empty-row link + write highlight** (1.4, 1.5). The specified UI that makes the coach findable and
   the page and panel one loop. No prompt change, no cost change.
3. **Code checks + readiness in the tool result** (1.3) and the prompt shortening the audit proposed (#5–#7). Prompt
   versions bump; sessions in flight take one cold cache miss, which the restart boundary already absorbs. **Built
   2026-11-16** (`lib/engine/coach/checks.ts`; #5 and #7 applied, #6 left for the per-coach pass).
4. **Start from the CV** (1.1) on coaches 1, 4, 5. **Built 2026-11-16** for `.md`/`.txt`; PDF through the SDK's document block is the one addition left.
5. **Research as jobs** (1.2) — Coach 2 Part B first (`postings`), measured against the meter, then Part C and Coach 3.
   These are the engine's first CareerOps modules; `ENGINE_JOB_TYPES` grows from `ping`. **`postings` built 2026-11-16**
   (`run_research` on Coach 2; the handler verifies every URL by code; the result reaches the coach on its next turn);
   `industries` and `companies` next, the same shape.
6. **Fields** (2.1, 2.3, 2.4) with the `.example.yml` files and their contract test, in one schema PR. 2.2 only if the Pi stays.
7. **Model** — after the eval of 3.3, per coach, between cohorts.
8. **Managed Agents** — evaluated with the Scout port (§4), as a handler behind `engineJobs`.

---

## 6. Decisions for Rafael

| # | Question | My recommendation |
|---|---|---|
| 1 | Research moves out of the conversation into jobs (1.2) — the coach presents results it did not produce in the turn | Yes. It is the same research, typed and verifiable, and the member stops waiting on it; it is also the first module on the engine |
| 2 | A CV (text, later PDF) may be read on the first turn to draft proposals (1.1) — distinct from the retired six-file upload | Yes, with confirmation of every field |
| 3 | Work rights and Portfolio / demo show on JobHacking (2.1) — two `only: "compass"` flags dropped | Yes; the coach writes them for every member |
| 4 | Standard answers as a Story Bank section (2.3) | Yes, later; pre-filled by code from Boundaries |
| 5 | Which of 2.4's fields the program needs in the live session despite no reader | Your call; I would retire the identity extras and `challenges` first |
| 6 | Conversation cache TTL 1h → 5m once the gap distribution is read | Yes if under ~10% of gaps exceed five minutes |
| 7 | Sonnet 5.5 for the coach | Only after the eval of 3.3, per coach |
| 8 | Does the Pi stay in service past the first engine module? | Decides whether 2.2 and `profileYaml` rebuilding are kept or retired |
| 9 | Managed Agents: for the coach, for the jobs, or for unattended work only | Unattended work only, behind `engineJobs`, decided at the Scout port (§4) |
