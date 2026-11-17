# JobHacker Compass — project rules

## Terminology

- **"Profile", never "maleta".** The one-file export/import of everything the agents know about a member
  (`version · goal · contact · policy · personalization · watchlist · notes · cv`) is the member's **profile**
  (`profile.yml`). The earlier "la maleta / suitcase" naming is retired (decision 2026-10-26). New code,
  copy, docs, filenames and identifiers say *profile*: `ProfileUpload`, `profileToYaml`, "Upload your profile",
  `profile.yml`. Existing `maleta*` identifiers in `lib/careerops/maleta.ts`, `MaletaUpload.tsx`,
  `StartChooser.tsx`, `IntakeScreen.tsx`, `docs/LA_MALETA.md` and their tests are legacy; rename them when
  touched, and never add new ones.
- **Settings is the profile** (decision 2026-11-07, `docs/UX_SETTINGS_HUB.md`): the Compass shell's account group is **Settings · Sign out**
  — there is no Profile page or row any more (`/profile*` redirects, `lib/settings-redirects.mjs`). `/settings` is a **hub**
  (`components/profile/SettingsHub.tsx`: identity · five area rows that quote the member's data · the six Packer files) and
  `/settings/<area>` renders the **same sectioned pages as the JobHacking portal** (`components/profile/SettingsArea.tsx` →
  `JobHackingScreen portal="compass"`): Narrative · True North · Target companies · Artefacts, plus the Compass-only **Agents** area.
  **One registry for both portals** — `lib/jobhacking/sections.ts`; a section the JobHacking menu never shows carries `only: "compass"`
  (Work rights under True North, Portfolio / demo under Artefacts, Portal accounts and Notes under Agents) and `jhSectionsFor(page,
  { portal, careerOps })` filters it; `jhSectionHref(key, base)` / `jhPageHref(key, base)` take the portal's base (`BASE_OF`). The
  JobHacking portal's pages must keep rendering exactly as specified — never add a Compass field without the flag. The retired
  two-page registry (`PROFILE_SECTIONS`, `sectionsFor("profile" | "settings")`) is gone; `lib/profile-sections.ts` keeps only what both
  portals share (`FILE_SECTIONS`, `sectionSummaries`). Portal accounts still needs CareerOps (the vault key comes from the worker). The
  whole-`profile.yml` export and the six-file upload (`ProfileFilesPanel`, shared with JobHacking → Settings) live on the hub.
  Add a section to the registry, not a page; a page under the hub passes `parent` to `SectionsPage` for its `‹ Settings` row.
- **One statement** (decision 2026-11-07): the Compass goal statement, onboarding step 2 and the True North statement are **one
  sentence** from `lib/goal.ts` (`trueNorthBlanks · trueNorthText · TRUE_NORTH_PLACEHOLDERS`): *In 60 days, I'm working as [Target Role +
  Target Seniority], in [Target Industry]. I'm based in [Target Location] and I'm making [Target Salary] yearly before tax. I enjoy working
  for [Target Company Type].* `GoalFields` (Compass edit mode and onboarding) uses the statement's field order and True North's labels.
  Never write a second template.

- **JobHacking portal** (decision 2026-11-03, `docs/UX_JOBHACKING.md`): a third portal — Narrative · True North · Target
  companies · Artefacts, plus Settings (upload only) — on the **same documents** as Compass. Its registry is `lib/jobhacking/sections.ts`;
  its pages render through the same `components/profile/SectionsPage.tsx`. Switched on per member (`features.jobHacking`) or by a
  "JobHacking only" registration link (`features.compass: false`). Never invent a field for it: every section reads
  something `profile.yml` carries. `goal.seniority` is a real goal field (True North · Target seniority).
  **The menu is two groups** (decisions 2026-11-08/09, `docs/UX_JOBHACKING.md §9–10`): `JH_NAV` — **JobHacker Compass** (Narrative ·
  True North · Target companies) and **Artefacts** (Story Bank · Master CV · **LN**; LN is the menu's word, `JH_NAV_LABEL` — the page
  stays *LinkedIn profile*) — drawn by `DesktopSidebar` as `.section-label` headings over the one row recipe. **The three artefacts are
  pages of their own on JobHacking** (`ARTEFACT_PAGES`: `/jobhacking/story-bank · master-cv · linkedin`, `only: "jobhacking"`, `parent:
  "artefacts"`), each the same `SectionsPage` layout with one section for now; a section names its own page with `jhPage`, and
  `jhSectionsFor` answers by area (`artefacts` → the three) as well as by page. `/jobhacking/artefacts` is their hub (`ArtefactsHub`) —
  the mobile tab's landing; the bottom bar keeps the four pages. Compass → Settings keeps one Artefacts area. Share is one link per page
  with a header (`SHARE_PAGES`, six); the hub mints none.
  Target companies (decision 2026-11-05, `docs/UX_JOBHACKING.md §3b`) is **Top 3 · Top 10 · Top 40 · Watchlist**: the first three
  read `companyLists.top3 · top10 · all` (the Packer's ranked lists, sunrise / sunset), are read-only, and never feed the Scout's
  `watchlist`; `all` is shown as "Top 40". They render through `components/jobhacking/CompanyListPanel.tsx` — the same ranked
  rows on all three lists, never a table, never cards for one list and rows for another. The Watchlist section reads as the
  same rows (`WatchlistSection`, industry borrowed from the ranked lists by name, never invented) and edits through the shared
  `WatchlistPanel` behind an *Edit watchlist* button. The rail is the sub-menu; don't add a `Segmented` beside it.
  Comma-separated inputs (keywords, figures) keep the typed text as local state and emit the parsed list — never control the
  textarea from the parsed list (`KeywordArea` in `components/agents/Portals.tsx`, defect fixed 2026-11-05).
  **Artefacts** (decision 2026-11-05, `docs/UX_JOBHACKING.md §3d`) is **Story Bank · Master CV · LinkedIn profile**: Story Bank reads
  `narrative.proofPoints · stories · snapshots` as rows through `components/jobhacking/StoryBankPanel.tsx` (the same row grammar as the
  company lists) and edits them behind an *Edit story bank* button (`StoryBankEditor`, saves only those three keys with merge); Master CV is Settings' `CvPanel` on the same `cv` field; LinkedIn profile reads the top-level
  `linkedin` section (`headline · about · experience · featured · skills · education · certifications` — LinkedIn's own sections, one
  pasteable block each, measured against LinkedIn's limits, never cut) through `LinkedinProfilePanel.tsx`. The URL stays
  `contact.linkedin`; never add an open-to-work block there (that is the goal).
  **One goal** (decision 2026-11-07, `docs/UX_JOBHACKING.md §2`): the goal has two homes (`profile.goal`, `setup.intakeGoal` while `goalSource` is
  `"intake"`) but one reading — every statement shows `goalInEffect` and every save goes through `goalWrites` (`lib/careerops/goal-save.ts`);
  never read `profile.goal` directly for a statement, never write a goal to a home that is not in effect.
  **The six Packer files** (decision 2026-11-07, revised 2026-11-09, `docs/UX_JOBHACKING.md §4, §4b, §5`): the Packer writes `narrative.yml · true-north.yml ·
  target-companies.yml · story-bank.yml · master-cv.yml · linkedin.yml`, subsets of the one schema; JobHacking → Settings is six slots (`lib/jobhacking/profile-files.ts`;
  the Compass Settings hub shows the same six; the old `artefacts.yml` is no slot — a stored one still counts the three artefact slots as uploaded),
  the shared `ProfileUploadSheet` takes several files, and an upload **merges key by key** (`mergeProfile`) — never replace a section whole,
  never drop a field a file doesn't mention. **The upload preview for one of the six files lists exactly the sections of its page, with the
  page's labels — nothing more, nothing less** (`jhFilePreview` over `jhSectionFields`; each artefact file is one row); a file fills the editable fields of its page
  (`shapeJhFile`: `narrative.headline` → Headline, `narrative.superpowers` → Core competencies; `jhg.identity.fullName` → the account's first and last name on `users/{uid}`, since name and email are the account's, not the profile's), and the page's own file wins a shared field (`master-cv.yml` fills Headline and `story-bank.yml` Core competencies only while blank; everything else merges plainly, later file wins). `jhg.artefacts` is shared by `story-bank.yml` (`storyFacts`) and `master-cv.yml` (the CV rules) and merges by key. Each file's `jhg` block (the workbook: identity, boundaries, titles, clusters, postings, company
  research, scores, story facts, CV rules) is stored on `CareerOpsSetupV2.jhg` and shown **read-only beside the field it explains** through
  `components/jobhacking/FileFacts.tsx` — never as a page of its own, never editable. `public/*.example.yml` are the Packer's samples and
  `tests/profile-files-examples.test.ts` is the contract; change the schema and update them together.
  **With the coach** (decision 2026-11-16, `docs/UX_COACH_AGENTIC.md §5–6`, phase A of `docs/AGENTIC_PIPELINE_PLAN.md`): for a member
  with `features.coach` (admins always) JobHacking → Settings renders the **rail of six** (`components/coach/CoachRail.tsx` over
  `lib/engine/coach/rail.ts` — `SectionList` rows under the two menu headings, the gate in the summary, never a fourth glyph), *Export
  profile.yml* and *Start a coach over* under *Danger*; the six slots render only for members without the coach. On the JobHacking pages
  an empty section offers *Fill this in with your coach ›* (`SectionsPage` `coachLink`) and a write the panel streams lights the rows it
  names for 600 ms (`jh-flash`, `flashSections` in the coach store). Compass → Settings is untouched by this phase. **Admin → Member data**
  (`lib/member-data.ts` is the one list of a member's subcollections — extend it when the tree grows): reset coach · reset all · delete.
  **Code checks, the model converses** (decision 2026-11-16): the hand-over checks live in `lib/engine/coach/checks.ts` and run in
  `applyCoachPatch` whenever `progress` is given; Top-40 totals and ranks are computed there (`rankCompanies`), never by the model; a
  hand-over with a failed check is stored `in_progress`. Add a check to `checks.ts` and name it in the prompt's hand-over line — never
  ask the model to count, measure or rank what the stored profile can answer.
  **The scoring matrix** (decision 2026-11-16, `docs/UX_COACH_AGENTIC.md §9–§10`): wherever a coach asks the member for 1–5 numbers — Coach 1's
  skills, Coach 3's company fit — it never asks row by row and never sums: it calls `score_matrix` with a `kind` from the registry
  (`lib/engine/coach/rubrics.ts`: four axes with five anchors each, tie-break, cut), the panel renders `ScoreMatrix` (one native select per
  axis, the anchors inside, a mute context line per row where there is one), the member scores everything once, and code ranks
  (`rankRows`) and flags (`commonFlags` + the rubric's own in `skills.ts` / `companies.ts`). The route writes the result itself through
  `applyCoachPatch` in the rubric's stored shape (`jhg.narrative.skillScores`; `companies[].scores`, ranked by `rankCompanies`); the
  member's turn carries `scored {kind, rows}` and renders as the scored table. Add a rubric to the registry, never a second form or a
  prompt-only scale; change an anchor or a flag in code, never in the prompt. While a matrix waits the composer's Send is
  `tone="secondary"` — one red. **Coach 3's matrix carries evidence** (2026-11-17, `docs/UX_COACH_COMPANY_SCORING.md`): Growth and
  Access are suggested by code (`lib/engine/coach/evidence.ts` — the rubric's anchors over the shared postings, the growth source and the
  member's LinkedIn `Connections.csv`, parsed and matched in `connections.ts`, never shown to the model), Interest and Proof get context,
  the member may change any suggestion and the change rides the row as an `override` the coach is asked to challenge. The evidence is
  derived data on `users/{uid}/coachEvidence/companies`, never a profile field; the connections live under `users/{uid}/connections`,
  email dropped at parse. Never let the model write an evidence line or a suggested number.
  **The expanded panel** (decision 2026-11-16, `docs/UX_COACH_AGENTIC.md §11`): the coach panel has two sizes of one conversation — `Sheet
  dock="right"` (440, beside the live page) and `dock="wide"` (the viewport: `CoachRail` on the left at `lg+`, the transcript in one
  `max-w-2xl` column at 16 / 1.75, the composer in the same grid) — toggled by the header's `.icon-btn` and remembered on the device
  (`jh.coach.wide`, `setWide` / `restoreWide`). It is a state, never a route: nothing re-mounts, a streaming turn survives, Esc steps
  back wide → docked → closed. `ScoreMatrix wide` is one line a row. Never add a third size or a coach page.
  **CV-first** (decision 2026-11-16, `docs/UX_COACH_AGENTIC.md §3`): a document the member hands the coach (`CoachDocument`, `.md`/`.txt`
  through `isCoachDocumentName`) rides on the turn it arrived with and is never stored by itself — the coach proposes, the member confirms,
  `update_profile` writes. Coaches 1 · 4 · 5 (`coachStartsFromCv`) open on `CvStart` while `setup.cvMarkdown` is empty. Never auto-save a
  handed-over CV to `cvMarkdown`; that is the Master CV page's and Coach 5's job. A PDF (`CoachPdf`) is transcribed to text once on the
  turn route and never stored as bytes — the transcript budget (`MAX_TRANSCRIPT_BYTES`) is the reason. The panel's Part line comes from
  `lib/engine/coach/parts.ts` (the stored keys), never from the model.
  **Research is a job, not a turn** (decision 2026-11-16, `docs/COACH_ASSESSMENT_2026-11-16.md §1.2`): a research step is an engine job
  (`ENGINE_JOB_TYPES`, a handler in `lib/engine/handlers/`, its pure half in `lib/engine/research/`, its prompt in `lib/engine/prompts/`
  with override key `job:<type>`) that a coach starts through `run_research` (`COACH_RESEARCH` names which coach may start which — `postings` for True North, `companies` for Target companies), that
  writes its result to the profile through `applyCoachPatch`, and that the coach hears of on its next turn via `landedSince` on the operator
  note. A posting or source counts only when code opened it (`urlWasFound` or a GET). Never let a coach do a research step with web search
  that a job exists for; never put search results in the transcript. **The operator names the step's job every turn until it has run** (`lib/engine/coach/research-due.ts`,
  `TurnContext.researchDue`): an older conversation replays the coach searching for itself, and the model follows that precedent over the
  prompt — so the note says which `run_research` kind the step calls for, from the stored profile and the recent jobs. Add a line there when a
  new job type lands. **A failed search is said, never improvised around** (2026-11-17,
  `docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md`): the turn route reads `web_search_tool_result` error blocks (`searchErrorsOf`), records the
  codes on the coach turn and the session, and the operator note (`searchErrorNote`) tells the model to say so — a "while the tool is
  unavailable" with a list from memory is the defect. Every remaining coach search has a verdict in that assessment; build its PRs in order. **Sourcing is an API call
  first** (2026-11-17, `lib/engine/sourcing/`): the `postings` job reads Adzuna / Careerjet when a key is set and the region is a pipeline
  country (`countryOf`), writes the shared `jobPostings` / `companies` collections, and the model only quotes the descriptions (`withPhrases`
  keeps a phrase only when the snippet contains it); it falls back to the model's search otherwise. Add a source as an adapter in that
  folder (pure URL + parse, tested; the fetch in `fetch.ts`), never as a search in a prompt; a careers URL is `confirmed` by the ATS
  registry's board answering (`confirmCareersUrl`), never by the model. **The companies job is API-first**: the boards' pass (titles and
  industries as queries, city and country-wide; `fromPostings`) is the list, and the model's industry-led proposal runs only to fill a gap
  (`proposal: "auto"`) or never (`COMPANIES_PROPOSAL=off`) — never as the first source.

- **Share links** (decision 2026-11-07, `docs/UX_SHARE.md`): a JobHacking page — Narrative · True North · Target companies · Artefacts,
  one link each, never a section, never the Agents area — can be shared read-only at `/share/<token>` as a **document** (title, author
  line, a heading per section, blocks; no shell, no buttons, no red, `noindex`, prints clean). The control is one `Share` button in the
  page header plus a status line while the link is on — not a Settings block. The document is `shareDocument()` in
  `lib/jobhacking/share.ts`, built from the same registry and fields as the page, **less Contact details** (the author line carries the
  name only; the Master CV renders as written). Tokens are minted server-side (`/api/share`, `lib/server/shares.ts`) into server-only
  `shareLinks/{token}` with the owner's live record at `users/{uid}/shares/{page}`; switching off then on mints a new token. No
  feedback box, no expiry, no per-section links — decided against for v1.

## Design

- Follow `docs/UX_AUDIT_COMPASS_TABS.md §0` on every screen: one button system (`.btn-*`), labels recede
  (`.label`), radii 4/8/12/16/24 only, red = primary action + active nav + genuine negative state only,
  readable text never `jh-mute-2`, icon-only controls are `.icon-btn` with `aria-label`, 44px targets.
- Profile page IA is specified in `docs/UX_PROFILE.md` (overview list → section; rail on desktop,
  drill-in on mobile). Do not add a second tab system; reuse `Segmented` and `Sheet`.
