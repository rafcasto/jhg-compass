# JobHacker Compass — project rules

## Terminology

- **"Profile", never "maleta".** The one-file export/import of everything the agents know about a member
  (`version · goal · contact · policy · personalization · watchlist · notes · cv`) is the member's **profile**
  (`profile.yml`). The earlier "la maleta / suitcase" naming is retired (decision 2026-10-26). New code,
  copy, docs, filenames and identifiers say *profile*: `ProfileUpload`, `profileToYaml`, "Upload your profile",
  `profile.yml`. Existing `maleta*` identifiers in `lib/careerops/maleta.ts`, `MaletaUpload.tsx`,
  `StartChooser.tsx`, `IntakeScreen.tsx`, `docs/LA_MALETA.md` and their tests are legacy; rename them when
  touched, and never add new ones.
- The profile is edited on two sibling pages in the shell's account group (decision 2026-11-01,
  `docs/UX_PROFILE.md §7`): `/profile` is *who I am and what I'm aiming at* (Who am I = exactly contact details, headline, exit story;
  What's my target = target role & market, salary floor & location, comp & location policy); `/settings` is *what the agents work
  from* (master CV, target companies, portal accounts, archetypes & core competencies, portfolio / demo, notes). Neither is gated
  on CareerOps being enabled — only the **Portal accounts** section needs it (the vault key comes from the
  worker). Export and upload of the whole `profile.yml` live on `/profile`. Both pages render from
  `lib/profile-sections.ts` through `components/profile/SectionsPage.tsx`; add a section there, not a page.

- **JobHacking portal** (decision 2026-11-03, `docs/UX_JOBHACKING.md`): a third portal — Narrative · True North · Target
  companies · Artefacts, plus Settings (upload only) — on the **same documents** as Compass. Its registry is `lib/jobhacking/sections.ts`;
  its pages render through the same `components/profile/SectionsPage.tsx`. Switched on per member (`features.jobHacking`) or by a
  "JobHacking only" registration link (`features.compass: false`). Never invent a field for it: every section reads
  something `profile.yml` carries. `goal.seniority` is a real goal field (True North · Target seniority).
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
  **The four Packer files** (decision 2026-11-07, `docs/UX_JOBHACKING.md §4, §4b, §5`): the Packer writes `narrative.yml · true-north.yml ·
  target-companies.yml · artefacts.yml`, subsets of the one schema; JobHacking → Settings is four slots (`lib/jobhacking/profile-files.ts`),
  the shared `ProfileUploadSheet` takes several files, and an upload **merges key by key** (`mergeProfile`) — never replace a section whole,
  never drop a field a file doesn't mention. **The upload preview for one of the four files lists exactly the sections of its page, with the
  page's labels — nothing more, nothing less** (`jhFilePreview` over `jhSectionFields`); a file fills the editable fields of its page
  (`shapeJhFile`: `narrative.headline` → Headline, `narrative.superpowers` → Core competencies; `jhg.identity.fullName` → the account's first and last name on `users/{uid}`, since name and email are the account's, not the profile's), and the page's own file wins a shared field. Each file's `jhg` block (the workbook: identity, boundaries, titles, clusters, postings, company
  research, scores, story facts, CV rules) is stored on `CareerOpsSetupV2.jhg` and shown **read-only beside the field it explains** through
  `components/jobhacking/FileFacts.tsx` — never as a page of its own, never editable. `public/*.example.yml` are the Packer's samples and
  `tests/profile-files-examples.test.ts` is the contract; change the schema and update them together.

## Design

- Follow `docs/UX_AUDIT_COMPASS_TABS.md §0` on every screen: one button system (`.btn-*`), labels recede
  (`.label`), radii 4/8/12/16/24 only, red = primary action + active nav + genuine negative state only,
  readable text never `jh-mute-2`, icon-only controls are `.icon-btn` with `aria-label`, 44px targets.
- Profile page IA is specified in `docs/UX_PROFILE.md` (overview list → section; rail on desktop,
  drill-in on mobile). Do not add a second tab system; reuse `Segmented` and `Sheet`.
