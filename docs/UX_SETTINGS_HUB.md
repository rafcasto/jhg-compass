# Compass · Settings as the one profile — proposal

**Status:** built (2026-11-07) — decisions in §6 taken as recommended, plus one more: the Compass goal statement and onboarding step 2 now read as the True North statement (§9). Scope: the Compass portal (and the CareerOps shell's account group). The JobHacking portal keeps rendering exactly as it did.

**Ask (Rafael, 2026-11-07):** (1) take *Profile* out of the Compass menu; (2) redesign *Settings* so everything the JobHacking portal does lives inside it — without breaking Compass.

**Method:** Refactoring UI's seven principles, scored against the current `/profile` + `/settings` pair and the JobHacking pages, applied through the existing system (`docs/UX_AUDIT_COMPASS_TABS.md §0`, `docs/UX_PROFILE.md`, `docs/UX_JOBHACKING.md`). No new component where one already exists.

---

## 0. Where we are — score 6 / 10

| Surface today | What's wrong (Refactoring UI lens) |
|---|---|
| Account group: **Profile · Settings · Sign out** | Two doors onto one `profile.yml`. "Who am I" vs "what the agents work from" is a storage split, not a member's question — the Compass tab's goal is on *Profile*, the companies it is scored against are on *Settings*, and the page cross-links to say so. **Hierarchy:** two equal rows for one thing. |
| `/profile` — 6 sections, 2 groups, Export · Upload | Fine on its own; but Upload here only knows one whole-file `profile.yml`, while JobHacking → Settings knows the Packer's **six files** (four at the time of this audit). Two upload grammars for one member. |
| `/settings` — 6 flat sections | Flat list mixes *master CV* (the member's most important artefact) with *notes* and *portfolio*. **Hierarchy:** everything the same weight. |
| JobHacking portal — Narrative · True North · Target companies · Artefacts · Settings | The better IA (JobHackers vocabulary, True North statement, ranked company lists, story bank, LinkedIn blocks, workbook facts beside each field). A Compass member with `features.jobHacking` off never sees it; one with it on sees the same fields twice under two names (*Exit story* / *Bridge story*). |

**Fields Compass edits that the JobHacking menu does not** (would be orphaned by a naive "Settings = JobHacking"): `policy.visaStatus · authorizedIn · needsSponsorship` (Profile · Salary floor & location), `personalization.negotiationScripts` (Profile · Comp & location policy), `personalization.adaptiveFraming` (Settings · Archetypes), `personalization.portfolio`, `notes`, and the **portal accounts** vault. Each one keeps an editor below — none is dropped.

---

## 1. Target IA — Settings is a hub, the JobHacking pages are its areas

```
Compass shell                                   account group
  Compass · Performance · Progress · Coaching     Settings · Sign out        ← Profile row gone

/settings                      the hub: who I am · five areas · my profile files
/settings/narrative            Contact details · Headline · Bridge story · Core competencies
/settings/true-north           Target industry · Target roles · Seniority · Salary range · Location · Work rights* · Company type · Boundaries
/settings/companies            Top 3 · Top 10 · Top 40 · Watchlist
/settings/artefacts            Story Bank · Master CV · LinkedIn profile · Portfolio / demo*
/settings/agents*              Portal accounts (CareerOps only) · Notes for the agents
```

`*` = Compass-only sections / area (the fields the JobHacking menu leaves out). They are flagged in the registry, not a second registry — the JobHacking portal filters them away and renders exactly what it renders today.

**One registry, two portals.** `lib/jobhacking/sections.ts` already is the richer registry (every section → `profile.yml` field → editor → summary → upload-preview fields). It becomes *the* registry for sectioned pages; `lib/profile-sections.ts` keeps what both portals share (`FILE_SECTIONS`, `sectionSummaries`, the targeting labels) and loses `PROFILE_SECTIONS` / `sectionsFor("profile" | "settings")`. Every `JH_SECTION` gains an optional `only?: "compass"`; every `JH_PAGE` an optional `only?: "compass"`. `jhSectionsFor(page, { portal })` filters. `jhSectionHref(key, base)` takes the base (`/settings` or `/jobhacking`).

**Where the orphaned fields land** (rule: a field goes where its *question* is asked, next to the field that already answers half of it):

| Field | Today | Proposed | Editor (exists) |
|---|---|---|---|
| `policy.visaStatus · authorizedIn · needsSponsorship` | Profile · Salary floor & location | **True North · Work rights** (after Location) — Compass-only, so decision D of `UX_JOBHACKING.md` (visa out of the JH *Location*) still holds | `ContactPolicy part="workRights"` — a new subset of the existing panel (`part="policy"` minus the two fields True North already edits); saves only its three keys |
| `personalization.negotiationScripts` | Profile · Comp & location policy | **True North · Salary range** — its ask already says *"how you talk about your number"* | `TrueNorthPanel section="salary"` + one list field (both portals; `jhSectionFields("salary")` gains it so the upload preview stays exact) |
| `personalization.adaptiveFraming` | Settings · Archetypes | **True North · Target roles** — the ask already says *"what a company is buying"*; framing is the answer per archetype | `TrueNorthPanel section="roles"` + the framing rows (both portals) |
| `personalization.portfolio` | Settings · Portfolio / demo | **Artefacts · Portfolio / demo** — it is an artefact — Compass-only | `Personalization only=["portfolio"]` (as today) |
| `notes` | Settings · Notes for the agents | **Agents · Notes for the agents** — Compass-only | `NotesPanel` (as today) |
| vault | Settings · Portal accounts | **Agents · Portal accounts** — Compass + CareerOps on | `PortalAccounts` (as today) |
| `contact.github` | nowhere on a menu | stays in the Contact details editor as today | — |

Two of these (negotiation scripts, adaptive framing) touch the JobHacking portal too, as two extra fields inside sections it already has. If you'd rather keep JobHacking frozen, both go to the **Agents** area as *Framing & scripts* instead — see §6, decision 3.

---

## 2. The hub — `/settings`

Desktop keeps the 232 px left column the area pages use for their rail, so the eye never jumps:

```
ACCOUNT
Settings                                                       [⬇ Export profile.yml]
Everything the agents work from. Upload your coach's files, or open any area and fill it in.

┌ 232px ───────────┐  ┌───────────────────────────────────────────────────────────────┐
│ ◯ RM             │  │ YOUR PROFILE                                                  │
│ Rafael Marquez   │  │ ┌───────────────────────────────────────────────────────────┐ │
│ rafael@…         │  │ │ ✓ Narrative        Rafael Marquez · +61 … · LinkedIn   4/4 ›│ │
│ Australia        │  │ │ ◐ True North       Senior Data PM · Sydney · AUD 200k  5/8 ›│ │
│                  │  │ │ ○ Target companies Not in your profile yet             0/4 ›│ │
│ 9 of 21 sections │  │ │ ◐ Artefacts        1,240 words · Ready to score        2/4 ›│ │
│ ━━━━━━━━━━━━━ 43%│  │ │ ○ Agents           Not set                             0/2 ›│ │
│                  │  │ └───────────────────────────────────────────────────────────┘ │
│                  │  │                                                               │
│                  │  │ YOUR PROFILE FILES                    2 of 6                  │
│                  │  │ ┌───────────────────────────────────────────────────────────┐ │
│                  │  │ │ ✦ Narrative   narrative.yml   ✓ Uploaded 3 Nov    [Replace]│ │
│                  │  │ │ ➤ True North  true-north.yml  ✓ Uploaded 3 Nov    [Replace]│ │
│                  │  │ │ ▦ Target cos  target-comp…yml ◌ Not uploaded yet   [Upload]│ │
│                  │  │ │ ▤ Story Bank  story-bank.yml  ◌ Not uploaded yet   [Upload]│ │
│                  │  │ │ ▤ Master CV   master-cv.yml   ◌ Not uploaded yet   [Upload]│ │
│                  │  │ │ ▤ LinkedIn    linkedin.yml    ◌ Not uploaded yet   [Upload]│ │
│                  │  │ │ ┈ Drop one file — or all of them — anywhere on this page ┈│ │
│                  │  │ └───────────────────────────────────────────────────────────┘ │
└──────────────────┘  └───────────────────────────────────────────────────────────────┘
```

- **Area rows** are `SectionList variant="rows"` — the exact row grammar of every mobile overview (state glyph · heavy label · mute summary · mono count · chevron). An area's state is *done* when every section is, *partial* from the first, *empty* otherwise; its summary is its first section's summary (so the row quotes data, not a description); its count is `done/total`. One pure function, `jhAreaRows()`, tested.
- **Files card** is `JobHackingSettings`' card, lifted out as `ProfileFilesPanel` and used by both the hub and JobHacking → Settings (which becomes that panel under its own header — no change for JobHacking members).
- **Export** stays a page action (whole `profile.yml`, as today); **Upload** is the files card's one red button. The hub is the one page with a primary button; area pages have none above the fold (their Save is inside the panel).
- **Hierarchy** — one `h1`, two `.section-label` eyebrows, rows in cards. Labels recede (`.label` / mono counts in `jh-mute`), values carry weight. Red only on *Upload files* and the active nav row. Radii 8 / 12 (cards), nothing arbitrary. Spacing stays on the 4/8/16/24/32 scale the shell uses (`space-y-6`, `gap-8`).
- **Mobile** — the same page stacked: identity card → Export/Upload pair → progress → area rows → files card. The drag-and-drop stays on the whole page.

## 3. An area — `/settings/true-north`

`JobHackingScreen` with `base="/settings"` and `portal="compass"`. Same `SectionsPage`, same rail, same panels, same `FileFacts` under every editor, same True North statement as the lead. Three small differences:

1. Eyebrow **Settings** instead of *JobHacking*; the section header's eyebrow reads `SETTINGS · TRUE NORTH`.
2. The rail gets a first row **‹ Settings** (mute, 44 px, `ArrowLeft`) above the identity — the desktop twin of the mobile back row `SectionsPage` already draws. New optional `parent` prop on `SectionsPage`; the JobHacking portal doesn't pass it and is unchanged.
3. The mobile overview gets the same **‹ Settings** row above the identity card. Depth on a phone becomes Settings → area → section (one tap more than today's two). Accepted: the hub's rows quote the data, so most visits stop at the hub.

## 4. The shell

- **Compass** account group: `profileHref: null` — the row and the header icon disappear; `shell-account-nav.test.tsx` already covers a `null` profile row. **CareerOps** shell: same (it edits the same file; keeping a Profile row there alone would be the old split in one portal). **JobHacking** shell: untouched.
- `/profile` and `/profile?section=…` **redirect** (`lib/settings-redirects.mjs`, imported by `next.config.mjs`: one entry per old section key → `/settings/<area>?section=<key>`, then `/profile` → `/settings`) so saved links keep working; `tests/settings-redirects.test.ts` checks every target is a real Compass Settings section. `app/(app)/profile/page.tsx`, `ProfileScreen.tsx`, `SettingsScreen.tsx` are deleted. (`app/(app)/layout.tsx` now sends JobHacking-only members to `JH_HOME` directly instead of through the `/jobhacking/profile` redirect.)
- `PortalSwitcher` hint for Compass gains "profile" → *Goal, performance, progress board, coaching, profile* so the switcher still says where the profile lives.

## 5. What does not change

- Storage. Still `users/{uid}` + `users/{uid}/careerOps/setup`; every panel saves the subset it saves today; `goalWrites` / `goalInEffect` stay the one reading of the goal.
- `profile.yml` schema, the six Packer files (four at the time; decision 2026-11-09, `docs/UX_JOBHACKING.md §4`), `mergeProfile`, `ProfileUploadSheet`, `jhFilePreview`, `public/*.example.yml`, `tests/profile-files-examples.test.ts`.
- Every panel: `ContactPolicy`, `Personalization`, `TrueNorthPanel`, `CompanyListPanel`, `WatchlistSection` + `WatchlistPanel`, `StoryBankPanel` + editor, `CvPanel`, `LinkedinProfilePanel`, `PortalAccounts`, `NotesPanel`, `FileFacts`, `WorkbookPanels`.
- The JobHacking portal's four pages and its Settings (the files panel is the same component under the same header), the JobHacking-only registration path, the admin TOFU switches.
- The Compass tab, Performance, Progress, Coaching, onboarding wizard, CareerOps intake / setup.

## 6. Decisions I need from you

1. **Vocabulary** — the Settings areas use the JobHacking names (*Narrative*, *Bridge story*, *True North*) rather than Compass's (*Who am I*, *Exit story*, *North Star*). One name per thing across both portals. **Recommend yes.**
2. **CareerOps shell** also loses the Profile row (same file, same Settings). **Recommend yes.**
3. **Negotiation scripts → True North · Salary range** and **adaptive framing → True North · Target roles**, in both portals (two extra fields inside two existing sections) — or keep JobHacking frozen and put both under **Agents · Framing & scripts** (Compass-only). **Recommend the first:** it is where the question is asked, and the upload preview stays "exactly the sections of the page".
4. **Mobile depth** — accept Settings → area → section (three levels), or flatten the hub's area rows into one long grouped overview on mobile only (21 rows). **Recommend three levels**; the hub rows quote the data.

## 7. Build order — each step ships green on its own

| Step | Change | Touches | Guard |
|---|---|---|---|
| 1 | Registry: `only: "compass"` on sections/pages; `jhSectionsFor(page, { portal })`; `jhSectionHref(key, base)`; `jhAreaRows()`; new sections *Work rights*, *Portfolio / demo*, *Notes*, *Portal accounts*, the *Agents* page | `lib/jobhacking/sections.ts`, `lib/profile-sections.ts` (shrinks), tests | `jobhacking-sections.test.ts` keeps asserting the JobHacking pages are *exactly* today's lists (filtered view); new cases for the Compass view |
| 2 | `ContactPolicy part="workRights"`; `TrueNorthPanel` roles + framing, salary + scripts; `jhSectionFields` updated | two panels, their tests, `profile-files-packer.test.ts` | parity test: every `profile.yml` field that had an editor still has one |
| 3 | `ProfileFilesPanel` lifted out of `JobHackingSettings`; `SectionsPage parent` prop; `JobHackingScreen base / portal` props | `components/jobhacking/*`, `components/profile/SectionsPage.tsx` | JobHacking pages render byte-identical (snapshot of the rail + header) |
| 4 | Routes: `app/(app)/settings/page.tsx` → hub (`SettingsHub.tsx`); `app/(app)/settings/[area]/page.tsx` → `JobHackingScreen`; redirects for `/profile*`; delete `ProfileScreen`, `SettingsScreen`, `app/(app)/profile` | `app/(app)/**`, `next.config.mjs` | `profile-sections.test.ts` rewritten as redirect-map + hub-rows tests |
| 5 | Shell: `profileHref: null` for compass (+ careerops); switcher hint; fix the `/jobhacking/profile` redirect | `AppShell.tsx`, `PortalSwitcher.tsx`, `app/(app)/layout.tsx` | `shell-account-nav.test.tsx` |
| 6 | Docs: `CLAUDE.md` terminology block (two pages → one hub), `UX_PROFILE.md §8`, `UX_JOBHACKING.md §6` pointer | docs | — |

Steps 1–3 are additive (nothing a member sees changes); 4–5 are the switch. All six are one PR on this branch, or two (1–3, 4–6) if you want the additive half merged first.

## 8. Score after — 9 / 10

| Principle | Before → after |
|---|---|
| Visual hierarchy | Two equal account rows → one. Flat Settings → hub (areas) → sections, with the member's data in every row. |
| Spacing & sizing | Unchanged system; the hub reuses the 232 px / `gap-8` grid so the hub and its areas share one geometry. |
| Typography | Unchanged scale; one `h1`, `.section-label` eyebrows, mono counts. |
| Color | Red only on *Upload files* + active nav; progress bar ink; states glyph + text, never colour alone. |
| Depth | Cards at `shadow-jh-1`; the upload sheet at `shadow-jh-3`. Nothing new floats. |
| Images & icons | Same Lucide set, 1.5 stroke; area icons = the JobHacking tab icons so a member who has both portals recognises them. |
| Layout | Left-aligned throughout; text constrained to `max-w-prose`; no centred cards. |

The missing point: three levels on a phone. Revisit if the hub's rows aren't enough and members keep drilling to the same section — a "Recently edited" row on the hub would be the next move, not a flatter tree.

## 9. Addendum (built 2026-11-07) — one statement, and what landed

**The goal statement matches True North, on the Compass tab and in onboarding** (Rafael, 2026-11-07). `lib/goal.ts` owns the sentence (`trueNorthBlanks · trueNorthText · TRUE_NORTH_PLACEHOLDERS · TRUE_NORTH_ORDER`; `lib/jobhacking/sections.ts` re-exports them); `GoalStatement` (Compass tab, onboarding step 2) and `TrueNorthStatement` (JobHacking and Settings → True North) render it. `GoalFields` takes the statement's order — title + level · industry · location · salary · company type — and True North's labels (*Industry / sub-sector*, *Location*, *Salary range*). The eyebrow defaults (`compass.goalEyebrow`, `onb.goalEyebrow`, `onb.goalIntro`) say *Your True North*; an admin's own copy in Content still wins.

**What landed, against §7:**

| Step | Done |
|---|---|
| 1 Registry | `ProfilePortal`, `only` / `requires` on sections, `AGENTS_PAGE` + `jhPagesFor`, `jhPageHref` / `jhSectionHref(key, base)`, `jhSectionsFor(page, { portal, careerOps })`, `jhFileEditHref`, `jhAreaRows`; `lib/profile-sections.ts` is the shared part only. Found and fixed on the way: an empty rules list counted as "1/3" on Location. |
| 2 Panels | `ContactPolicy part="workRights"`; `TrueNorthPanel` roles + `FramingRows`, salary + `LineList` (both exported from `Personalization.tsx`, not copied); `jhSectionFields` carries `framing` / `scripts`. |
| 3 Components | `ProfileFilesPanel` (shared by JobHacking → Settings and the hub; page-wide drops come in through `dropped`); `SectionsPage parent`; `JobHackingScreen portal / careerOps / accounts / publicKey`; `TrueNorthStatement base`; `ProfileUploadSheet portal` → `jhFilePreview(…, { portal, careerOps })`; `components/jobhacking/pageIcons.ts`. |
| 4 Routes | `app/(app)/settings/page.tsx` → `SettingsHub`; `app/(app)/settings/[area]/page.tsx` → `SettingsArea` (404 for an unknown area); redirects as §4. |
| 5 Shell | `profileHref` defaults to `null` in both chromes; `AppShell` account group is Settings · Sign out on every portal; switcher hints renamed. |
| 6 Docs | `CLAUDE.md` terminology, this file, pointers in `UX_PROFILE.md §8` and `UX_JOBHACKING.md §8`. |

`NorthStarSource` stays: the CareerOps intake wizard still uses it.
