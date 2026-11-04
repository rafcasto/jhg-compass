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

### The goal has two homes
`lib/careerops/intake.ts`: the Compass goal on `users/{uid}`, or the intake override on the setup document — which an uploaded `profile.yml` sets (`goalSource: "intake"`). A True North save edits **whichever is in effect**, so the statement, the Compass tab (when it is the Compass goal) and the agents' `profile.yml` move together. `goal.seniority` is a field of the one goal form everywhere: Compass edit mode and onboarding now show *Job title* and *Seniority level* as two fields; `roleWithSeniority()` puts them together without doubling a level already typed into the title.

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
- **One secondary button**, *Edit watchlist*, top right of the list. It swaps the read view for the shared editor (`WatchlistPanel` → `Portals`, `intro={false}`) with the red **Save watchlist** and a secondary **Cancel**; a save returns to the read view with a `role="status"` *Saved.* The editor is the same one Settings and intake use, so the two cannot drift — only the JobHacking page wraps it.
- **Empty**: *No companies on your watchlist yet* with *Add companies*, which opens the editor.

Red budget: none on the read view; one Save in edit mode. `WatchlistPanel` gained `intro` · `onSaved` · `onCancel`, all optional, so Settings and the intake wizard render exactly as before.

## 3d. Artefacts — Story Bank · Master CV · LinkedIn profile

**Decision (2026-11-05).** A fourth menu page for what the member *brings*, as opposed to who they are (Narrative), what they aim at (True North) and where (Target companies). Its rail is **Story Bank · Master CV · LinkedIn profile**; the page opens on the Story Bank.

- **Story Bank** reads the Packer's three artefact lists as they are: **Proof points** (name, hero metric as the second line), **Stories** (the Packer's `id` as the mono index, title, result, provenance as a `.pill-neutral` from `sm` — joining the text below it), with each story's **snapshots** filed under it on `storyId` (*Tracksuit · monthly → fortnightly*). A snapshot whose `storyId` matches no story is listed in its own *Snapshots* group rather than dropped. Read-only, like the company lists: the Packer writes them, the member reads them, the empty state sends to Settings and the overview row says *Not in your profile yet*. Same row grammar as `CompanyRow` — `grid-cols-[2rem_1fr_auto]`, 44px minimum, rank/id recedes, the name is the one heavy element — so the two read-only pages read as one portal. Nothing red: *estimate* is how sure the member is of a figure, not a failure.
- **Master CV** is Settings' `CvPanel` on the same `cv` field — one editor, one row summary (*412 words · Ready to score*), wherever it is shown. The upload status line now links the *Master CV* and *Stories & proof points* file sections here (`JH_FILE_EDIT`).

- **LinkedIn profile** (Rafael's call, 2026-11-05: "LinkedIn is nothing but the sections the user needs to build in LinkedIn") reads the new `linkedin` section (§5) as **one block per LinkedIn section, in LinkedIn's order** — Headline · About · Experience · Featured · Skills · Education · Licenses & certifications — only the ones the file carries. Each pasteable block (headline, About, every role's description, the skills list) has a **Copy** `.btn-secondary btn-sm` and a mono count against LinkedIn's limit (*187 / 220*); over the limit is the panel's **one red state** — a block LinkedIn will truncate is a genuine negative. Roles read as `roleLine` (*Delivery Lead · FreightDesk Software*) over `roleMeta` (*Mar 2022 – Present · Wellington*) with the per-role skills as `.pill-neutral`; Featured, Education and Certifications are quiet rows with one `.icon-btn` link where there is a URL. Read-only like the story bank; empty state → Settings; row *Headline · About · 2 roles · 6 skills · 1 school · 1 certification*, count *7/7*.

Rejected: a table for the stories (same reason as §3b); rendering snapshots as their own flat list first (a snapshot is a story pointed at a company — it belongs under the story); one Markdown blob for the LinkedIn profile like `cv` (it can't be measured against per-section limits or copied per block, which is the whole use); an *Open to work* block in `linkedin` (titles and locations are True North — one field, one home); a `url` in `linkedin` (it is `contact.linkedin`).

## 4. Settings

One card: a drop zone, **Upload profile** (the page's single red button), the "read in your browser, nothing saved until you confirm" line, and *What it fills in* — the four pages as rows. Drag-and-drop anywhere on the page. After an unpack, a `role="status"` line lists the updated file sections, each a link to its JobHacking section where one exists (`JH_FILE_EDIT`). No Export here, by decision; the review step's *Download current profile* (offered only when something would be replaced) still works.

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

## 6. Components

| | |
|---|---|
| `lib/jobhacking/sections.ts` | pages, sections, `?section=` parsing, row summaries, the statement's blanks and text — pure, tested |
| `lib/jobhacking/company-lists.ts` | the ranked lists: labels (`all` → Top 40), trend groups in rank order, facets, company-type words, row text — pure, tested |
| `components/jobhacking/CompanyRow.tsx` | the one company row — ranked lists and watchlist alike |
| `components/jobhacking/CompanyListPanel.tsx` | the same ranked rows on Top 3 / Top 10 / Top 40, grouped sunrise / sunset, read-only (§3b) |
| `components/jobhacking/WatchlistSection.tsx` | the watchlist as rows + keyword pills, *Edit watchlist* → the shared editor (§3c) |
| `lib/jobhacking/story-bank.ts` | the artefacts as rows: proof points, stories with their snapshots on `storyId`, the summary line, provenance words — pure, tested |
| `components/jobhacking/StoryBankPanel.tsx` | proof points · stories (+ snapshots) · unclaimed snapshots, read-only (§3d) |
| `lib/jobhacking/linkedin-profile.ts` | LinkedIn's sections in order, which the file fills, the summary line, limits and measures, month-year dates — pure, tested |
| `components/jobhacking/LinkedinProfilePanel.tsx` | one block per LinkedIn section with count against the limit and Copy, read-only (§3d) |
| `components/jobhacking/JobHackingScreen.tsx` | the four pages on `SectionsPage` |
| `components/jobhacking/TrueNorthPanel.tsx` | the five True North editors |
| `components/jobhacking/TrueNorthStatement.tsx` | the lead |
| `components/jobhacking/JobHackingSettings.tsx` | upload |
| `components/profile/SectionsPage.tsx` · `SectionList.tsx` | generalised: take `SectionItem[]` (key, label, title, ask, href, icon, group) instead of the profile registry, so Profile, Settings and JobHacking share one layout; `profileItems()` adapts the profile registry |
| `components/profile/Identity.tsx` | the initials / name / email block, shared |

## 7. RUI score

| Surface | Score | Notes |
|---|---|---|
| `/jobhacking/narrative` | **9 / 10** | The Profile/Settings layout as is: rail + content, overview → drill-in, state glyph + summary per row, `.label` recedes, one red button per screen, 44px targets, `jh-mute` minimum. |
| `/jobhacking/companies` · Top 3 / Top 10 / Top 40 | **9 / 10** | One row model on all three lists, rank order kept, facet line before the rows, no red, no table (§3b). Remaining: the Top 40's sunrise group is ~37 rows with no in-page jump; a sticky group heading or an industry filter on the facet line is the next step if members ask. |
| `/jobhacking/companies` · Watchlist | **8.5 / 10** | Reads as the same rows and pills; the `Portals` editor the audit scored 6.5 (`docs/UX_AUDIT_JOBHACKING.md` §3) is now behind *Edit watchlist* rather than the page itself — its own issues (unlabelled 1fr/2fr inputs, the *Advanced* disclosure per row) remain for a pass of their own. |
| `/jobhacking/true-north` | **9 / 10** | The statement leads and links; five questions, not three storage objects; labelled archetype rows on mobile. Remaining: the statement card is the Compass card verbatim — fine while both portals exist, a second voice if JobHacking ever stands alone. |
| `/jobhacking/artefacts` | **9 / 10** | The company-list row grammar reused for the story bank and the LinkedIn blocks, so the read-only pages read as one portal; the CV editor is Settings' own; the LinkedIn count is the only red on the page and only when a block is over its limit. Remaining: a long story's `result` or About wraps long on a phone — a clamp with an expand is the next step if the Packer writes longer ones. |
| `/jobhacking/settings` | **9 / 10** | One action, one card, `max-w-2xl`; the empty state tells the member what the file does. |
