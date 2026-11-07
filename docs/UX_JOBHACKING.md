# JobHacking portal

**Decision (2026-11-03):** a third portal beside Compass and CareerOps, in the same shell. Three menu pages — **Narrative · True North · Target companies** — plus **Settings**, which is one thing: upload a `profile.yml`. **Decision (2026-11-05):** Target companies opens on the Packer's three ranked lists — **Top 3 · Top 10 · Top 40** — read-only, grouped sunrise / sunset, with the watchlist as the fourth section (§3b). **Decision (2026-11-05):** a fourth menu page, **Artefacts** — **Story Bank · Master CV · LinkedIn profile** — the Packer's proof points, stories and snapshots read-only, the one master CV, and the LinkedIn profile to build, block by block (§3d). It renders from the same documents as Compass (`users/{uid}` and `users/{uid}/careerOps/setup`): a section here is another door onto the same field, never a copy.

**Method:** Refactoring UI's seven principles, applied through the Compass profile pages' own system (`docs/UX_PROFILE.md`, `docs/UX_AUDIT_COMPASS_TABS.md §0`). Nothing new was designed where the Compass system already had the answer; the one new piece is the True North statement.

**Rule:** no field is invented. Every section reads something `profile.yml` carries (schema below). Where the spec named something the file did not have (*Target seniority*), the field was added to the file's schema — on Rafael's explicit call — rather than derived.

## 1. Who sees it

| | How it is switched on | Where |
|---|---|---|
| Existing member | `accessGrants/{uid}.features.jobHacking = true` | Admin → TOFU → Access renewals → *JobHacking portal* row (Enable / Disable for the selected members); `JobHacking` column shows the state |
| New member, JobHacking only | A registration link with **Portal: JobHacking only** | Admin → TOFU → Registration access → Registration links. Signing up through it sets `features: { jobHacking: true, compass: false }` and lands on `/jobhacking/narrative`. No Compass onboarding, no Compass email sequence. |
| Admin | always | — |

`features.compass` is absent for every member who predates this (absent = on). The Compass shell sends a JobHacking-only member to `/jobhacking/narrative` before its onboarding gate. The portal switcher (the logo) lists whichever portals the member has.

Routes: `/jobhacking/narrative` · `/jobhacking/true-north` · `/jobhacking/companies` · `/jobhacking/artefacts` · `/jobhacking/settings` (`/jobhacking/profile` redirects to `/jobhacking/narrative` — the page was called Profile until 2026-11-03). The account group of the JobHacking shell is **Settings · Sign out** (the Narrative tab is this portal's profile, so no Profile row is repeated).

## 2. Mapping — menu → section → `profile.yml` → editor

| Page · section | `profile.yml` | Editor |
|---|---|---|
| **Narrative · Contact details** | name + email on the account; `contact.phone · linkedin · location · portfolio` | `ContactPolicy part="contact"` |
| **Narrative · Headline** | `contact.title` | `ContactPolicy part="headline"` |
| **Narrative · Bridge story** *(Compass calls the same field "Exit story")* | `personalization.exitNarrative` | `Personalization only=[exitNarrative] labels={exitNarrative: "Bridge story"}` |
| **Narrative · Core competencies** | `personalization.crossCuttingAdvantage` | `Personalization only=[crossCuttingAdvantage]` |
| **True North · Target industry** | `goal.subsector` (the industry *and* its sub-sector, one field — decision C; company type moved out 2026-11-03) | `TrueNorthPanel section="industry"` |
| **True North · Target roles** | `goal.role` + `personalization.targetRoles[]` (archetype · axes · buys) | `TrueNorthPanel section="roles"` |
| **True North · Seniority** | `goal.seniority` *(new, decision B)* | `TrueNorthPanel section="seniority"` |
| **True North · Salary range** | `goal.salary` + `policy.minimumSalary` + `personalization.compTargets` | `TrueNorthPanel section="salary"` |
| **True North · Location** | `goal.city` + `policy.locationFlexibility` + `personalization.locationPolicy[]` *(visa / work rights left out, decision D)* | `TrueNorthPanel section="location"` |
| **True North · Company type** | `goal.companyType` *(its own section since 2026-11-03; was inside Target industry)* | `TrueNorthPanel section="company-type"` |
| **Target companies · Top 3 · Top 10 · Top 40** | `companyLists.top3` · `top10` · `all`, each `sunrise[] · sunset[] · unclassified[]` of `rank · name · industry · subSector · companyType · careersUrl · careersUrlStatus` *(new, 2026-11-05)* | `CompanyListPanel` — read-only; the Packer writes them |
| **Target companies · Watchlist** | `watchlist.companies[]` + `watchlist.positive` / `negative` *(decision E)* | `WatchlistSection` — the same rows read-only, *Edit watchlist* opens `WatchlistPanel` (§3c) |
| **Artefacts · Story Bank** | `narrative.proofPoints[]` (name · heroMetric) + `stories[]` (id · title · result · provenance) + `snapshots[]` (company · storyId · title · results) — read-only | `StoryBankPanel` |
| **Artefacts · Master CV** | `cv` | `CvPanel` (the same panel as Settings · Master CV) |
| **Artefacts · LinkedIn profile** | `linkedin.headline · about · experience[] · featured[] · skills[] · education[] · certifications[]` — read-only, one block per LinkedIn section | `LinkedinProfilePanel` |
| **Settings** | the whole file | `ProfileUploadSheet` (pick → review the diff → unpack) |

Not on the menu, still in the file and stored: `personalization.adaptiveFraming · negotiationScripts · portfolio`, `policy.visaStatus · authorizedIn · needsSponsorship`, `contact.github` and `notes`. They survive every save and every export. (`cv`, the artefacts and `linkedin` joined the menu on 2026-11-05 — §3d.)

### The goal has two homes — and one reading (decision 2026-11-07)
`lib/careerops/intake.ts`: the Compass goal on `users/{uid}`, or the intake override on the setup document — which an uploaded `true-north.yml` sets (`goalSource: "intake"`). **Every statement reads the goal in effect and every save writes the home in effect** (`goalInEffect` · `goalWrites` in `lib/careerops/goal-save.ts`): the Compass tab's goal statement, the True North statement and the agents' `profile.yml` are one goal, whichever page edits it. (Before, the Compass tab read only its own home, so a job title saved on True North after an upload never reached it — Rafael, 2026-11-07.) While a True North section is being typed in, its draft goes up to the statement (`TrueNorthPanel onDraft` → `JobHackingScreen`), so the statement reads the new title before Save; leaving the section takes the preview with it. `goal.seniority` is a field of the one goal form everywhere: Compass edit mode and onboarding now show *Job title* and *Seniority level* as two fields; `roleWithSeniority()` puts them together without doubling a level already typed into the title.

### Upload overrides (decision H)
Every section is editable; the upload replaces whatever the file carries, section by section, and the review step says exactly which — `profileDiff` is unchanged, plus one row for the artefacts. Anything the file does not mention is left as it is.

## 3. True North

The page's lead is the statement, in the Compass goal card's dark panel and `.goal-statement` type:

```
In 60 days, I'm working as [Target Role + Target Seniority], in [Target Industry].
I'm based in [Target Location] and I'm making [Target Salary] yearly before tax.
I enjoy working for [Target Company Type].
```

Every value is a link to the section that fills it; a blank renders the template's own bracketed label, dimmed, so the sentence keeps its shape. The six rail rows are the five blanks' questions (Target industry and Company type are two rows for two blanks; Seniority rides with the role) — a member never sees *goal*, *policy* or *personalization*. Each section's Save writes only its own fields (the goal subset to the goal in effect, the policy subset merged into `policy`, the personalization subset merged into `personalization` and re-rendered into `profileMd`), and rebuilds `profileYaml` from the result.

`Company type`'s select lists `COMPANY_TYPES` and, when the stored value is not one of them (an uploaded "Scale-up"), that value too — it is never silently dropped. Archetype rows carry visible labels below `sm` (the gap `UX_PROFILE.md §7.5` names) and a column head above it.

## 3b. Target companies — the ranked lists

**Decision (2026-11-05).** The page's rail is **Top 3 · Top 10 · Top 40 · Watchlist** — the first three are the Packer's `companyLists` (`top3` · `top10` · `all`), the member reads them and never types into them; the fourth is the watchlist editor as before, now called *Watchlist* so the page's own name isn't repeated in its rail. No second tab system: the rail *is* the sub-menu, as on every sectioned page. The page opens on the Top 3.

**The representation, by Refactoring UI.** The question was table vs cards. Neither, as a blanket answer:

| | Why not |
|---|---|
| A table (rank · name · industry · sub-sector · type · careers) | Six columns of equal weight is the opposite of hierarchy — a Top 40 would read as a spreadsheet, the URL column is noise, and it has no phone layout in a rail page whose mobile mode is a drill-in. |
| Forty cards | Forty same-sized boxes; "everything looks the same". A grid also loses the one thing a *Top N* is: an order. |

What ships is **one row model, the same on all three lists** (`components/jobhacking/CompanyListPanel.tsx`) — a consistent experience from the Top 3 to the Top 40 (Rafael's call, 2026-11-05; a first cut featured the Top 3 as cards and was dropped for the inconsistency):

- **Ranked rows** inside the section's card: `grid-cols-[2rem_1fr_auto]`, 44px tall, `divide-y`. Rank recedes (`font-mono text-xs jh-mute`), name leads (`15px/600 ink`) — the one heavy element — industry · sub-sector is the second line, type is a `.pill-neutral` from `sm` (and joins the second line below it), the careers page is one `.icon-btn` (`ExternalLink`, `aria-label` with the company's name). No page → a mute `Link2Off` glyph with sr-only text, never red: a missing URL is a gap the coach fills, not a failure.
- **Grouped sunrise → sunset → not yet classified** within every list, each group a `.section-label` with its icon and count. Empty groups don't render.
- **A facet line per group** — *Industries: HR tech 13 · Health tech 12 · Fintech 12 / Company type: Scale-up 19 · Established 18* — a two-row `dl` under the group heading, so the *shape* of 37 rows is read before the rows are. This is the "target industries & sub-sectors, company type" ask, answered as a summary rather than as columns. Only shown once a group has more than one row.
- **`careersUrlStatus`** never changes the colour: `opened_by_coach` only adds "(found by your coach, not yet confirmed)" to the link's accessible name. Colour-alone was never on the table; here even an icon-alone would be a lie about how sure we are.
- **Empty state** (no `companyLists` in the profile): centred, one sentence on where the lists come from, one `btn-secondary` to Settings. The overview row reads *Not in your profile yet* instead of *Not set* — the member cannot set it.

Red budget on the page: the shell's active tab and nothing else; the lists have no primary action. Type sizes used: 12 · 14 · 15; spacing 4 · 8 · 12 · 16 · 24 · 32. `jh-mute-2` nowhere.

Rejected alongside: cards for the Top 3 only (shipped first, then dropped — two treatments for one kind of thing read as two pages); sub-grouping the Top 40 by industry → sub-sector (loses the rank order, which is the list's meaning — the facet line gives the industry view without that cost); a `Segmented` inside one *Companies* section (a second tab system beside the rail, which `CLAUDE.md` forbids).

Rows (`jhSectionSummaries`): Top 3 quotes the three names; Top 10 and Top 40 say *40 companies · 37 sunrise · 2 sunset · 1 not yet classified*; the count sits at the row's right edge. A list is *done* the moment the file carried one — there is no *partial* for something the member cannot type in.

## 3c. Target companies — the Watchlist

**Decision (2026-11-05).** The fourth section reads like the other three and edits on request:

- **Read view**: the same `CompanyRow` — position as the number, name, a second line, type pill, one careers target — then the title keywords as two groups of `.pill-visible` (*Titles to include · Titles to exclude*, each with its count). A watchlist company carries only a name and a URL; where its name matches one on the Packer's lists, the row borrows that company's industry · sub-sector and type (`watchlistRows`, matched on a normalised name). Where it doesn't, the second line is the careers host (`boards.example`). Nothing is invented.
- **Keyword fields keep what is typed** (defect fixed 2026-11-05): the include / exclude textareas were controlled by the parsed list (`value.positive.join(", ")`) and re-parsed on every keystroke, so a trailing comma or space was trimmed away before it could render and a second keyword could never be started. `KeywordArea` in `agents/Portals.tsx` now holds the text as local state and emits the list; the text only re-syncs when the list changes from outside (a suggested chip). Every comma-separated field in the portal follows this rule.
- **One secondary button**, *Edit watchlist*, top right of the list. It swaps the read view for the shared editor (`WatchlistPanel` → `Portals`, `intro={false}`) with the red **Save watchlist** and a secondary **Cancel**; a save returns to the read view with a `role="status"` *Saved.* The editor is the same one Settings and intake use, so the two cannot drift — only the JobHacking page wraps it.
- **Empty**: *No companies on your watchlist yet* with *Add companies*, which opens the editor.

Red budget: none on the read view; one Save in edit mode. `WatchlistPanel` gained `intro` · `onSaved` · `onCancel`, all optional, so Settings and the intake wizard render exactly as before.

## 3d. Artefacts — Story Bank · Master CV · LinkedIn profile

**Decision (2026-11-05).** A fourth menu page for what the member *brings*, as opposed to who they are (Narrative), what they aim at (True North) and where (Target companies). Its rail is **Story Bank · Master CV · LinkedIn profile**; the page opens on the Story Bank.

- **Story Bank** reads the three artefact lists as they are: **Proof points** (name, hero metric as the second line), **Stories** (the `id` as the mono index, title, result, provenance as a `.pill-neutral` from `sm` — joining the text below it), with each story's **snapshots** filed under it on `storyId` (*Tracksuit · monthly → fortnightly*). A snapshot whose `storyId` matches no story is listed in its own *Snapshots* group rather than dropped. Same row grammar as `CompanyRow` — `grid-cols-[2rem_1fr_auto]`, 44px minimum, rank/id recedes, the name is the one heavy element. Nothing red: *estimate* is how sure the member is of a figure, not a failure.
  **Editable (Rafael's call, 2026-11-05).** One secondary button, *Edit story bank*, swaps the read view for `StoryBankEditor` — the same shape as the Watchlist's edit (§3c): three groups of rows with *Add proof point · Add story · Add snapshot* and an `.icon-btn-danger` remove per row, the red **Save story bank** and a secondary **Cancel**, a `role="status"` *Saved.* on return. A new story is given the next free `S<n>` (the Packer's id shape, gaps filled first) and shows it rather than asking for it; a snapshot picks its story from a select of `id · title`, so a removed story's snapshots fall back to *None* and the read view's unclaimed group. Figures are one comma-separated field whose text is local state (the `KeywordArea` rule — see below). Save writes **only** `narrative · stories · snapshots` with merge; blank rows are dropped (`cleanStoryBank`), a cleared list is written empty. The empty state offers *Add stories* beside *Upload profile*, and the overview row says *Not set* (the member can fill it), unlike the lists' *Not in your profile yet*.
- **Master CV** is Settings' `CvPanel` on the same `cv` field — one editor, one row summary (*412 words · Ready to score*), wherever it is shown. The upload status line now links the *Master CV* and *Stories & proof points* file sections here (`JH_FILE_EDIT`).

- **LinkedIn profile** (Rafael's call, 2026-11-05: "LinkedIn is nothing but the sections the user needs to build in LinkedIn") reads the new `linkedin` section (§5) as **one block per LinkedIn section, in LinkedIn's order** — Headline · About · Experience · Featured · Skills · Education · Licenses & certifications — only the ones the file carries. Each pasteable block (headline, About, every role's description, the skills list) has a **Copy** `.btn-secondary btn-sm` and a mono count against LinkedIn's limit (*187 / 220*); over the limit is the panel's **one red state** — a block LinkedIn will truncate is a genuine negative. Roles read as `roleLine` (*Delivery Lead · FreightDesk Software*) over `roleMeta` (*Mar 2022 – Present · Wellington*) with the per-role skills as `.pill-neutral`; Featured, Education and Certifications are quiet rows with one `.icon-btn` link where there is a URL. Read-only like the story bank; empty state → Settings; row *Headline · About · 2 roles · 6 skills · 1 school · 1 certification*, count *7/7*.

Rejected: a table for the stories (same reason as §3b); rendering snapshots as their own flat list first (a snapshot is a story pointed at a company — it belongs under the story); one Markdown blob for the LinkedIn profile like `cv` (it can't be measured against per-section limits or copied per block, which is the whole use); an *Open to work* block in `linkedin` (titles and locations are True North — one field, one home); a `url` in `linkedin` (it is `contact.linkedin`).

## 4. Settings — the four Packer files

**Decision (2026-11-07, Rafael):** the Packer writes the profile as **four files, one per page of this portal** — `narrative.yml` · `true-north.yml` · `target-companies.yml` · `artefacts.yml` — and the member uploads them one at a time, as each is ready, instead of one `profile.yml`. The four files are subsets of the one schema (§5); together they are the whole profile, and CareerOps reads the merged result.

**The page** is one card with **four slots** (`lib/jobhacking/profile-files.ts`, `JobHackingSettings.tsx`), the portal's row grammar: a glyph, the slot's name with the Packer's filename in mono, one mute line on what the file fills, then its state — *Uploaded 7 Nov 2026 · narrative.sample.yml · Packer: complete · 6 Nov 2026* (the member's upload record and the file's own `jhg.progress` stamp) or *Not uploaded yet* — a link to the page it fills, and one `.btn-secondary` **Upload** / **Replace**. Above the rows: *2 of 4 uploaded* and the page's one red button, **Upload files**, which takes any of the four or all at once. Drag-and-drop anywhere on the page; a dropped file lands in the slot its stamp names. Under the rows: the example files to download (the Packer's own samples, `public/*.example.yml`), and *Download everything as one profile.yml* — the safety copy, and the file a CLI checkout reads.

**Which slot a file is** (`detectJhFile`): its own `jhg.progress.<file>` stamp first; then the filename (*true-north*, *target-companies*, *artefacts*, *narrative*); a file with neither, or with several stamps (a merged export), is a whole profile and fills every section it carries. A file dropped on the *Narrative* slot that turns out to be the True North file is said, not refused — it goes to True North.

**The sheet** is the Profile page's `ProfileUploadSheet` (pick → review → unpack), now taking several files: each is validated on its own (a wrong shape is refused with its paths and the rest still go through), listed in the review under *Narrative file · narrative.yml — The Narrative page, section by section*, with its rows, warnings and raw text, and a × to leave it out; one **Unpack 4 files** writes the lot in one `setDoc`. The review's *Download current profile* still appears when anything would be replaced.

**The preview is the page (Rafael, 2026-11-07: "the fields in the upload preview need to match the fields in the UI section — nothing more, nothing less").** For each of the four files the review lists **exactly the sections of the page it fills, with the page's labels, in the page's order, always all of them** — `narrative.yml` → Contact details · Headline · Bridge story · Core competencies; `true-north.yml` → Target industry · Target roles · Seniority · Salary range · Location · Company type · Boundaries; `target-companies.yml` → Top 3 · Top 10 · Top 40 · Watchlist; `artefacts.yml` → Story Bank · Master CV · LinkedIn profile. Each row says *adds* · *replaces* · *same as now* · *not in the file — left as it is*, with the section's own row line as it will read after the unpack (`jhFilePreview` in `lib/jobhacking/profile-files.ts`, diffing `jhSectionFields` — the exact fields each editor shows — before and after). The status line after the unpack links those same sections. What the file carries that no section of the page shows (adaptive framing, notes, the workbook, …) is still stored for the agents and said in one mute line under the rows, never as a row. A whole `profile.yml` (no stamp) is still reviewed by its storage sections as before.

**A file fills the editable fields of its page** (`shapeJhFile`): `narrative.headline` is the **Headline** field (`contact.title`), `narrative.superpowers` are the **Core competencies** field (`crossCuttingAdvantage`, joined with "; "), `jhg.identity.location` is the contact location when the file has no `contact.location`, and **`jhg.identity.fullName` is the member's first and last name** — those live on the account (`users/{uid}`), not in the profile, so the unpack writes them there (`jhFileName` · `jhFileProfile`; first word → first name, the rest → last name) and the Contact details preview row counts name and email like the editor does. The email stays the sign-in email (the file cannot change it); when the file's `jhg.identity.email` differs it is shown read-only beside the editor as *Email in the file*. The page's own file wins a field two files carry: `artefacts.yml` also brings a CV headline and core competencies, and fills those two only while they are blank.

**Merge, not replace (decision H revised).** Because the files overlap — `contact` is in two, `personalization` in three, `notes` in all four — a file **adds to and replaces what it names, key by key, and never drops a field it does not mention** (`mergeProfile` in `lib/careerops/profile-file.ts`): the Artefacts file's `contact.title` lands beside the Narrative file's `contact.phone`. Lists are the one key they are: a file's `stories`, `companyLists`, `linkedin` or `watchlist.companies` replaces the stored list; the True North file's `watchlist.positive · negative` merge beside the Target companies file's `companies`. In `jhg`, `progress` and `identity` accumulate across files and each working block (`narrative · trueNorth · targetCompanies · artefacts`) belongs to its file and is replaced whole. Each file in the review diffs against what is stored **plus the files before it**, so the rows read as the write will happen; `profileDiff` itself is unchanged. The same rule applies to a whole `profile.yml` on the Compass Profile page (one sheet, one semantics).

After an unpack, a `role="status"` line — *Unpacked Narrative, Artefacts — 6 sections updated:* — lists the updated file sections, each a link to its JobHacking section where one exists (`JH_FILE_EDIT`; `narrative` → Headline, `jhg` → Boundaries).

### 4c. The upload lock (decision 2026-11-07, revised the same day: per file)

**Decision (Rafael):** an admin can make the survey the price of an upload — **one answer per file**. `config/feedback.uploadLock` — the toggle *Lock profile uploads until answered*, beside the global modal in Admin → User interactions → Feedback — locks each of the four slots' Upload buttons on JobHacking → Settings and the Compass Settings hub (one panel, `ProfileFilesPanel`) until the member has answered the feedback survey **for that file**: the response carries `unlocks: <JhgFileKey>`, and only that slot opens. Four files, four answers. Global and per-user-link answers (no `unlocks`) unlock nothing. Pure rule in `lib/feedback-lock.ts` (`slotLocked · lockedSlots`): flag on **and** no answer for the slot — the lock holds while the submission check is still loading. `useFeedbackSubmission` returns `unlocked`, the keys answered so far.

**No button above the rows** (Rafael: redundant). The header is the title and its mute line — *2 of 4 uploaded. Each file fills one area; together they are your whole profile.*, or while any slot is locked *… Each file unlocks with a short survey — 4 questions, once per file.* The row's button is the only way in: `.btn-secondary` **Upload** / **Replace** on an open slot; on a locked one a mute `.btn` on the hairline, `text-jh-mute`, a lock glyph, **Unlock**, `aria-label` *Unlock narrative.yml — answer a short survey*. Not disabled — tapping it opens the survey for that file, so there is no dead end. Drops land in whichever slot the file names, so a drop waits until every slot is unlocked; the drop zone says *Dropping files works once every file is unlocked*. The export (*Download everything as one profile.yml*) is not an upload and stays. Nothing turns red or amber: the lock is a gate, not an error.

**The survey from a slot** is the same `FeedbackModal`, `source: "lock"`, with a `.label` eyebrow *Unlocks True North* above the title (the admin's Responses list shows *Upload lock · True North*) and **Not now** where the blocking modal has *Sign out* — the member opened it, so they can close it. The unlock is live: the row turns into *Upload* the moment the response is written, and the survey closes itself if the slot unlocks under it (or the admin turns the flag off).

### 4b. What the pages show from the files

**Rule (2026-11-07):** every field the four files carry is shown on the page it belongs to, beside the field it explains, **read-only**, through one block (`components/jobhacking/FileFacts.tsx`: a `.section-label` *From your True North file*, a `dl` of label · value, lists as `.pill-visible`, one `.icon-btn` per URL, nothing red). The editors above are untouched; the member edits what they always edited, and the coach's working data sits under it.

| Page · section | Under the editor, from the file |
|---|---|
| Narrative · Contact details | `jhg.identity` — email in the file (when not the sign-in one), location, time zone, preferred channel, other emails, contact note, output language; `fullName` is written to the account |
| Narrative · Headline | `narrative.headline` — the positioning line (*I help … through …*), pasteable |
| Narrative · Bridge story | `jhg.narrative.bridgeStoryOneLine` |
| Narrative · Core competencies | `narrative.superpowers` and `jhg.narrative.leadSkills` as pills; the row quotes the superpowers while the prose is empty |
| True North · Target industry | `jhg.trueNorth.industries[]` → sub-sectors with outlook pill, growth signal, source link |
| True North · Target roles | `jhg.trueNorth.titles` (target · analog · exclude), `keepers`, `clusters[]` (fit · level pills, titles, axes, buys), then `postings[]` as rows with the phrases, the check date and a link |
| True North · Salary range | `jhg.trueNorth.boundaries` — range, floor, negotiation lines |
| True North · Location | `jhg.trueNorth.boundaries` — will work in, exclude, remote, hybrid, relocate, travel, work rights, authorised in, sponsorship |
| True North · Company type | `jhg.trueNorth.companyType` |
| **True North · Boundaries** *(new section, read-only)* | `jhg.trueNorth.boundaries` — hard no's, culture must-haves (deprioritise when absent), soft dislikes, levels to exclude, never apply, notice period. Row: *3 hard no's · 3 must-haves · 2 never apply · 28 days' notice*. |
| Target companies · Top 3 | each row + `jhg.targetCompanies.top3[]` by name — why now, first move, by date |
| Target companies · Top 10 | each row + `jhg.targetCompanies.top10[]` — business problem, thesis, hiring authority, known person, careers-page note, say it loud |
| Target companies · Top 40 | each row + `jhg.targetCompanies.companies[]` — growth signal (with source), location, known contact, found via, website; then *Challenged by your coach* (`challenges[]`) |
| Target companies · every list | `companyLists.*[].scores` on the row's second line — *19 · G5 I5 A4 P5*, mono, mute; legend in the footer |
| Artefacts · Story Bank | stories as STAR-R (`situation · task · action · reflection` around the result), `jhg.artefacts.storyFacts[]` by id (where, lead skill, numbers, source), snapshots with `context · challenge · role · activities · relevance · keyDecisions` behind a *more* disclosure, proof-point `url` as an icon link. The editor carries every one of these through a save. |
| Artefacts · Master CV | `jhg.artefacts.cvHouseRules · lockedSections · currentDomain · languageLearning` |

Not shown, still stored and exported: `jhg.identity.fullName · email` (the account's), `jhg.progress` (the Settings slots read it).

## 5. The file — what changed in the schema (decision A)

`version: 1` gains, validated like everything else (unknown keys and wrong types are errors with a path; caps are warnings):

```yaml
goal:
  seniority: "Senior"            # new; in front of role in every statement
contact:
  location: "Melbourne, Australia"  # was in the storage model and every export, now read back too
narrative:
  proofPoints: [{ name, heroMetric }]
stories: [{ id, title, result, provenance }]
snapshots: [{ company, storyId, title, results: [..] }]
```

**2026-11-05 — `companyLists`.** The Packer's ranked target companies, read on Target companies and edited nowhere. Validated like the rest (unknown list / trend / row keys are errors with a path; `rank` must be a number; `name` is required; a `careersUrlStatus` outside `confirmed · opened_by_coach · none` is a warning and read as unset; 50 rows per trend list). An empty `sunset: []` is fine and reads as absent. Stored on the setup document (`CareerOpsSetupV2.companyLists`), preserved through whole-document saves (`preserveSetupFields`), exported after `watchlist`, one row of the upload review (*Top 3 (3), Top 10 (10), Top 40 (40)*). They **never feed the Scout's watchlist** — `watchlist.companies` stays the member's and the Scout's.

```yaml
companyLists:
  top3:   { sunrise: [ { rank: 1, name: "Wattle HR Cloud", industry: "HR tech", subSector: "Payroll compliance software", companyType: "scaleup", careersUrl: "https://…", careersUrlStatus: "confirmed" } ], sunset: [] }
  top10:  { sunrise: [ … ], sunset: [] }
  all:    { sunrise: [ … ], sunset: [ … ], unclassified: [ … ] }   # shown as "Top 40"
```

A watchlist company with no `careersUrl` is **kept** (warning, not dropped): it stays on Target companies with an empty URL field, and `buildPortalsYaml` leaves it out of the Scout's file until one is added.

**2026-11-05 — `linkedin`.** The LinkedIn profile to build, read on Artefacts → LinkedIn profile and edited nowhere. Mirrors LinkedIn's own sections so each block can be shown against its limit and copied. Validated like the rest: unknown keys and wrong types are errors with a path; `title` + `company` on a role, `title` on a featured item, `school`, `name` are required; row caps are warnings (20 roles · 10 featured · 50 skills · 5 skills per role · 10 schools · 20 certifications). **Text limits are LinkedIn's (headline 220 · About 2,600 · role description 2,000) and are warnings that do not cut the text** — the block is kept whole and shown as over, because knowing it is over is the point. A `featured[].kind` outside `link · post · article · document` is a warning and read as unset. Dates are `"YYYY-MM"` / `"YYYY"` strings (`monthYear` renders *Mar 2022*; an empty `end` on a role is *Present*). Stored on the setup document (`CareerOpsSetupV2.linkedin`), preserved through whole-document saves, exported after the artefacts and before `cv`, one row of the upload review (*Headline · About · 2 roles · …*). The URL stays `contact.linkedin`.

```yaml
linkedin:
  headline: "…"                                   # ≤ 220
  about: |                                        # ≤ 2,600
  experience: [{ title, company, location, start: "2022-03", end: "", description, skills: [≤ 5] }]
  featured: [{ kind: link | post | article | document, title, url }]
  skills: ["…"]                                   # ≤ 50; the first three are the pinned Top skills
  education: [{ school, degree, field, start, end }]
  certifications: [{ name, issuer, issued, url }]
```

Every reader of the file takes the new shape: the Profile page's upload, the CareerOps intake's upload (same codec), and the export. `public/profile.example.yml` carries every key.

**2026-11-07 — the four-file Packer.** Validated like the rest; `public/narrative.example.yml · true-north.example.yml · target-companies.example.yml · artefacts.example.yml` are the Packer's own samples and `tests/profile-files-examples.test.ts` parses, merges and round-trips them.

```yaml
narrative:
  headline: "I help SaaS scale-ups ship predictably …"   # new — the positioning line
  superpowers: ["Release management", …]                 # new
  proofPoints: [{ name, heroMetric, url }]               # url new
stories: [{ id, title, situation, task, action, result, reflection, provenance }]     # STAR-R; situation · task · action · reflection new
snapshots: [{ company, storyId, title, context, challenge, role, activities: [..], results: [..], relevance, keyDecisions: [..] }]
companyLists.<list>.<trend>[]: { …, careersUrlStatus: confirmed | opened_by_coach | corrected | none, scores: { growth, interest, access, proof, total } }   # corrected + scores new
jhg:                                                     # new — the JobHackers workbook, one block per file
  progress: { narrative | trueNorth | targetCompanies | artefacts: { status, updated } }
  identity: { fullName, email, city, country, location, timezone, outputLanguage, alternateEmails: [..], preferredChannel, contactNote }
  narrative: { leadSkills: [..], bridgeStoryOneLine }
  trueNorth: { boundaries: { currency, salaryLower, salaryUpper, salaryFloor, authorizedIn, needsSponsorship, visaStatus, willWorkIn, exclude, remote, localHybrid, relocate, remoteTravel, hardNos, cultureMustHaves, deprioritizeIfAbsent, softDislikes, noticePeriodDays, excludeLevels, neverApply, negotiationLines },
               postings: [{ title, company, location, url, phrases, verified }], keepers: [..], titles: { target, analog, exclude },
               clusters: [{ name, titles, axes, buys, level, fit }], industries: [{ name, subSectors: [{ name, growthSignal, source, outlook, confirmed }] }], companyType }
  targetCompanies: { companies: [{ rank, name, companyType, inspiredBy, industry, subSector, outlook, location, website, growthSignal, growthSource, knownContact, careersUrl, careersUrlStatus, scores }],
                     challenges: [{ company, challenge, resolution }], top10: [{ rank, name, careersUrl, careersUrlStatus, careersUrlNote, hiringAuthorityTitle, knownPerson, thesis, businessProblem, sayItLoud }],
                     top3: [{ name, whyNow, firstMove, byDate }] }
  artefacts: { storyFacts: [{ id, title, role, leadSkill, numbers, sourceStatus, sourceNote }], currentDomain, cvHouseRules: [..], lockedSections: [..], languageLearning: [{ language, currentLevel, targetLevel, targetDate, sentence, countries }] }
```

`jhg` is checked by one declarative shape (`JHG_SHAPE` in `profile-schema.ts`: string · number · string[] · map · rows · record) that the coercer in `maleta.ts` reads too, so the validator and the reader cannot drift. Unknown keys inside it are errors with a path like everywhere else; rows are capped at 100. Stored whole on the setup document (`CareerOpsSetupV2.jhg`), preserved through whole-document saves, exported last. A watchlist with keywords and no companies (the True North file) is a watchlist. `CareerOpsSetupV2.profileFiles` records when each slot was last unpacked and from which filename — app bookkeeping, not a profile field.

## 6. Components

| | |
|---|---|
| `lib/jobhacking/sections.ts` | pages, sections, `?section=` parsing, row summaries, the statement's blanks and text — pure, tested |
| `lib/jobhacking/company-lists.ts` | the ranked lists: labels (`all` → Top 40), trend groups in rank order, facets, company-type words, row text — pure, tested |
| `components/jobhacking/CompanyRow.tsx` | the one company row — ranked lists and watchlist alike |
| `components/jobhacking/CompanyListPanel.tsx` | the same ranked rows on Top 3 / Top 10 / Top 40, grouped sunrise / sunset, read-only (§3b) |
| `components/jobhacking/WatchlistSection.tsx` | the watchlist as rows + keyword pills, *Edit watchlist* → the shared editor (§3c) |
| `lib/jobhacking/story-bank.ts` | the artefacts as rows: proof points, stories with their snapshots on `storyId`, the summary line, provenance words — pure, tested |
| `components/jobhacking/StoryBankPanel.tsx` | proof points · stories (+ snapshots) · unclaimed snapshots as rows, *Edit story bank* (§3d) |
| `components/jobhacking/StoryBankEditor.tsx` | the three lists as rows to add, change and remove; saves only `narrative · stories · snapshots` |
| `lib/jobhacking/linkedin-profile.ts` | LinkedIn's sections in order, which the file fills, the summary line, limits and measures, month-year dates — pure, tested |
| `components/jobhacking/LinkedinProfilePanel.tsx` | one block per LinkedIn section with count against the limit and Copy, read-only (§3d) |
| `components/jobhacking/JobHackingScreen.tsx` | the four pages on `SectionsPage` |
| `components/jobhacking/TrueNorthPanel.tsx` | the five True North editors |
| `components/jobhacking/TrueNorthStatement.tsx` | the lead |
| `components/jobhacking/JobHackingSettings.tsx` | the four slots (§4) |
| `lib/jobhacking/profile-files.ts` | the four files: labels, filenames, which slot a drop is, slot status — pure, tested |
| `lib/jobhacking/workbook.ts` | the `jhg` block as facts: identity, boundaries, titles, scores, story facts, CV rules — pure, tested |
| `components/jobhacking/FileFacts.tsx` | the one read-only block under every editor (§4b) |
| `components/jobhacking/WorkbookPanels.tsx` | the per-section blocks and the Boundaries section |
| `components/profile/SectionsPage.tsx` · `SectionList.tsx` | generalised: take `SectionItem[]` (key, label, title, ask, href, icon, group) instead of the profile registry, so Profile, Settings and JobHacking share one layout; `profileItems()` adapts the profile registry |
| `components/profile/Identity.tsx` | the initials / name / email block, shared |

## 7. RUI score

| Surface | Score | Notes |
|---|---|---|
| `/jobhacking/narrative` | **9 / 10** | The Profile/Settings layout as is: rail + content, overview → drill-in, state glyph + summary per row, `.label` recedes, one red button per screen, 44px targets, `jh-mute` minimum. |
| `/jobhacking/companies` · Top 3 / Top 10 / Top 40 | **9 / 10** | One row model on all three lists, rank order kept, facet line before the rows, no red, no table (§3b). Remaining: the Top 40's sunrise group is ~37 rows with no in-page jump; a sticky group heading or an industry filter on the facet line is the next step if members ask. |
| `/jobhacking/companies` · Watchlist | **8.5 / 10** | Reads as the same rows and pills; the `Portals` editor the audit scored 6.5 (`docs/UX_AUDIT_JOBHACKING.md` §3) is now behind *Edit watchlist* rather than the page itself — its own issues (unlabelled 1fr/2fr inputs, the *Advanced* disclosure per row) remain for a pass of their own. |
| `/jobhacking/true-north` | **9 / 10** | The statement leads and links; five questions, not three storage objects; labelled archetype rows on mobile. Remaining: the statement card is the Compass card verbatim — fine while both portals exist, a second voice if JobHacking ever stands alone. |
| `/jobhacking/artefacts` | **9 / 10** | The company-list row grammar reused for the story bank and the LinkedIn blocks, so the pages read as one portal; the story bank edits behind one button like the watchlist; the CV editor is Settings' own; the LinkedIn count is the only red on the page and only when a block is over its limit. Remaining: a long story's `result` or About wraps long on a phone — a clamp with an expand is the next step if the Packer writes longer ones. |
| `/jobhacking/settings` | **9 / 10** | Four slots in the portal's row grammar, one red button, each row says what it fills and when it was last filled; drop anywhere. Remaining: a slot cannot be cleared — a wrong upload is undone by uploading the right file over it. |

## 8. Revision 2026-11-07 — the same pages on Compass → Settings

The registry here is now rendered by two portals (`docs/UX_SETTINGS_HUB.md`). Nothing on the JobHacking menu changed: `jhSectionsFor(page)` defaults to the JobHacking portal and returns exactly the lists above. Compass → Settings renders the same pages under `/settings/<area>` plus sections flagged `only: "compass"` (Work rights, Portfolio / demo, the Agents area) that this portal never sees. Two fields joined sections both portals share, where their question is asked: **Target roles** now carries the adaptive framing per archetype (`personalization.adaptiveFraming`), **Salary range** the negotiation scripts (`personalization.negotiationScripts`); the upload preview sees them through `jhSectionFields`. The True North statement is the one goal statement everywhere — `lib/goal.ts` owns the sentence; `TrueNorthStatement` takes a `base` so its links go to the portal it is on. JobHacking → Settings renders the shared `ProfileFilesPanel`.
