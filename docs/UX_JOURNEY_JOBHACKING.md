# User journey — a job hacker on the JobHacking portal

**Date:** 2026-11-23. **Status:** a map of the portal *as built* on `main` (not the ideal path), read from
`docs/UX_JOBHACKING.md`, `docs/UX_COACH.md`, `docs/UX_COACH_AGENTIC.md`, `docs/UX_SHARE.md`,
`docs/COACH_ASSESSMENT_2026-11-16.md`, `docs/AGENTIC_PIPELINE_PLAN.md` and `lib/engine/coach/keys.ts`.
Emotions are inferred from the surfaces, not measured — the **Metrics** row of every stage says what would confirm them.

**Persona — Ana, 38, Auckland.** Delivery lead in logistics software, eight years in, laid off in a restructure. Has a CV
(a `.docx` she exports to `.md`/`.txt`), a LinkedIn she hasn't touched since 2021, and a vague target ("something senior,
product-side, not another agency"). Signed up through a **JobHacking-only** registration link from her JobHackers Global
cohort (`features: { jobHacking: true, compass: false }`), so she never sees Compass onboarding. Her admin has switched
`features.coach` on.

**Her goal:** in 60 days, be working as *[role + seniority]* in *[industry]*, in Auckland, at *[salary]* — the one
statement the portal is built around (`lib/goal.ts`). Everything below is the road from an empty statement to a filled one
she can send to someone.

**Two paths through the same pages.** A member *with the coach* builds the profile in conversation beside each page. A
member *without* it builds it in the six Gemini Gems and carries six `.yml` files to Settings. The stages are the same;
the touchpoints and the pain differ, so each stage notes both.

---

## The map at a glance

| | 0 · Invite & first sign-in | 1 · Narrative | 2 · True North | 3 · Target companies | 4 · Story Bank | 5 · Master CV | 6 · LinkedIn | 7 · Share & feedback | 8 · After the six |
|---|---|---|---|---|---|---|---|---|---|
| **Goal** | Get in, see what this is | Say who I am in a line | Say what I'm aiming at, with the market's words | Know *where* to apply, ranked | Prove it with numbers | One CV every line a result | Profile ready to paste | Get a second pair of eyes | Run the job search |
| **Time (the program's own words)** | minutes | about 1 hour | 2–3 hours | 3–4 hours | 1–2 sittings | about 2 hours | 1–2 hours | minutes | weeks |
| **Touchpoints** | registration link · `/jobhacking/narrative` · launcher | Narrative page · panel · CV-first empty state | True North page · statement · `postings` job · `JobStatus` | Companies page · *Source my 40* · `companies` job · `ScoreMatrix` · `Connections.csv` | Story Bank page · panel · `StoryBankEditor` | Master CV page · `CvPanel` · panel | LinkedIn page · `LinkedinProfilePanel` | `Share` button · sheet · `/share/<token>` | Rail of six · *CareerOps can run from here* · Admin |
| **Emotion** | 😐→😤 four empty pages, or 😊 one clear door | 😊 fast first win | 😤→😊 long, then the market answers | 😰→😊 longest; evidence helps | 😐 hard thinking | 😊 the payoff | 😊 quick | 😊 proud · 😐 no reply channel | 😤 a second switch |
| **Biggest pain** | empty state with no CTA (no coach); courier role (files) | none big — the one well-trodden path | 1–3 min job waits; search failures said late | 40 rows on a phone; sequential gate; cooldown | stories need facts she must dig up | the gate: four coaches before the CV | LinkedIn limits vs her prose | feedback has no way back | `features.careerOps` is not `features.coach` |
| **Drop-off risk** | high | low | **high** (first long stage) | **high** | medium | low | low | — | high |

---

## Stage 0 — Invitation and first sign-in

**User goal:** get in and understand, in one screen, what she is here to do.

**Actions**
- Taps the cohort's registration link (*Portal: JobHacking only*), signs up; `lib/server/registration.ts` sets
  `features: { jobHacking: true, compass: false }` and lands her on `/jobhacking/narrative`. No Compass onboarding, no
  Compass email sequence.
- Sees the shell: two menu groups — **JobHacker Compass** (Narrative · True North · Target companies) and **Artefacts**
  (Story Bank · Master CV · LN) — plus **Settings · Sign out**.
- Clicks around. Every section row reads empty.

**Touchpoints:** the email with the link · `/register/[token]` · `/jobhacking/narrative` · the sidebar / bottom bar · the
coach launcher (bottom-right, ink disc with a tail *Start Narrative*) · JobHacking → Settings.

**Emotions**
- *With the coach:* 😐 → 😊. One floating door with her next step written on it; every empty row says *Fill this in with
  your coach ›*. She knows what to do without reading anything.
- *Without the coach:* 😐 → 😤. Four pages of *Not in your profile yet* and a Settings page of six slots asking for
  files she does not have. The doc itself names this: *"a new member sees four pages of empty rows and a Settings page
  that asks for files they do not have"* (`UX_COACH.md §0`). Her next step is in another product (the Gemini Gems).

**Pain points**
- **No-coach path:** the portal's primary job has no primary action in the portal; she is the courier between Gemini and
  Settings, six times.
- **Upload lock** (`config/feedback.uploadLock`): if the admin has it on, each slot's button says *Unlock* and opens a
  four-question survey — once per file, six times. A gate, not an error, but six gates before any content lands.
- Narrow desktop (1024–1279): the 440 px panel overlays the page rather than docking; the expanded state is one tap away
  but she doesn't know that yet.
- Nothing tells her the whole arc — six coaches, ~10–13 hours of sittings — until she opens the rail on Settings.

**Opportunities**
- Make the rail of six (`CoachRail`, today on JobHacking → Settings) the panel's *empty state* on first open — the
  assessment already proposes it (`COACH_ASSESSMENT §1.5`). Zero new components.
- For no-coach members, the Settings header could carry the one sentence that is true: *Your coach is in Gemini — bring
  each file here as it's ready* with the Gem link. Honest about the courier role rather than silent.
- The registration email could say the arc in two lines (six conversations, the first about an hour).

**Metrics:** sign-up → first coach turn (time, %); sign-up → first section non-empty; % of JobHacking-only members who
open Settings before any page has content; survey-unlock completion when the lock is on.

---

## Stage 1 — Narrative (Coach 1 · about 1 hour)

**User goal:** contact details, a headline a recruiter gets in ten seconds, her bridge story, three to five core
competencies.

**Actions**
- Opens the launcher. Coach 1 opens on **CV-first**: *Start from your CV* · **Add your CV** (`.btn-primary`) · *Start
  without one* (link). She drops her `.md`.
- The coach proposes contact · headline · competencies as a table in the transcript; she says yes / corrects in words;
  `update_profile` writes; the page beside her fills and the rows flash 600 ms (`jh-flash`).
- Skills: the coach calls `score_matrix` (kind: skills); she scores everything once in `ScoreMatrix`; code ranks.
- The eyebrow says *COACH 1 OF 6 · NARRATIVE*; the Part line under it (*Part B · …*, from `lib/engine/coach/parts.ts`)
  tells her how far in she is.
- Hand-over: checks run in code; *✓ Completed · Narrative* lands as a write line; **Open True North ›** secondary button.

**Touchpoints:** launcher · docked panel (`Sheet dock="right"`, 440) · the Narrative page's four sections (Contact details ·
Headline · Bridge story · Core competencies) · `FileFacts` under each field · the composer's paperclip.

**Emotions:** 😊. The first thing she does produces something visible on the page within minutes. The CV she already has
does the work. *Correct a field by hand while talking* is allowed (no scrim, no scroll lock), so the panel never feels
like a cage.

**Pain points**
- PDF: her CV is a `.docx`; `isCoachDocumentName` takes `.md`/`.txt`, and a PDF is transcribed once on the route. A
  `.docx` is refused — she has to export first, and nothing on the empty state says which formats.
- Name and email live on the account, not the profile — editing them is in a different place than the rest of Contact
  details (correct by design, surprising on first contact).
- The "Headline" word appears several times in 80 px (rail, h2, label, hint) — audit P1; minor.

**Opportunities**
- Name the accepted formats on the CV-first empty state (*`.md`, `.txt` or PDF*).
- Quick win: the hand-over's *Open True North ›* could carry the time (*2–3 hours — plan a sitting*) so Stage 2's length is
  expected, not discovered.

**Metrics:** CV attached on first turn (%); turns to hand-over; time from first turn to *Completed · Narrative*; share
of members who hand-edit a field during Coach 1 (the live-page value).

---

## Stage 2 — True North (Coach 2 · 2–3 hours)

**User goal:** her boundaries, the roles the market *really* posts for someone like her, target industries, seniority,
salary range, company type — and the statement at the top of the page filled in.

**Actions**
- Opens True North. The statement leads the page in the dark goal card, every blank a dimmed bracketed label — *[Target
  Role + Target Seniority]*, *[Target Industry]*… She can see what is missing at a glance.
- Coach 2 asks one question at a time: hard no's, must-haves, industries. Each yes writes the section; the statement
  updates live (`onDraft` → `JobHackingScreen`).
- **Research is a job, not a turn.** The coach says *I'll read the postings for your three competencies in Auckland now —
  a minute or two* and starts `run_research` (`postings`). `JobStatus` shows *● Reading postings · 7 of 20* with a
  `.link` Stop. The page stays live; she can keep talking.
- When it lands: *✓ Added 18 postings · View ›*. Postings render as rows under *Target roles* (`FileFacts`). The coach
  quotes the phrases that keep coming back and asks which she would put on her CV tomorrow.
- Hand-over with code checks: a two-column table of what failed (*T3 · 15 postings — 12 opened*), then *✓ Completed ·
  True North* · **Open Target companies ›**.

**Touchpoints:** the statement · the six rail rows (Industry · Roles · Seniority · Salary · Location · Company type) and
read-only *Boundaries* · `JobStatus` · the posting rows · the `postings` job (Careerjet free primary, Adzuna metered,
JSearch / SerpApi top-up; `lib/engine/sourcing/`).

**Emotions:** 😤 → 😊. This is the first *long* stage, and the first wait. A one-to-three-minute job in a chat is long
when you don't know what is happening — the mono *7 of 20* is the honest version of a progress bar and keeps her. When
the postings land and the coach shows her the market's own words for her skills, this is the stage members talk about.
The statement filling in sentence-by-sentence is the visible reward.

**Pain points**
- **The wait.** 1–3 min per job; a second run of the same job is refused (spend guard) — if she meant it, she has to be
  told why.
- **A failed search.** Rate limits (429), a refused key, an empty region: the route records the codes and the operator
  note tells the model to *say so* — but an older conversation can still replay the coach improvising a list from memory
  (the defect `SEARCH_TO_API_ASSESSMENT` names; PRs in order). A member can't tell a real posting from an invented one.
- Region outside the pipeline countries (`countryOf`): the job falls back to the model's search — slower and less
  reliable, silently.
- Seniority was a free-text field explained by a long hint (audit T4; `<datalist>` proposed).
- On a phone the statement's values were not visibly links (audit T1) — she may never learn the sentence is the menu.
- Length: 2–3 hours is more than one sitting; the panel survives a close (store), but nothing says *you can come back;
  it's saved* — she might fear losing the thread.

**Opportunities**
- One mute line when a job starts: *Saved as we go — close this and come back any time.* (The write lines already prove
  it; the sentence makes it explicit once.)
- A failed search should land as a `JobStatus` red line on the page too, not only in the transcript — the page is the
  product.
- When `countryOf` has no pipeline source, say so in the status verb phrase (*Searching the web for postings* vs *Reading
  postings*), so a slower result is expected.

**Metrics:** `postings` jobs started / landed / failed per member; median job duration; search-error codes per turn;
sessions per hand-over (how many sittings True North really takes); % of statements with all five blanks filled at
hand-over.

---

## Stage 3 — Target companies (Coach 3 · 3–4 hours)

**User goal:** 40 companies with careers pages, scored; her Top 10 and Top 3 with a first move this week.

**Actions**
- **Page-first.** *Source my 40* in the page header runs the `companies` job (`POST /api/coach/companies` `source`;
  boards' pass over her titles and industries, city and country-wide; model proposal only to fill a gap). `JobStatus`
  under the header.
- The Top 40 lands as ranked rows (`CompanyListPanel`), sunrise / sunset grouped. Each row: Remove; *Add a company*
  sources a name (never just writes it). Evidence under a row (`evidenceFacts`).
- Coach 3 converses about the result: challenges (*Challenged by your coach*), asks for her interest.
- **Scoring with evidence.** `score_matrix` (kind: companies): Growth and Access are *suggested by code* from postings,
  growth source and — if she uploads it — her LinkedIn `Connections.csv` (parsed in `connections.ts`, email dropped);
  Interest and Proof get a context line. She scores 40 rows once; any change to a suggestion rides as an `override` the
  coach is asked to challenge. Code ranks (`rankCompanies`); `top10` / `top3` are derived on every write
  (`lib/engine/coach/lists.ts`).
- Top 3 rows gain *why now · first move · by date*; Top 10 *business problem · thesis · hiring authority · known person*.
- The Watchlist (the Scout's list, careers pages + title keywords) sits as the fourth section, edited behind *Edit
  watchlist*.

**Touchpoints:** page header (*Source my 40* · Share) · `JobStatus` · ranked rows · `ScoreMatrix` (wide: one line a row) ·
`Connections.csv` upload · the Watchlist editor (`WatchlistPanel` → `Portals`).

**Emotions:** 😰 → 😊. Forty is a big number to score. The evidence-backed suggestions turn "rate 40 companies on four
axes" into "check 40 suggestions", which is the difference between finishing and quitting. Seeing her own network
(*2 connections at …*) next to a company is the emotional high of the whole program — *I know someone there.*

**Pain points**
- **The gate.** Coach 3 needs Narrative *and* True North complete (`missingBefore` → 409). A member who already knows her
  40 cannot start here; the rail says *After True North* and that is all.
- **Forty rows on a phone.** Three lists plus a watchlist, each up to 40 ranked rows; no in-page jump (the share doc
  names the same scroll). Scoring 40 rows on a 390 px screen is a sitting of its own.
- **Ten-minute cooldown** on *Source my 40* (unless `names[]`): a member who removes six rows and re-sources waits with no
  countdown visible.
- **`Connections.csv`** is a LinkedIn export (Settings → Data privacy → Get a copy) that takes LinkedIn up to 24 hours to
  deliver. If she doesn't start it during Stage 1, Access scores arrive without her network.
- Residue of CareerOps vocabulary in the Watchlist editor (*Scout*, *Pi*, *AI tokens*) — audit C6; "a hint to tune
  keywords" rendered red (C5).
- Companies pass is API-first, so a company with no board hit and `COMPANIES_PROPOSAL=off` never appears — correct for
  cost, invisible to her (*why isn't X on the list?*).

**Opportunities**
- **Ask for `Connections.csv` in Stage 1's hand-over** (*Request your LinkedIn connections export now — it takes a day;
  we'll use it in Target companies*). Free, and it fixes the day-late problem.
- A visible cooldown on *Source my 40* (`Again in 7 min`, mute) instead of a refused click.
- A sticky list heading / *Top 3 · Top 10 · Top 40* jump on phones — the share doc's own next step.
- *Add a company* result when nothing is found: say the boards had no hit, offer the careers URL field.

**Metrics:** `companies` jobs per member; rows at first landing; % who score all 40 in one sitting; `Connections.csv`
uploaded before scoring (%); removals + re-sources per member; Top 3 rows with a *first move* filled; cost per Coach 3
hand-over (`claudeUsage` `byCoach`).

---

## Stage 4 — Story Bank (Coach 4 · 1–2 sittings)

**User goal:** eight to ten proven stories (STAR+R), each number with its source; which stories prove each target role.

**Actions**
- Coach 4 opens on CV-first if `cvMarkdown` is empty (it is — her CV rode Coach 1's turn and was never stored; Master CV
  is Stage 5). She attaches it again or starts from the Narrative's competencies.
- One story at a time: situation, task, action, *result with a number*, reflection; the coach asks for the source of each
  number (`storyFacts`). Writes land as rows in `StoryBankPanel`; she can also *Edit story bank* by hand.
- Proof points and snapshots (company · story · results) build up under the stories.

**Touchpoints:** Story Bank page (`/jobhacking/story-bank`) · `StoryBankPanel` rows · `StoryBankEditor` · the panel.

**Emotions:** 😐 with flashes of 😊. The hardest *thinking* stage: numbers she has to go find (old dashboards, a
performance review). Satisfying each time a story gets its figure; frustrating when the coach (rightly) refuses a
number without a source.

**Pain points**
- **Attach the CV twice.** CV-first is by design (never auto-save to `cvMarkdown`), but from her side she handed over
  the same file in Stage 1. The empty state could say so (*The CV you shared with Coach 1 wasn't stored — add it again*).
- Two sittings with no explicit "where we stopped" beyond the transcript; the Part line helps on the coach, the page shows
  N stories but not *of ~10*.
- Snapshots behind a *more* disclosure on a phone — the detail that proves a story is one tap away from invisible.

**Opportunities**
- Let the Master CV page accept the CV on day one (the page is never gated; `COACH_ASSESSMENT §1.5`) and tell her so in
  Stage 1: one upload, three coaches served.
- A count in the section summary (*6 stories · aim for 8–10*) — the rail already knows the program's target.

**Metrics:** stories at hand-over; stories with a sourced number (%); sittings per hand-over; % who hand-edit in
`StoryBankEditor`.

---

## Stage 5 — Master CV (Coach 5 · about 2 hours)

**User goal:** her complete CV, every line a result from her stories — and the CareerOps unlock.

**Actions**
- Coach 5 opens on CV-first (or on her stored CV if she put it on the page earlier). Proposes a rewrite line by line
  from the Story Bank; she confirms; `cv` is written; the page (`CvPanel`, the same panel as Settings · Master CV) shows the
  markdown.
- House rules, locked sections, languages from `jhg.artefacts` sit read-only under it (`FileFacts`).
- Hand-over: *✓ Completed · Master CV* and the readiness line from code (`readinessLine`): **CareerOps can run from
  here.**

**Touchpoints:** Master CV page · `CvPanel` · the rail's Master CV row (*CareerOps can run from here*).

**Emotions:** 😊. The payoff artefact; she can send this tomorrow. Seeing her Story Bank numbers reappear as CV lines
closes the loop on Stage 4's effort.

**Pain points**
- **Four coaches before the CV.** The conversation is gated on Narrative · True North · Target companies · Story Bank.
  The program's pedagogy — but a member in a hurry wants a better CV in week one, and the rail just says *After Story
  Bank*.
- *CareerOps can run from here* promises a thing she may not have: CareerOps is `features.careerOps`, a second switch
  (`UX_COACH.md §12`). For a JobHacking-only member the line points at a door that isn't there.
- Markdown. `CvPanel` is a markdown document; a member who has only ever used Word is editing in a syntax.

**Opportunities**
- Show the readiness line only when `features.careerOps` is on, or make it *Ask your coach / admin about CareerOps* when
  it is off — never a promise the shell can't keep.
- A *Download as .docx/.pdf* on the Master CV page (the share route already renders the CV as a document; print is
  clean). Members apply with files.

**Metrics:** Coach 5 hand-overs; days from sign-up to a stored `cvMarkdown`; CV downloads / prints; % with
`features.careerOps` at the time the readiness line shows *can run*.

---

## Stage 6 — LinkedIn (Coach 6 · 1–2 hours)

**User goal:** her LinkedIn profile, section by section, ready to paste.

**Actions**
- Coach 6 (needs Narrative · Story Bank · Master CV) drafts headline · about · experience · featured · skills · education ·
  certifications — one pasteable block each, measured against LinkedIn's limits, never cut (`LinkedinProfilePanel`).
- She copies each block into LinkedIn in another tab.

**Touchpoints:** LinkedIn page (`/jobhacking/linkedin`; menu word *LN*) · `LinkedinProfilePanel` · LinkedIn itself.

**Emotions:** 😊. Quick, concrete, and the first thing the outside world sees change.

**Pain points**
- A block over LinkedIn's limit is *shown* over, not cut — correct, but she has to trim it herself with no suggestion.
- Copy-paste seven times into a site that fights pasting into *Experience* (one role at a time) — the portal can't help,
  but can say so.
- *LN* in the menu is a word the page doesn't use (*LinkedIn profile*) — deliberate, slightly cryptic on first sight.

**Opportunities**
- ~~A per-block *Copy* with the character count beside it~~ — already built: `LinkedinProfilePanel` has a Copy per block and a mono *187 / 220* count, red only when over. The map's first draft missed it.
- The hand-over could set the open-to-work *goal* words from the statement — one sentence she pastes into LinkedIn's
  open-to-work dialog (never stored on `contact.linkedin`, which is the URL).

**Metrics:** Coach 6 hand-overs; blocks over limit at hand-over; time from Stage 5 to Stage 6 complete.

---

## Stage 7 — Share and feedback (any time a page has content)

**User goal:** a second pair of eyes — her mentor, a friend in the industry, her cohort.

**Actions**
- `Share` (`btn-secondary btn-sm`) in a page header → sheet → **Turn on link** → *Copy link*. A status line under the
  header says *Shared — anyone with the link can read this page* with *Copy link · Stop sharing*.
- The reader opens `/share/<token>`: a document — title, author line (name only), a heading per section, blocks; no
  shell, no buttons, no red; prints clean. **Live**, so a second round of feedback is cheap.
- Feedback comes back wherever she sent the link (WhatsApp, email, the Circle community).

**Touchpoints:** page header · share sheet · `/share/<token>` · her own channels.

**Emotions:** 😊 proud — the statement and the Top 3 read like a document, not an app screenshot. 😐 when feedback
arrives as a voice note she then has to turn into edits herself.

**Pain points**
- **No way back.** No comments, no feedback box (decided against for v1). The mentor's notes live in a chat thread; she
  re-types them into the coach or the editor.
- Six links, one state each, visible only on that page — she can forget a page is public (the status line is the
  reminder, but only when she opens the page).
- The Master CV document renders the CV *as written*, header included — phone and email go out with that one link, while
  every other page strips Contact details. Correct (a CV is made to be sent); worth one sentence in the sheet.

**Opportunities**
- A *Shared pages* summary on Settings' Danger/account block (*2 pages shared · Narrative · True North*) — not the
  rejected four-row URL block, just the count and the names.
- v2: a reader's comment that the coach reads on her next turn (*Your mentor left two notes on True North*) — the coach
  is already the place where words become writes.

**Metrics:** links minted per member; pages shared (which); views per link; links revoked; time from first share to next
profile edit (the feedback loop's length).

---

## Stage 8 — After the six: running the search

**User goal:** use the profile — have jobs found, CVs tailored, outreach drafted.

**Actions**
- Rail reads *6 of 6 complete*. The launcher's tail says *Your coach · LinkedIn*.
- If `features.careerOps` is on, CareerOps reads `cvMarkdown` + `profileYaml` + `portalsYaml` (25 of her 40 companies,
  `MAX_COMPANIES`; a company without a careers URL stays on the list but out of the Scout's file).
- She returns to edit: a section's Save writes only its fields; a coach can be restarted (*Start a coach over*) or
  cleared (*…and clear its data*, `COACH_OWNED_PATHS`) from Settings → Danger.
- Month end: if a quota is set and reached, the panel shows one mute line (*You've used this month's coaching time. It
  resets on 1 December.*) — the pages stay readable.

**Touchpoints:** the rail · Settings → Danger · CareerOps portal (if granted) · the quota line.

**Emotions:** 😊 → 😤. Done is a real high. Then: the profile is a *brief*, and the thing that acts on it is behind a
different switch she doesn't control. For a JobHacking-only member, the end of Stage 6 can be the end of the product.

**Pain points**
- **Two switches.** `features.coach` ≠ `features.careerOps`; the rail's *CareerOps can run from here* has been saying so
  since Stage 5. The pipeline plan's vision (the approved brief drives everything career-ops does, inside Compass) is phase
  B — not here yet.
- Story Bank and LinkedIn are stored but **not read** by the Pi worker today (`UX_COACH.md §12`): two of six coaches'
  output waits for the Claude engine's reuse. Nothing is wasted, nothing is used either — invisible to her.
- The Top 40 is capped to 25 for the Scout with no note on the page about which 25.
- Returning after weeks: the launcher opens the last coach's long transcript; no *what changed since* on the pages.

**Opportunities**
- Decide the hand-off for JobHacking-only members at Stage 6 and *say it* on the page: CareerOps is granted (and how), or
  the next step is human (the cohort, a call).
- Mark on the Top 40 which rows the Scout watches (the first 25 with a careers URL) — a mute glyph, not a colour.
- A *since you were last here* line in the rail (jobs landed, lists re-derived) for the returning member.

**Metrics:** members at 6 of 6; % with `features.careerOps` at that point; days from 6 of 6 to first CareerOps run;
coach restarts / data clears; 429 quota hits; 30-day return rate after completion.

---

## Where emotions shift — the critical moments

1. **First screen (Stage 0).** With the coach, the launcher's tail is the whole onboarding. Without it, four empty pages
   and six slots — the biggest drop-off risk in the map, and the one the coach was built to remove.
2. **The first job wait (Stage 2).** One to three minutes with a mono count. Members who stay through it get the
   program's best moment (the market's own words); members who leave may not come back. The honesty of the status line is
   doing a lot of work.
3. **Evidence beside the score (Stage 3).** *2 connections at …* turns a chore into recognition. This is where the
   portal is better than the Gems were.
4. **The Master CV lands (Stage 5).** The payoff; and the first promise the shell might not keep (*CareerOps can run*).
5. **6 of 6 (Stage 8).** Done — then what. The product's ending is currently decided by an admin flag.

## Prioritised pain points — impact × frequency

| # | Pain | Stage | Impact | Frequency | Fix size | Where |
|---|---|---|---|---|---|---|
| 1 | Empty-state onboarding for no-coach members (courier role, upload lock) | 0 | high | every no-coach member | medium | `JobHackingSettings`, registration email |
| 2 | *CareerOps can run from here* when `features.careerOps` is off | 5 · 8 | high (trust) | every JobHacking-only member | small | `readinessLine` / `coachRailRows` take the flag |
| 3 | Failed search improvised around | 2 | high (trust) | per 429 / refused key | in flight | `SEARCH_TO_API_ASSESSMENT` PRs in order |
| 4 | `Connections.csv` asked for at Stage 3, takes LinkedIn a day | 3 | medium | every member | small | Stage 1 hand-over line |
| 5 | CV attached twice (Coach 1 then Coach 4/5) | 1 · 4 | medium | every CV-first member | small | CV-first copy; day-one Master CV page |
| 6 | 40 rows on a phone, no jump | 3 · 7 | medium | mobile members | medium | sticky heading / list jump |
| 7 | Cooldown on *Source my 40* invisible | 3 | low | re-sourcers | small | mute countdown |
| 8 | Share feedback has no way back | 7 | medium | sharers | large (v2) | reader comments → coach |
| 9 | Strict gate for members who already know their 40 / have a CV | 3 · 5 | medium | a minority | design decision | pedagogy vs a *skip* with a warning |
| 10 | `.docx` CV refused | 1 | low | some | small | formats on the empty state, or `.docx` → text |

## What changed on 2026-11-24 — the first pass

Applied the same day the map was written, with the rename of the third portal to **Job Search** (`CLAUDE.md`, *"Job Search", never
"CareerOps"*):

| Pain | Done |
|---|---|
| #2 — the readiness line promised a portal the member may not have | `readinessLine` now says *Your job search can start from here / once … are in*; the transcript (`Transcript jobSearch`) and the rail's Master CV row (`coachRailRows { jobSearch }`) show it **only** to a member with `features.careerOps` or an admin. Without the portal the row says nothing. |
| #4 — `Connections.csv` asked for a day too late | Coach 1's close line now asks for the LinkedIn connections export and for the CV to go on the Master CV page, so Coaches 3, 4 and 5 find both ready (`lib/engine/coach/prompts/narrative.ts`). |
| #5 — the CV attached twice | `CvStart again` (Coaches 4 · 5) says the earlier CV stayed in that conversation and points at the Master CV page; the formats line names Word → PDF. |
| #7 — invisible cooldown | *Source my 40*'s 429 now says *run it again in N min* (`app/api/coach/companies/route.ts`). |
| Stage 0 · 2 · 3 · 6 — the retired product name on member screens | Gone from the switcher, eyebrows, the gate page, intake copy, the export header, stored log lines and the coaches' prompts; `/careerops/*` redirects to `/job-search/*`. |

Still open after the first pass: #1 (no-coach onboarding), #3 (search PRs in flight), #6 (40 rows on a phone), #8 (feedback's way
back), #9 (the gate), #10 (`.docx`), and the Stage 2 *saved as we go* line.

## The second pass — 2026-11-24, same day

| Pain | Done |
|---|---|
| Stage 2 — nothing says the work is kept during a 1–3 min wait | The first research job of a conversation carries one mute line under its status while it runs: *Saved as it lands — you can close this and come back any time.* (`FIRST_JOB_ASIDE`, `JobStatus aside`). The page's own job lines carry none. |
| Stage 2 — a failed search is said only in the transcript | True North reads the coach's `postings` job under its header (`PostingsJobStatus`: while running, and fifteen minutes after it lands or fails; the rule in `lib/jobhacking/postings-job.ts`) — the same `JobStatus` line, so a failure is seen where the postings would have been. |
| Stage 2 — the web fallback is silent | The `postings` handler's progress says *Searching the web for postings* on the fallback road, against *Reading the job boards* on the API road. |
| Stage 4 — N stories, of how many? | The Story Bank row's summary ends *· aim for 8–10 stories* while there are stories but fewer than eight (`STORY_BANK_TARGET`). |

Still open: #1 (no-coach onboarding — needs the Gem link), #3 (search PRs in flight), #6 (40 rows on a phone), #8 (feedback's way back),
#9 (the gate — a decision), #10 (`.docx`), and Stage 8's hand-off for JobHacking-only members (a decision).

## What this map does not change

The six coaches in order; one question at a time; the member says yes before anything is written; *the page is the
product, the panel is the conversation about it*; code checks and ranks, the model converses; research is a job; one
profile with one home. Every opportunity above is a sentence, a count, a flag check or a line in an existing component —
none needs a new page, a new field or a second way to write the profile.
