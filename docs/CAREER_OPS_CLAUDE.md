# The Claude engine — foundations for JobHacking and Compass

**Status:** phase 0 built (2026-11-10, branch `feat/engine-foundation`): `lib/engine/*`, the job document, QStash publish + signed run route, the meter, `config/engine`, `requireEngineMember`, the `coach` flag, Admin → Claude (Usage · Settings). Member-invisible. Phases 1+ as below. Companion to `docs/UX_COACH.md` (the coach is the engine's first consumer).

**Scope (Rafael, 2026-11-10):** a Claude-API engine for **the JobHacking portal and Compass only**. **The CareerOps portal and its Raspberry Pi worker are unchanged** — `/careerops/*`, `/api/agents/*`, the Upstash queue, `config/agents`, Admin → CareerOps all keep running as they do today. This is foundation work: later, modules of CareerOps (scoring a posting, tailoring the CV, researching a company, …) will be reused inside JobHacking and Compass, and they will run here, on Claude, not on the Pi. No cutover, no retirement, nothing to switch.

**Decisions (Rafael, same day):** 1 QStash · 2 forms read from public pages, no signed-in browser, no vault · 3 evals, no fine-tuning · 6 no cutover — new code beside the Pi · 8 no Fluid Compute.

**Source surveyed:** [rafcasto/careerops-worker](https://github.com/rafcasto/careerops-worker) at `main` — worker.js, 20 jobs, 18 lib modules — to know which pieces are worth porting when the time comes and which are Pi-shaped.

---

## 0. What the engine is — and is not

```
 Pi (unchanged)                                   Claude engine (new, this repo)
 /careerops portal ─▶ /api/agents ─▶ Upstash ─▶   /jobhacking · /settings ─▶ /api/engine ─▶ QStash ─▶ /api/engine/run ─▶ Claude API
 worker.js ─▶ n8n · Ollama · career-ops scripts   lib/engine/* ─▶ Firestore (job doc, results)
 config/agents · Admin → CareerOps                 config/engine · Admin → Claude (the Coach tab, docs/UX_COACH.md §8)
```

Two engines, two configs, two admin surfaces, **one profile** (`users/{uid}` + `users/{uid}/careerOps/setup`) and one monthly meter per member. The Pi reads `cvMarkdown · profileYaml · portalsYaml`; the Claude engine reads the setup document directly, the whole of it — stories, proof points, ranked lists, LinkedIn blocks included.

The engine's first job is the **coach** (`docs/UX_COACH.md`): a streamed conversation with `update_profile`. Everything the coach needs — the SDK client, caching, refusal handling, the job document, the meter, the admin surface — is the foundation every later module stands on.

## 1. The foundation — `lib/engine/`

| Module | What it is | Used by |
|---|---|---|
| `claude.ts` | The port of the worker's `lib/claude.js`: one SDK client, `messages.stream` with `.finalMessage()`, `fallbacks: "default"`, `output_config.effort`, structured outputs via `client.messages.parse`, `web_search_20260209` with sources captured, usage returned on every call. Pure wrapper, tested with a fake client. | everything |
| `jobs.ts` | The job document `users/{uid}/engineJobs/{id}`: `type · payload · status (queued · running · done · failed · cancelled) · progress · log (tail) · result · error · usage · createdAt · startedAt · endedAt · units?: { total, done, failed }`. Replaces the worker's Redis hash + `careerops:jobs` zset for this engine. Read live by the UI; cancel is a flag the unit checks between steps. | every job |
| `queue.ts` | QStash: `publish(type, uid, jobId, unit?)` → `/api/engine/run`, signature verified (`Upstash-Signature`), retries and DLQ from QStash, per-message delay. Fan-out = one message per unit. | every job |
| `usage.ts` · `pricing.ts` | The monthly meter (`users/{uid}/claudeUsage/{YYYY-MM}`: turns, tokens in / cached / out, searches, `estimatedUsd`, `byCoach`, `byJob`) and the per-MTok table the admin can edit. | coach, every job |
| `config.ts` | `config/engine` (model per agent, effort, enabled, the two limits, `preferredVoice`) and `config/engine/{agent}` prompt overrides with versions and *Reset to default* — the pattern `agents-config.ts` already has, on a new document so the Pi's `config/agents` is never touched. | admin, every job |
| `prompts/` | Repo defaults with versions. The coach's six first; later each ported agent's prompt (the worker's `lib/prompts.js` is the source — §3). | |
| `auth.ts` | `requireEngineMember(req)`: signed in, grant active, `features.coach` (or the feature the surface is behind) or admin. The Pi's `requireAgentsMember` (`features.careerOps`) is not reused — different flag, different portal. | every route |

**Routes.** `app/api/engine/jobs` (create → publish, returns the id; without a queue — local dev — the job runs inline), `app/api/engine/jobs/{id}` (the member's own job; cancel), `app/api/engine/run` (QStash → one unit → Firestore), `app/api/admin/engine/config` · `usage`; later `app/api/coach/turn` (the coach, streaming — it does not go through the queue; a turn is interactive). `runtime = "nodejs"`, `export const maxDuration` set per route (§2).

**Rules.** `users/{uid}/engineJobs` and `users/{uid}/claudeUsage` are owner-readable and server-written only (`firestore.rules`): the meter decides the monthly limit, so the member never writes it. `config/engine` is readable by any signed-in member (nothing secret in it: models, limits, prices); its prompt overrides under `config/engine/prompts` are server-only.

**Smoke test.** Admin → Claude → Settings → *Send a test job* creates a `ping` job for the admin and polls it: *done · pong* proves `jobs` → QStash → `run` → Firestore on the deployment (or *ran inline* where no queue is configured).

**Admin.** The Coach tab of `docs/UX_COACH.md §8` is this engine's admin surface — usage per member, the limits, the model per agent, the prompts, later the evals. Admin → CareerOps stays the Pi's.

## 2. Execution without Fluid Compute (decision 8)

Every invocation is one request with the plan's plain `maxDuration`; nothing here needs more.

| Shape | Examples | Duration | How |
|---|---|---|---|
| Interactive, streamed | a coach turn | 5–30 s | `maxDuration = 60`; the stream ends when the turn does |
| One call | score a posting · tailor a CV · a cover letter · company research · a follow-up | 15–60 s (+ ~10 s for a PDF render) | `maxDuration = 120`; one QStash message, one invocation |
| Fan-out | a scan of N careers pages · a batch of N postings | each unit 10–40 s | one QStash message **per unit**, each its own invocation; the parent job's `units` counter closes it (a Firestore transaction); the slowest unit sets the wall time, not the sum |

**The plan is the limit, not Fluid:** Pro allows `maxDuration` up to 300 s per route without it — enough for every row above including Chromium + render; Hobby caps at 60 s, which an Opus evaluation can exceed and a PDF render will. Confirm the project's plan before phase 1; with Pro, nothing else is needed for an alpha group. Fluid Compute becomes worth switching on when many members run jobs at once (it shares instances) — a scaling decision, not a correctness one.

## 3. The worker, module by module — what to port when a surface needs it

The survey of `careerops-worker`, kept so the port is a lookup, not a rediscovery. Nothing here is scheduled; each row is picked up when a JobHacking or Compass surface asks for it.

| Worker module | Port verdict | What changes on Claude |
|---|---|---|
| `lib/claude.js` — `teach()`, `research()` | **Port first** (phase 0) | Already the SDK, streaming, fallback, web search, usage. Add structured outputs, caching helpers, effort. |
| `lib/prompts.js` — the ten system prompts (Evaluator A–G, Tailor, Writer, Researcher, Contacto, Training, Project, Apply, Interview prep, Followup, Patterns) + `buildTaskMessages`, `profileMdBlock` | **Port as each is reused** | Drop the small-model lines — *return ONLY the JSON*, the SCORE_SUMMARY machine block, *you have no web access* where the agent now has it. Keep every hard rule, the A–G blocks, the banned words, the untrusted-JD rule verbatim. The CANDIDATE TARGETING block becomes the whole profile: stories, proof points, True North boundaries. |
| `jobs/evaluate.js` | **Port** (likely the first reuse — scoring a posting from the Target companies page against True North) | Structured output for `company · role · score · archetype · legitimacy`; the `collapseRepeats`, the second summary pass, the Block A regex rescue, `[…truncated]` all go. JD from URL: `fetch` + `htmlToText`, then Claude `web_fetch` for JS-rendered pages (replaces `browser-extract.mjs`). |
| `jobs/pdf.js` · `jobs/cover.js` · `lib/render.js` | **Port** (Master CV page → a tailored CV) | Tailor / Writer with structured outputs; career-ops' HTML templates and print CSS vendored into `lib/engine/render/`; HTML → PDF with `@sparticuz/chromium` + `puppeteer-core` in the function (memory 1024 MB). `lib/storage.js` (Drive → bucket → inline) ports as is. |
| `jobs/deep.js` · `jobs/contacto.js` · `lib/researcher.js` | **Port** | `research()` as is — the "local model from the company page" fallback goes. |
| `jobs/scan.js` · `lib/ats-resolve.js` | **Port** (Target companies → postings) | Pass 0–1 in-process: career-ops' `providers/_registry.mjs` + `_http.mjs` + `verify-portals.probeProvider` (the worker already imports them directly in `classifyCompanies`; no `scan.mjs` subprocess, no `data/pipeline.md`). Pass 2: Claude `web_fetch` reads a page no provider claims and returns the job list as structured output. The Playwright scraper service does not exist here — an unreadable page is reported, as a scraper failure is today. Providers come in as a git dependency on `career-ops-hq/career-ops` or vendored `providers/` — decided at port time. |
| `jobs/advise.js` · `interview_prep.js` · `followup.js` · `apply.js` · `patterns.js` · `lib/answers.js` | **Port** | `buildTaskMessages` ported; `patterns.computeStats` stays zero-token in TypeScript; the answer bank's *reused / needs you* logic as is. |
| `jobs/apply_form.js` | **Port as public-form reading only** (decision 2) | Claude `web_fetch` reads the form page → `questions · identity · files` as structured output; a form behind a sign-in is reported as *needs your account — paste the questions*. No signed-in walking. |
| `jobs/apply_fill.js` · `lib/form-login.js` · `lib/form-read.js` · `lib/vault.js` · `.vault-key.pem` | **Not ported** (decision 2) | Needs a persistent signed-in browser and a private key Vercel must never hold. Stays a Pi feature of the CareerOps portal. The JobHacking / Compass surfaces never show *Portal accounts*. |
| `lib/llm.js` · `lib/claude-cli.js` · `lib/probes.js` · heartbeat · state · `reapZombies` | **Not ported** | n8n / Ollama / `claude -p` dispatch and the Pi's liveness — Pi-shaped. |
| `lib/user-root.js` · `jobs/sync_setup.js` · `nextReportNumber` | **Not ported** | The per-member filesystem the career-ops scripts needed. Firestore is the only store; a report number is a counter on the job doc's parent. |
| `generate_gold · build_dataset · exam · finetune · import_model · promote` · `training/` · the GPU box | **Not ported** (decision 3) | Teaching small models to approximate Claude. On Claude the useful residue is `trainingExamples` — pseudonymised CV + profile + JD + approved report, with an `exam` split — which becomes **the eval set**: `scripts/eval-evaluator.mjs` runs the ported Evaluator over the split and prints score / archetype agreement before any prompt or model change ships. |

**Prompt caching, per member.** Every job sends the same prefix — the agent's system prompt (stable, ~3–6K), then the member's profile block (stable, 5–20K) — and only the JD or task varies. Order the request `tools → system [cached] → user: [profile block, cache_control] → [task]`; a member who scores ten postings in a morning pays for the profile once. `usage.cache_read_input_tokens` is logged on the job and the admin tab shows the hit rate.

**Refusals.** `fallbacks: "default"` on every call; a final `stop_reason: "refusal"` fails the job with the category in its log, never silently.

## 4. Models

Per agent in `config/engine`, Opus 5.5 by default: the coach at `low` (chat); Evaluator at `high` — the judgment the portal rests on; Tailor, Writer, Researcher, Contacto, Interview prep, Apply, Advise at `medium`; Followup, Patterns at `low`. Sonnet 5.5 is a per-agent choice the admin makes after reading the meter. The model id lives in config, never in code.

## 5. Phases — one PR each

0. **Foundation.** `lib/engine/` as in §1: `claude.ts`, the job document and its live hook, QStash publish + signed `run`, the meter and the price table, `config/engine` with the prompt-override pattern, `requireEngineMember`; the Admin Coach/Claude tab's usage and limits. No member-visible change. **This is the coach's phase 1 prerequisite** — the coach's `/api/coach/turn` is built on `claude.ts`, the meter and the config.
1. **The coach** — `docs/UX_COACH.md` phases 1–3, on the foundation.
2. **The first reuse.** Decided when the JobHacking / Compass surface is designed — the likely first: scoring a posting from the Target companies page (`evaluate`), or a tailored CV from the Master CV page (`pdf`). Each reuse ports its row of §3 and its prompt, and adds its eval.
3. **Evals.** `trainingExamples` as the eval set and the script; the Admin tab's *Evals* row.

Nothing on the Pi changes in any phase.

## 6. Settled

| # | Decision |
|---|---|
| 1 | **QStash** — push, signed, retries, DLQ, delays; one message per unit of work. |
| 2 | **Forms are read from public pages** with `web_fetch`; gated forms are pasted; no signed-in browser, no vault on this engine. |
| 3 | **Evals, not fine-tuning** — `trainingExamples` is the eval set. |
| 6 | **No cutover.** New code beside the Pi; the CareerOps portal is untouched; the engine serves JobHacking and Compass. |
| 8 | **No Fluid Compute.** Per-route `maxDuration`; confirm the plan is Pro (300 s) before phase 1. |

Open: which reuse comes first (phase 2) — decided with its own UX note when you pick it.
