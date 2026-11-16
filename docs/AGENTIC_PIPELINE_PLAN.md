# JobHacker Compass — the agentic pipeline plan

**Status:** plan (2026-11-16). Rafael's draft from a separate conversation, reconciled against the code on `main` at
`82f84e1` and against `docs/CAREER_OPS_CLAUDE.md` (the engine), `docs/COACH_ASSESSMENT_2026-11-16.md` (the coach as
an agentic workflow) and `docs/UX_COACH_AGENTIC.md` (its surfaces). This note is the spine; those three hang off it.

**Decisions (Rafael, 2026-11-16):** the brain is this repo, not the Pi · one store, **Firestore** (the draft's Postgres
schema was indicative) · fork career-ops, don't wrap it · the six coaches stay · pages are the input layer, the coach is
the quality layer.

---

## 0. Vision

JobHacker Compass is the brain and the single source of truth. It runs the positioning coach, the company sourcing and
scoring pipeline, and an embedded, forked career-ops. Nothing is exported: career-ops logic runs inside Compass and
reads and writes the Compass database. **The differentiator is positioning**: what the coach and the member settle
together — the profile, frozen as an approved *brief* — is the input that drives everything career-ops does.

### Principles

| # | Principle | What it means in this repo |
|---|---|---|
| 1 | **career-ops defines the contract.** Every field career-ops needs is captured by Compass | §7 maps every upstream file to a Compass home; a field with no home is a schema change, never a new file |
| 2 | **Fork, don't wrap.** Keep the prompts, the A–H rubric, the CV tailoring; replace file reads and writes with Firestore | `CAREER_OPS_CLAUDE.md §3`'s port verdicts, extended to the upstream repo |
| 3 | **Deterministic pipeline, few agents.** Code searches, de-duplicates, checks and totals; the model thinks | the research jobs (§4) are code + one structured call each; no agentic web-search loops inside a conversation |
| 4 | **Right model per step.** A strong model where judgement is the product; a small one for planning, enrichment and rubric scoring; Batch where nobody waits | §4's model table, with the Evaluator as the deliberate exception |
| 5 | **Shared company data, personal scores.** A company is researched once for every member; fit, interest and evaluations belong to each member | `companies/{domain}` and `jobPostings/{id}` at the top level; everything else under `users/{uid}` |
| 6 | **Human checkpoints.** The member approves the brief and the target list before anything runs on them | the brief snapshot (§3) and the target-list review (§4 step 6) |
| 7 | **One profile, one home** (`CLAUDE.md`) | the brief is a frozen copy of the profile, never a second editable document |
| 8 | **The member's words.** The coach proposes, the member confirms, then it writes — in build and in review | `docs/COACH_ASSESSMENT_2026-11-16.md §1` |

---

## 1. What already exists — the plan's steps against the code

| Draft step | In the repo today |
|---|---|
| 1 · Map career-ops | `CAREER_OPS_CLAUDE.md §3` surveys `careerops-worker` module by module; §7 below adds the upstream `career-ops` files (the half that was missing) |
| 2 · The search brief | its five layers are profile fields already (§3); the approval snapshot is new |
| 3 · Data model | the profile schema (`lib/careerops/profile-schema.ts`, six Packer files), `engineJobs`, `claudeUsage`, `coachSessions`, the CareerOps collections the Pi writes (§6) |
| 4.1 · Coach agent → brief | the six coaches, `update_profile`, the gate between them, prompts in repo + admin override |
| 4.2–4.6 · planner · sourcing · enrichment · scoring · review | **started 2026-11-16.** `ENGINE_JOB_TYPES = ["ping", "postings"]` — the postings job is the engine's first CareerOps module (one structured call with search, URLs verified by code, written through `applyCoachPatch`); the planner and the aggregator adapters are phase B |
| 4.7 · career-ops engine | runs on the Pi today; the port is the engine's phase 2+ |
| 5 · Modes as screens | the CareerOps portal exists against the Pi; its rebuild on the engine is §8 |
| runs · ai_usage | `engineJobs` and the monthly meter — nothing to add |
| cohorts, coach read access | **not built**; Firestore rules are owner + admin only |

---

## 2. The decisions — resolved and open

| # | Question | Decision |
|---|---|---|
| 1 | One store or two | **Firestore only.** Shared data at the top level keyed by a natural id; per-member data under `users/{uid}` (§6) |
| 2 | Brief vs profile | **The brief is a snapshot.** `users/{uid}/briefs/{version}` is a frozen copy of the profile plus `scoringWeights`, written when the member approves. The profile stays the one editable home; evaluations link to the version that produced them |
| 3 | Who scores the 40 | **By dimension.** The pipeline computes the objective half — growth signal, boundary fit, sourced reasons — as a *fit* pre-score; the member supplies interest · access · proof. "Scores are the member's; you challenge, they decide" holds |
| 4 | Models | Coach: Opus 5.5 at `low` today, **Sonnet 5.5 the target**, switched per coach after the eval (`COACH_ASSESSMENT §3.3`). Planner, enrichment, company-fit scoring: **Haiku 5.5** (checkable outputs). **A–H job evaluation: a strong model at `high`** — the judgement the portal rests on, measured on `trainingExamples`. Batch API only for unattended work |
| 5 | Scope of the rebuild | **Phased in data-flow order** (§8), not 25 screens at once |
| 6 | Coaches | **Six, as named and ordered.** The brief is what coaches 1–3 produce; 4–6 are the artefact layer. Each coach has a build mode and a review mode; code checks on every save |
| 7 | Country | an **enum on the pipeline** (which sources run: NZ · AU · US · CA), not on the profile, where `country` stays free text |
| 8 | Human coaches (Rafael, Laurent) | **read by cohort, comment, never edit** the member's profile — open; proposed default |
| 9 | Several CVs per member (one per archetype) | **one Master CV**; tailored CVs are documents per application — open; proposed default |
| 10 | Application statuses | take career-ops `templates/states.yml` as the enum and map the tracker's existing stages onto it — open until §7's read |

---

## 3. The search brief — five layers, already in the profile

Nothing in the brief is a new field except `scoringWeights`. The checkpoint freezes what the pages hold.

| Layer | Profile fields (the editable home) | Written by |
|---|---|---|
| **1 · Positioning** | `narrative.headline · superpowers`, `personalization.exitNarrative`, `goal.role · seniority`, `personalization.targetRoles` (archetypes), `jhg.trueNorth.clusters · keepers`, `jhg.narrative.leadSkills` | Coaches 1, 2 |
| **2 · Targeting** | `jhg.trueNorth.titles.target · analog · exclude`, `industries[].subSectors`, `goal.subsector · companyType · city`, `boundaries.remote · localHybrid · relocate · willWorkIn · exclude` | Coach 2 |
| **3 · Sources** | `jhg.targetCompanies.companies · top10 · top3`, `watchlist.companies[].careersUrl`, `watchlist.positive · negative`; country → portals per §5 | Coach 3, the pipeline |
| **4 · Filters** | hard: `boundaries.hardNos · neverApply · excludeLevels · salaryFloor`, `policy.needsSponsorship · authorizedIn`; soft: `boundaries.softDislikes · cultureMustHaves · deprioritizeIfAbsent` | Coach 2 |
| **5 · Scoring** | `scoringWeights` — **new**, on the brief only: the member's weight per dimension (growth · fit · interest · access · proof), defaults from the program | the review checkpoint |

**The snapshot.** `users/{uid}/briefs/{version}`: `{ version, approvedAt, profile: <the profile as `profileFromSetup` returns it>, scoringWeights, country }`. Written by the engine when the member approves (a `.btn-primary` *Approve my brief* on Target companies once Coach 3 is complete — the one primary action that page has). A later edit on any page marks the current brief *stale* in the rail; approving again writes `version + 1`. Evaluations and target lists carry `briefVersion`.

**Archetypes are per member already.** career-ops hardcodes six tech archetypes in `modes/_profile.md`; here Coach 2's clusters and `personalization.targetRoles` are generated for each member — the positioning layer the draft asks for is Coach 2's output, rendered into the `_profile.md` shape the forked prompts expect (`renderProfileMd` exists).

---

## 4. The pipeline

```
 member ──▶ Coaches 1–3 (conversation, update_profile) ──▶ profile ──▶ ✓ Approve brief ──▶ briefs/{v}
                                                                                              │
          ┌───────────────────────────────────────────────────────────────────────────────────┘
          ▼
 1 planner (Haiku) ─▶ 2 sourcing (code) ─▶ 3 enrichment (code + Haiku) ─▶ 4 fit scoring (Haiku, batched)
          ─▶ 5 review checkpoint (coach explains · member scores interest/access/proof · approves the 40)
          ─▶ 6 career-ops engine: scan (code) · evaluate (strong model) · tailor · prep · track
          ─▶ 7 feedback → reweight → rescore (code + Haiku, cheap)
```

| Step | What | Runs as | Model | Output |
|---|---|---|---|---|
| 1 | **Query planner** — brief → search queries per country and source (titles × locations × keepers) | job unit | Haiku 5.5, `low`, structured output | `queries[]` on the run |
| 2 | **Sourcing** — Adzuna (primary), Trade Me (NZ), Careerjet, JSearch/SerpApi (Google for Jobs top-up); merge, de-dupe on company · title · location; ATS detection for careers URLs (`_registry.mjs`, 55+ providers) | job units, one per source | **none** | `jobPostings/{source}_{externalId}`, `companies/{domain}` upserts; 80–100 candidate companies |
| 3 | **Enrichment** — size band, industry, sub-sector, growth signal with source; cache first (`enrichedAt`), a paid enrichment API only after the fit filter | job units | Haiku 5.5 for the extraction from fetched pages; code for the cache | `companies/{domain}.enrichment` |
| 4 | **Fit scoring** — the brief's layers 2–4 against each company: boundary fit (hard filters are code), growth, industry match, reasons | one batched call per 20 companies | Haiku 5.5, `low`; Batch API if the member is not waiting | `fitScore · reasons` per company on the target list; keep 40 |
| 5 | **Review checkpoint** — Coach 3's conversation over the 40 the pipeline brought: the member scores interest · access · proof, picks the Top 10, confirms careers pages, sets the Top 3's first move; approves | the coach | the coach's model | `jhg.targetCompanies` complete; brief re-snapshotted if layer 3 changed |
| 6 | **career-ops engine** on approved companies — scan (code, zero tokens) → evaluate A–H (strong model, `high`) → tailor / cover / email (medium) → interview prep → tracker, follow-ups | jobs, each its own handler | per `config/engine` | `careerOpsPipeline · careerOpsReports · careerOpsDocs · opportunities` |
| 7 | **Feedback** — *more like this* / *not for me* on a company or an evaluation | code | Haiku only to rescore | `scoringWeights` nudged on the brief; rescore is step 4 over cached data |

**Where the coach sits in this.** Steps 1–4 are the research jobs of `COACH_ASSESSMENT §1.2`, called *from* Coach 2
(postings, industries) and Coach 3 (companies, careers pages) and later from the Target companies page directly. The
member never waits on a search inside a turn; the panel shows the job's status line (`UX_COACH_AGENTIC §2`).

**Checkpoints.** Two, both the member's: *Approve my brief* (after Coach 3, or earlier for a member who filled the pages
by hand and had them reviewed) and the per-company approvals of step 5. Nothing in step 6 runs on a company the member
has not approved.

---

## 5. Sources, by country

There is no candidate-facing "Google Jobs API" — Google Cloud Talent Solution indexes an employer's own postings. The
Google for Jobs panel is reached through SERP APIs. Verify pricing and terms before wiring any of these in.

| Country | Structured aggregators (first) | Google for Jobs top-up | Boards with an API | No API — reach through the above |
|---|---|---|---|---|
| **NZ** | Adzuna `jobs/nz` | SerpApi `google_jobs` `gl=nz` or JSearch | **Trade Me** `Search/Jobs.json` (OAuth; check terms) | Seek NZ, LinkedIn |
| **AU** | Adzuna `jobs/au`, Careerjet `en_AU` | same, `gl=au` | — | Seek, LinkedIn, Jora |
| **US** | Adzuna `jobs/us`, Careerjet | same, `gl=us` | — | Indeed (Publisher API closed), LinkedIn |
| **CA** | Adzuna `jobs/ca`, Careerjet | same, `gl=ca` | — | Indeed, LinkedIn |
| all | **ATS public APIs** — Greenhouse boards · Lever postings · Ashby · Workable · SmartRecruiters · Teamtailor — for careers URLs and the scan | | | Workday / SuccessFactors pages need a `web_fetch` read |

**Verification stays the rule:** a posting counts only when opened — `web_fetch` of the posting URL gives the JD for
keepers and the Evaluator; a careers URL is `confirmed` by code when an ATS board answers.

---

## 6. Data model — Firestore

One store. **Shared, natural-id data at the top level; everything per member under `users/{uid}`.** Existing paths from
`lib/firestore/db.ts` are reused; new ones are marked.

| Draft table | Firestore | Status | Notes |
|---|---|---|---|
| `profiles` | `users/{uid}` + `users/{uid}/careerOps/setup` | exists | identity on the user doc; the profile on `setup` |
| `briefs` | `users/{uid}/briefs/{version}` | **new** | the snapshot (§3); server-written |
| `cvs` | `setup.cv`; history in `users/{uid}/cvVersions/{n}` | exists / **new if wanted** | decision 9 |
| `stories`, `proof_points` | `setup.stories · narrative.proofPoints · snapshots · jhg.artefacts.storyFacts` | exists | |
| `companies` (shared) | `companies/{domain}` | **new** | `name · domain · country · industry · subSector · sizeBand · careersUrl · careersUrlStatus · atsProvider · atsBoardId · growthSignal · growthSource · enrichment · enrichedAt`. The domain is the unique key |
| `job_postings` (shared) | `jobPostings/{source}_{externalId}` | **new** | the id does `unique(source, external_id)`; `companyDomain · url · title · location · description · postedAt · isLive · fetchedAt` |
| `target_companies` | `jhg.targetCompanies.companies[]` on `setup` (the member's) + `users/{uid}/briefs/{v}/targets/{domain}` (the pipeline's fit score, reasons, status) | exists / **new** | the pages keep reading one document; the pipeline's half joins on domain |
| `pipeline_items` | `users/{uid}/careerOpsPipeline/{id}` | exists (Pi-written) | new writer, same shape; add `jobPostingId · briefVersion` |
| `evaluations` | `users/{uid}/careerOpsReports/{id}` | exists (Pi-written) | the A–H report; add `briefVersion · model`; structured `blocks` beside the markdown |
| `applications` | `users/{uid}/opportunities/{id}` (the tracker) | exists | map career-ops `states.yml` onto the tracker's stages (decision 10); don't open a parallel collection |
| `documents` | `users/{uid}/careerOpsDocs/{id}` + Storage | exists | |
| `feedback` | `users/{uid}/targetFeedback/{id}` | **new** | `users/{uid}/feedback` is already the product-feedback collection — don't reuse the name |
| `runs`, `ai_usage` | `users/{uid}/engineJobs/{id}`, `users/{uid}/claudeUsage/{month}` | exists | |
| `cohorts` | `cohorts/{id}`; `cohortId` on `users/{uid}`; a `coach` custom claim | **new** | rules: owner · admin · a coach of the member's cohort (read) |

**Rules.** `companies` and `jobPostings`: readable by any signed-in member, server-written only. `briefs`, `targets`,
`targetFeedback`: owner-readable, server-written (the brief is approved through the API so the snapshot is exact).
`cohorts`: admin-written; a `coach` reads the members of their cohort. Everything else as today.

**Three Firestore consequences, accepted up front**

- **No joins — denormalise deliberately.** A target row copies the company's name, industry, sub-sector and careers URL;
  the pages read one document. `companies/{domain}` is the source of truth and a nightly refresh rewrites the copies.
- **Postings reference companies, never the reverse.** `companies/{domain}` must not accumulate its postings (the 1 MiB
  document limit the coach transcript already met).
- **Cross-member analytics** (cost per cohort, most-approved companies) come from the Admin SDK on the server, or from
  the *Stream Firestore to BigQuery* extension when reporting is wanted. Not needed to start.

---

## 7. career-ops — the upstream files, mapped

Source: the upstream `career-ops` README (MIT — fork and embed commercially; the name is reserved, so everything is
branded JobHacker Compass). `CAREER_OPS_CLAUDE.md §3` covers `careerops-worker`; this table covers the files.

| career-ops file | Holds | Compass home |
|---|---|---|
| `cv.md` | master CV | `setup.cv` (+ `cvVersions` if decision 9 says so) |
| `article-digest.md` | proof points for fact-checking CVs | `narrative.proofPoints · jhg.artefacts.storyFacts` |
| `config/profile.yml` | profile, target roles, settings (follow-ups) | `setup` (goal · contact · policy · personalization) + `careerOps/followup` |
| `modes/_profile.md` | archetypes and framing | `personalization` (rendered by `renderProfileMd`); the archetypes are Coach 2's clusters |
| `portals.yml` | companies to scan, search queries | `watchlist` + `jhg.targetCompanies` + `companies/{domain}.atsBoardId`; queries from the planner |
| `data/pipeline.md` | jobs waiting for evaluation | `careerOpsPipeline` |
| `reports/*.md` | A–H evaluation reports | `careerOpsReports` |
| `data/applications.md` + `templates/states.yml` | tracker, canonical statuses | `opportunities` + the status enum (decision 10) |
| `output/` + `data/pdf-index.tsv` | tailored CVs, cover letters, manifest | `careerOpsDocs` + Storage |
| interview story bank | STAR+R stories | `setup.stories` |
| `data/agent-inbox.md` | queued requests | `engineJobs` |

**Modes to rebuild as Compass surfaces** (the CareerOps portal has most of them against the Pi): auto-pipeline · scan ·
discover · evaluation (*oferta*) · compare offers (*ofertas*) · PDF/text CV · cover letter · email draft · contact discovery
(*contacto*) · company research (*deep*) · interview prep/plan/practice/debrief · red-flag check · offer prep · tracker ·
follow-ups · reply-watch · patterns · upskill · titles · outcome · calibrate.

**Findings kept from the draft:** zero-token sourcing through `discover` + the provider modules; the 4.0 / 5 "don't
apply below" threshold — reuse; markdown / YAML / TSV formats port cleanly; career-ops has a waitlist for its own web
version — a possible competitor, and the reason positioning (not tooling) is the differentiator.

---

## 8. Phases — in data-flow order, one PR each

| Phase | Builds | Depends on |
|---|---|---|
| **A · The coach, agentic** | `COACH_ASSESSMENT §5` 1–4: meter accuracy, the rail + Settings §5 + empty-row link + highlight, code checks in the tool result, CV-first start; review mode. **Started 2026-11-16, JobHacking only** (`feat/agentic-phase-a`): the §1 panel fixes, the rail of six on JobHacking → Settings and in the gated panel, *Start a coach over*, the empty-row link, the write highlight. `feat/coach-code-checks` (same day): the hand-over checks in code (`lib/engine/coach/checks.ts`, N1–L4 less M1), Top-40 totals and ranks in code, a hand-over with a failed check stored as in_progress, readiness in the tool result and under the write line; prompts v4. `feat/coach-cv-first` (same day): the CV-first start — Coaches 1, 4, 5 open on *Start from your CV* while no CV is stored; a `.md`/`.txt` document rides on the turn it arrived with (`CoachDocument`), the composer's Paperclip takes one mid-conversation; prompts v5 for the three. `feat/engine-postings-job` (same day): research as a job — `ENGINE_JOB_TYPES` grows to `postings` (the researcher agent; `lib/engine/handlers/postings.ts`, `lib/engine/research/postings.ts`), Coach 2 starts it through `run_research` and hears the result on its next turn's operator note, the panel shows `JobStatus`. Still to build: the Part line, PDF, the `industries` and `companies` jobs | nothing new |
| **B · Sourcing and the brief** | `briefs/{v}` + *Approve my brief*; `companies`, `jobPostings`; the planner, Adzuna / Trade Me / Careerjet / SERP adapters, ATS detection; the `postings` and `companies` jobs called from Coaches 2 and 3; `JobStatus` in the panel | A (checks), the country enum |
| **C · Fit scoring and review** | step 4 (Haiku, batched), `targets/{domain}`, the Target companies page showing pipeline fit beside the member's scores, `targetFeedback` and rescoring | B |
| **D · Evaluation** | the A–H Evaluator on the engine (structured output, `trainingExamples` as the eval), scan from approved careers pages, `careerOpsPipeline` / `careerOpsReports` written by the engine | C |
| **E · Documents** | tailor, cover letter, email, interview prep — `careerOpsDocs` + PDF render on the engine | D |
| **F · Tracker and the rest** | follow-ups, reply-watch, patterns, offer prep, compare — each a screen in the existing shell | E |
| **G · Cohorts** | `cohorts`, the `coach` claim, cohort read in rules, the human coach's view | any time after A |

The Pi keeps running CareerOps until phase D is live for a cohort; then it is switched off per member, never cut over
all at once (`CAREER_OPS_CLAUDE.md` decision 6, amended: no cutover *until* the engine runs the module).

---

## 9. Cost

| Line | Today | Target | How |
|---|---|---|---|
| Sourcing + enrichment + fit scoring | ~$40 for one member — Sonnet/Opus searching inside the chat, results in the transcript | **$1–2 per member, sourcing in cents** | code sourcing (aggregators, ATS), Haiku for extraction and rubric scoring, Batch where unattended, the shared cache |
| Coaching conversations | unmeasured (read the meter; see `COACH_ASSESSMENT §3`) | set after November's read | fewer turns (CV-first, review mode), research out of the turn, 5m conversation cache if the gap distribution allows, Sonnet after the eval |
| Evaluation | — (Pi) | per evaluation, strong model at `high`; measured on `trainingExamples` | caching the brief + CV prefix per member (`CAREER_OPS_CLAUDE §3`) |

The meter prices cache writes at the 5-minute rate while the coach caches at 1h — fix before reading the month.

---

## 9b. Admin — a member's data

Admin → TOFU → Access renewals, with one member ticked, shows **Member data** (`components/admin/tofu/MemberData.tsx`): the
counts per collection (`lib/member-data.ts` is the one list of a member's subcollections — add a collection there when the
tree grows), *Reset coach* (conversations · jobs · meter), *Reset to new member* (state zero: every subcollection; `users/{uid}`
keeps exactly what registration wrote — email · name · createdAt — so onboarding shows again; share links revoked; the grant, its
feature switches and the sign-in stay) and *Delete member* (the tree, the grant, the
share links, the Auth user — the member's email typed to confirm). Server: `lib/server/member-data.ts` through
`/api/admin/members/{uid}` (GET summary · DELETE) and `/api/admin/members/{uid}/reset` (POST `{ scope }`). Every act writes
one line to `adminAudit/{id}` (server-only). The Supabase lead events are not touched — they are the funnel's, not the member's.

## 10. Open items

- Decisions 8, 9, 10 above (human coaches edit or comment; one CV or several; the status enum).
- Trade Me API terms for this use; Adzuna NZ coverage of Seek NZ for three real target roles (a ten-minute test with a dev key).
- SERP provider and plan (SerpApi vs JSearch) — the only metered sourcing line.
- Whether `scoringWeights` is exposed to the member as a control or kept as the program's defaults nudged by feedback.
- The first cohort for phase B.
