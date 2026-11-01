# Profile page: upload, visualise, update `profile.yml`

**Scope:** the `/profile` page (sidebar on desktop, header icon on mobile) gains two capabilities: (1) upload a `profile.yml` (shape: `docs/la-maleta.example.yml` → to be renamed `profile.example.yml`; Packer spec v2), (2) see everything in it and edit any part. Export is the round trip.
**Terminology:** this file is the member's **profile**. The earlier "maleta" naming is retired — see `CLAUDE.md`. Legacy identifiers (`lib/careerops/maleta.ts`, `MaletaUpload.tsx`, …) are referenced below by their current names only so the reuse map is accurate; new code uses `profile*`.
**Gate:** none. Every member can upload, view, edit and export their profile whether or not CareerOps is switched on. Firestore already allows it (`users/{uid}/{sub=**}` is owner-writable); the page reads `paths.careerOpsSetup(uid)` with `useLiveDoc` directly instead of through `useCareerOps()`, whose `allowed` check is a CareerOps-portal concern.
**Method:** Refactoring UI's seven principles, scored against the current `/profile` page and the intake wizard tabs that edit this data today. Tokens from `design-system/colors_and_type.css` / `tailwind.config.ts`; rules from `UX_AUDIT_COMPASS_TABS.md §0`.
**Builds on, does not duplicate:** the parse/export/patch functions in `lib/careerops/maleta.ts`, `CvPanel`, `NorthStarSource`, `ContactPolicy`, `Personalization`, `WatchlistPanel`, `Sheet`, `Segmented`, `PageHeader`, `lib/careerops/intake-wizard.ts`.

| Surface today | Score | Verdict |
|---|---|---|
| `/profile` (Account) | **7 / 10** | Clean, but a four-row read-only card. Labels set in `.eyebrow` weigh as much as the values; nothing to do on the page. |
| Intake wizard tabs | **5.5 / 10** | Six pill tabs wrap to two rows at 390px; labels are `font-mono` (nav is Poppins everywhere else); "partial" state is red (red-budget violation); a second tab system next to `Segmented`; `Personalization` rows become N×3 unlabelled stacked inputs on mobile. |

**Target: 9+ / 10** — one navigation pattern per breakpoint, labels recede / values lead, red for the primary action + genuine negatives only, every control ≥ 44px, every section readable before it is editable.

---

## 1. Information architecture — not tabs

### Why the YAML's level-1 keys shouldn't be the UI's level-1

The seven top-level keys (`goal · contact · policy · personalization · watchlist · notes · cv`) are the **storage model**. `contact` + `policy` are one thing to a person (`ContactPolicy.tsx` already treats them as one panel); `personalization` is eight things pretending to be one; `version` is not a section; and name / email / country are portal-owned, *not* in the file, yet must appear on the page.

Seven tabs also fail on mobile on their own (six already wrap), hide state, and give no way to **visualise** the whole file at once — half of the request.

### Recommended: overview list → section (the "settings page" pattern)

One list of sections. Each row *is* the visualisation: label, completion state, a one-line summary of the value. Tapping/clicking a row opens that section's editor.

| # | Section | YAML keys | Editor (exists) | State rule (exists: `wizardStates`) |
|---|---|---|---|---|
| 0 | **Account** | — (portal-owned: name, email, country, archetype) | read-only, as today | — |
| 1 | **North Star** | `goal.*` | `NorthStarSource` | done when `goal.role` set |
| 2 | **Contact & logistics** | `contact.*`, `policy.*` | `ContactPolicy` | 0 → empty · 1–4 → partial · ≥5 → done |
| 3 | **Targeting** | `personalization.*` (8 sub-sections) | `Personalization` (reworked for mobile, §4.3) | n/8 |
| 4 | **Watchlist** | `watchlist.*` | `WatchlistPanel` | done when ≥1 company |
| 5 | **Notes** | `notes` | new `NotesPanel` (today only inside `agents/Setup.tsx`) | has text |
| 6 | **CV** | `cv` | `CvPanel` | has text; "Ready to score / A bit thin" badge |
| — | *Culture screen, Proof points, Stories* | `cultureScreen`, `proofPoints`, `stories` (reserved) | — | registered, `available: false`, **not rendered** (§5.3) |

Section order = the order the agents care about = the order of the YAML export = `WIZARD_STEPS`. The intake wizard keeps its job (first run, guided); the profile page is where you come back.

### Desktop (≥ 768px): rail + content

```
┌─ sidebar ─┐┌──────────────────────────────────────────────────────────────────┐
│ Compass   ││ ACCOUNT                                   [Export ↓] [Upload ↑]  │
│ …         ││ Profile                                                          │
│           ││ Everything the agents know about you, in one place.             │
│ ───────── ││                                                                  │
│ ● Profile ││ ┌─ rail (232) ───────┐ ┌─ content (max-w-2xl) ─────────────────┐│
│   Sign out││ │ AF  Ana Ferreira    │ │ NORTH STAR                 In effect: ││
│           ││ │     ana@…           │ │ Senior Delivery Lead        Compass   ││
│           ││ ├─────────────────────┤ │                                       ││
│           ││ │ ✓ North Star        │ │ (NorthStarSource panel, unchanged)    ││
│           ││ │ ◐ Contact & logist. │ │                                       ││
│           ││ │ ◐ Targeting   6/8   │ │                                       ││
│           ││ │ ✓ Watchlist   10    │ │                                       ││
│           ││ │ ○ Notes             │ │                                       ││
│           ││ │ ✓ CV                │ │  ───────────────────────────────────  ││
│           ││ ├─────────────────────┤ │  [Save North Star]   Saved · 2 min ago││
│           ││ │ 5 of 6 sections     │ └───────────────────────────────────────┘│
│           ││ │ ▓▓▓▓▓▓▓▓▓▓░░ 83%    │                                          │
│           ││ └─────────────────────┘                                          │
└───────────┘└──────────────────────────────────────────────────────────────────┘
```

- Rail is **sticky** (`md:sticky md:top-11`), 232px like the app sidebar; rows reuse the sidebar row recipe (`rounded-sm min-h-[44px] px-3`, active = `bg-jh-red-soft text-jh-red`).
- Active section in the URL: `/profile?section=targeting` (same convention as the wizard's `?step=`), so the upload summary, the Review checklist and agent notes can deep-link to a section.
- Content column `max-w-2xl`; two-column field grids inside, as `ContactPolicy` does. Never full-width.

### Mobile (< 768px): overview → drill-in

```
 ┌────────────────────────────┐    ┌────────────────────────────┐
 │ ⟵ Compass        👤  ⎋     │    │ ‹ Profile                  │
 ├────────────────────────────┤    ├────────────────────────────┤
 │ ACCOUNT                    │    │ TARGETING             6/8  │
 │ Profile                    │    │ What evaluations score     │
 │                            │    │ against.                   │
 │ ┌────────────────────────┐ │    │                            │
 │ │ AF  Ana Ferreira       │ │    │ ┌────────────────────────┐ │
 │ │     ana@anaferreira.nz │ │    │ │ Target roles        3  ›│ │
 │ │     Wellington · NZ    │ │    │ │ Delivery Lead, Eng Ops │ │
 │ └────────────────────────┘ │    │ │ Manager, TPM           │ │
 │                            │    │ ├────────────────────────┤ │
 │ [↑ Upload profile][↓ Export]│   │ │ Adaptive framing    3  ›│ │
 │                            │    │ ├────────────────────────┤ │
 │ 5 of 6 · ▓▓▓▓▓▓▓▓▓▓░░      │    │ │ Exit narrative        ›│ │
 │ ┌────────────────────────┐ │    │ │ "I was the operations  │ │
 │ │ ✓ North Star          ›│ │    │ │  analyst who kept…"    │ │
 │ │ Senior Delivery Lead · │ │    │ ├────────────────────────┤ │
 │ │ Wellington · NZ$150–175k│ │   │ │ Cross-cutting adv.    ›│ │
 │ ├────────────────────────┤ │    │ ├────────────────────────┤ │
 │ │ ◐ Contact & logistics ›│ │    │ │ Portfolio / demo      ›│ │
 │ │ +64 21 555 0199 · floor│ │    │ ├────────────────────────┤ │
 │ │ NZ$140k · NZ/AU        │ │    │ │ Comp targets          ›│ │
 │ ├────────────────────────┤ │    │ ├────────────────────────┤ │
 │ │ ◐ Targeting      6/8  ›│ │    │ │ ○ Negotiation scripts ›│ │
 │ │ 3 roles · exit story · │ │    │ │   Not set              │ │
 │ │ portfolio              │ │    │ ├────────────────────────┤ │
 │ ├────────────────────────┤ │    │ │ Location policy     5  ›│ │
 │ │ ✓ Watchlist       10  ›│ │    │ └────────────────────────┘ │
 │ │ Xero, Tracksuit, Dove… │ │    │                            │
 │ ├────────────────────────┤ │    │                            │
 │ │ ○ Notes               ›│ │    │                            │
 │ │ Not set                │ │    │                            │
 │ ├────────────────────────┤ │    │                            │
 │ │ ✓ CV                  ›│ │    │                            │
 │ │ 412 words · Ready      │ │    │                            │
 │ └────────────────────────┘ │    │                            │
 ├────────────────────────────┤    ├────────────────────────────┤
 │ Compass Perf Progress Coach│    │ Compass Perf Progress Coach│
 └────────────────────────────┘    └────────────────────────────┘
```

- Same component, same URL param: `?section=` absent → overview; present → the section with a `‹ Profile` back row (44px). Drill-in uses `router.push` (it is navigation; browser back must work), unlike the wizard's `replace` between tabs.
- Rows: `px-4 py-3`, `divide-y divide-jh-line` inside one `.card` — rows are not cards (no card-in-card).
- Summary line: `text-sm text-jh-mute`, one line, `truncate`, quoting the data. "Not set" in `text-jh-mute` (readable text, never `mute-2`).

---

## 2. Upload — propose → review → confirm, with a diff

Reuses the existing parse / patch / `buildSetupProfileYaml` functions untouched. What changes is what the member *sees* between pick and save.

### Entry points
- **Desktop:** `PageHeader` `actions` slot: `[Export ↓]` and `[Upload profile ↑]`, both `.btn-secondary`. Neither is the page's primary action — the primary action is each section's **Save**. One red button per screen (§0.4).
- **Mobile:** the same two buttons as a full-width pair under the identity card (`grid grid-cols-2 gap-2`).
- Drag-and-drop anywhere on the desktop page; the Upload button lights `border-jh-red bg-jh-red/5` while a file is over it.

### Step 0 — validate the schema (before anything is shown)

The file must match the `version: 1` profile schema. **Data may be missing; the shape may not be wrong.** A file that fails is refused in the pick step — the review step and `[Unpack it]` never appear.

Rules (pure validator `lib/careerops/profile-schema.ts`, hand-written in house style — no zod — returning `{ ok, errors: { path, message }[] }`, tested against `profile.example.yml` and a set of broken fixtures):

| Check | Result |
|---|---|
| Parses as YAML under `JSON_SCHEMA`; top level is a mapping | else **error** |
| `version` present and `=== 1` | missing → error · higher → error *"written by a newer version of the Packer — update Compass or re-run the Packer with spec v2"* |
| Every top-level key is one of `version goal contact policy personalization watchlist notes cv` | unknown → **error naming the key** (a typo like `goals:` must not vanish silently) |
| Each present section has the right shape: `goal` / `contact` / `policy` mappings of strings (`policy.needsSponsorship` boolean, `policy.authorizedIn` list of strings); `personalization` mapping with `targetRoles` / `adaptiveFraming` lists of mappings, `negotiationScripts` / `locationPolicy` lists of strings, `portfolio` mapping, prose fields strings; `watchlist.companies` list of `{ name, careersUrl? }`, `positive` / `negative` lists of strings; `notes`, `cv` strings | wrong type → **error with the path** (`policy.authorizedIn must be a list of strings, got a string`) |
| Unknown keys inside a section | **error** (same reason as top level) |
| Row caps (≤ 8 target roles, ≤ 25 companies, …) and string caps | **warning** in the review ("exit narrative trimmed to 1200 characters") — the Packer already re-checks these; truncation must not block the file |
| `goal.role` missing | allowed; warning "no job title — North Star will not count" |

**One format.** The profile page accepts `.yml` / `.yaml` in this schema only. The legacy readers for career-ops `config/profile.yml` (`candidate.*`, `target_roles.*`) and `_profile.md` are not offered here: a strict validator needs one shape, the CLI is no longer a Packer target, and a member running the CLI can export a `profile.yml` from it. (Whether the intake wizard's upload keeps the legacy readers is a separate call; recommendation: no — one uploader, shared.)

Error state (pick step):

```
┌─ Upload your profile ───────────────────────────────────── × ┐
│ ⚠ profile.yml doesn't match the profile schema                │
│   · goals — unknown key (did you mean goal?)                  │
│   · policy.authorizedIn — must be a list of strings           │
│   · watchlist.companies[3] — missing name                     │
│   Fix the file and drop it again. Download an example ↓       │
│                                                               │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│       Drop your profile here · .yml · up to N kB              │
│                      [Choose a file]                          │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
└───────────────────────────────────────────────────────────────┘
```

Red is correct here — it is a genuine negative state. Up to 8 errors listed, each with its path; "Download an example" links `docs/profile.example.yml`. Nothing was read into state; the drop zone is ready for the next file.

### Step 1 — pick (a `Sheet`, `size="lg"`)
The existing drop zone verbatim (dashed `border-jh-line-2`, "`.md` or `.yml` · up to N kB", lock line "Read in your browser. Nothing is saved until you confirm.").

### Step 2 — review: *what the file would change*, per section

```
┌─ Upload your profile ───────────────────────────────────── × ┐
│ Found in profile.yml (yaml)                                   │
│ Anything the file doesn't mention is left exactly as it is.   │
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ↻ North Star             replaces                         │ │
│ │   Delivery Lead  →  Senior Delivery Lead                  │ │
│ │   Wellington · NZ$150–175k · Scale-up · B2B SaaS…         │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ + Contact & logistics    adds 4, keeps 1                  │ │
│ │   phone, linkedin, portfolio, visa status · github kept   │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ ↻ Targeting              7 of 8 sections                  │ │
│ │   replaces 3 · adds 4 · negotiation scripts untouched     │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ + Watchlist              10 companies, 5 include, 6 excl. │ │
│ │   ⚠ Timely has no careers URL — skipped                   │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ + Notes                  new                              │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ ↻ CV                     replaces · 412 words · Ready     │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ Replacing 3 sections. Want a copy of what you have now?       │
│ Download current profile ↓                                    │
│ ▸ Show the raw file                                           │
├───────────────────────────────────────────────────────────────┤
│                      [Pick a different file]   [Unpack it ✓]  │
└───────────────────────────────────────────────────────────────┘
```

- Glyphs: `+` adds (green-dark) · `↻` replaces (ink) · `=` unchanged (mute). **Not red** — nothing here is an error. Red only on `⚠` warnings and on a hard parse error.
- Each row is the overview row recipe, so the member learns one shape.
- **Per-section opt-out: later.** Rows are built from `SectionDiff[]` so a checkbox per row is additive.
- **Recovery (decision: schema validation + download, no timed undo).** Malformed files never reach this step (Step 0). What *can* reach it is a valid but wrong file — last month's export, the wrong member's profile — which no validator can detect. For that case, when the diff contains at least one *replace*, the review step says so and offers **Download current profile** (the existing export, one click, survives reload). The member decides *before* the destructive step. A 10-second toast undo was rejected: easy to miss, dies on reload, and holds a whole setup doc in memory.
- "Show the raw file": a `<details>` with the YAML in `font-mono text-xs` on `bg-jh-mist/40`, read-only. Editing happens in the sections, never in raw YAML.

### Step 3 — confirm
`[Unpack it]` is the sheet's single primary button. On success the sheet closes, overview rows re-render from the live doc (already `useLiveDoc`), and a `role="status"` line under the header reads *"Unpacked profile.yml — 6 sections updated."* with links to the sections that changed.

### Export
`[Export ↓]` downloads `profile.yml` built from the setup doc (functions exist; the filename constant changes from `la-maleta` to `profile`, and the three comment lines at the top of the file say "Your JobHacker Compass profile" instead of "La Maleta"). Round trip: export → edit by hand → upload → the review shows exactly what changed.

---

## 3. Visual spec (the seven principles, applied)

### 3.1 Hierarchy — labels recede, values lead
- Overview row: **title** `font-display font-semibold text-jh-ink` (15px) · **summary** `text-sm text-jh-mute` · **count** `font-mono text-xs text-jh-mute` right-aligned · chevron `h-4 w-4 text-jh-mute-2` (decorative).
- State glyph 16px: `✓ Check text-rb-green-dark` · `◐ CircleDashed text-jh-mute` (**not red** as in the wizard) · `○ Circle text-jh-mute-2`.
- Account card: `dt` moves from `.eyebrow` to `.label` (Roboto 500 13px mute) above the value, value `text-jh-ink text-[15px]` — the app's one label philosophy.
- Section header inside content: `.section-label` → `h2 text-lg` → one-line `text-sm text-jh-mute` ask. Panels already do this.

### 3.2 Spacing
`space-y-6` between header / actions / list (24). Row padding `px-4 py-3`. Rail ↔ content `gap-8`. Inside panels unchanged (`space-y-4`). The panels' `rounded-[10px]` alerts and drop zones move to `rounded-sm` (8) inside 12px cards.

### 3.3 Typography
Section labels in **Poppins 600** (`font-display`), never `font-mono` — mono is for counts, YAML and the CV editor only. Summary lines 14px/1.5; CV preview keeps `prose-sm`.

### 3.4 Colour — red budget per screen
Red on: the active rail row, the one Save button in the open section, genuine negatives (parse error, "A bit thin", missing careers URL). Progress-bar fill becomes `bg-jh-ink` (information, not a call to action). Upload/Export are `.btn-secondary`.

### 3.5 Depth
Overview list is one `.card` (`shadow-jh-1`). The rail is flat (navigation, like the sidebar). Sheets `shadow-jh-3`. Nothing else floats.

### 3.6 Icons
Lucide 1.5 stroke: `Compass` North Star · `Contact` contact · `Target` targeting · `Radar` watchlist · `StickyNote` notes · `FileText` CV · `FileUp` / `Download` for the header actions. 20px in rail rows, 16px in overview rows, `aria-hidden` with text beside them.

### 3.7 Layout
Left-aligned everything. Desktop 232 + flexible (content `max-w-2xl`); mobile single column with `AppShell`'s `px-5`.

---

## 4. Component plan

### 4.1 New
| File | What |
|---|---|
| `components/profile/ProfileScreen.tsx` | Page body: header, identity card, actions, `?section=` routing, rail/overview switch by breakpoint (CSS: `hidden md:block` / `md:hidden`). Reads the setup doc with `useLiveDoc(paths.careerOpsSetup(uid))` — no `useCareerOps`, no gate. |
| `components/profile/SectionList.tsx` | Overview rows (mobile) **and** rail rows (desktop) from one registry, two densities via `variant`. |
| `components/profile/ProfileUploadSheet.tsx` | Upload flow in a `Sheet`: pick → review diff → confirm, with "Download current profile" when the diff replaces anything. |
| `components/profile/NotesPanel.tsx` | One textarea + Save, same recipe as `WatchlistPanel`. Lifts `notes` out of `agents/Setup.tsx`. |
| `lib/profile-sections.ts` | Pure, tested: the section registry (key, label, icon, keys owned, `available`, `summarise(setup, profile)`, `state(...)` reusing `wizardStates`). |
| `lib/careerops/profile-schema.ts` | Pure, tested: `validateProfileFile(doc): { ok, errors[] }` — strict shape check, unknown keys and wrong types are errors with a path. |
| `lib/careerops/profile-diff.ts` | Pure, tested: `profileDiff(current, incoming): SectionDiff[]`. |

### 4.2 Reused unchanged
`NorthStarSource`, `ContactPolicy`, `WatchlistPanel`, `CvPanel` mount in the content column as the wizard mounts them. Their own Save buttons stay — one Save per section, no page-level "Save all".

### 4.3 `Personalization` on mobile — the one real rework
Today each target-role / framing row is three `.field` inputs with placeholder-only labels + an X, stacked on mobile. No change to data or validation:
- **< 640px:** each sub-section is a **list of summary rows** (archetype in ink, axes/buys muted second line) + `[+ Add archetype]`. Tap a row → `Sheet size="sm"` with three *labelled* fields and `[Remove]` in the footer's danger slot — the Progress board's add/edit pattern.
- **≥ 640px:** keep the 3-column grid, add a header row of `.label`s above it.
- The eight sub-sections become an accordion on mobile (`<details>`, label + n/8 in the summary); on desktop they stay open.

### 4.4 Wizard alignment (same PR or next)
`IntakeWizard`: tab labels `font-display`; `partial` tone `text-jh-mute`; tabs on `Segmented fill` (≥ md) / horizontally scrolling `Segmented` with `snap-x` (mobile); progress fill `bg-jh-ink`.

### 4.5 Terminology migration (separate task)
Rename `lib/careerops/maleta.ts` → `profile-file.ts` (`Maleta` → `ProfileFile`, `parseMaleta` → `parseProfileFile`, `maletaToYaml` → `profileToYaml`, `MALETA_FILENAME` → `"profile"`), `MaletaUpload` → `ProfileUpload`, the `START_PATHS` copy ("Upload your profile"), `docs/LA_MALETA.md` → `docs/PROFILE_FILE.md`, `docs/la-maleta.example.yml` → `profile.example.yml`, and the three test files. Member-facing copy first (7 strings), identifiers second. The Packer spec's hand-off text ("Get started → maleta") changes on the Rafael Pack side.

---

## 5. Decisions (taken 2026-10-26)

1. **Naming:** profile, not maleta — `CLAUDE.md` carries the rule.
2. **Gate:** none. The page works for every member; CareerOps only changes what *reads* the profile.
3. **Per-section opt-out on upload:** later; the diff rows are built for it.
4. **Undo → schema validation.** The file must match the `version: 1` schema (data may be missing, the shape may not be wrong); a failing file is refused before anything is shown (§2 Step 0). Unknown keys and wrong types are errors with a path; caps are warnings. "Download current profile" stays in the review step for the valid-but-wrong-file case. No timed undo.
5. **Reserved fields** (`cultureScreen`, `proofPoints`, `stories`): registered now with `available: false`, **not rendered** until the worker reads them.
   - *Why hidden:* a field the agents do not read yet is a broken promise — a member fills in a culture screen, nothing changes in their scores, and they learn the page cannot be trusted. Empty rows also add three "Not set" lines and drag the completion count down for things nobody can complete.
   - *Why registered anyway:* they matter — `cultureScreen` is the one field that structurally changes a score, and `proofPoints` / `stories` close the largest quality gap the Packer reports. Registering them means the day the worker reads them, shipping is a one-flag change plus the panel, and the diff/upload path already carries them through (the parser keeps unknown keys out today — that is the one place to extend).
   - *Visible alternative, rejected:* a "coming soon" row teaches members to ignore rows.

---

## 6. Diagnostic (RUI quick checklist) — target state

| Question | Answer in this design |
|---|---|
| Hierarchy reads when squinting? | Title / summary / count are three distinct weights; one red button per screen. |
| Works in grayscale? | State is glyph + text ("Not set", "6/8"), never colour alone. |
| Enough white space? | 24 between groups, 12–16 within; content capped at `max-w-2xl`. |
| Labels de-emphasised? | `.label` everywhere; `.eyebrow` only for the page eyebrow. |
| Spacing on scale? | 4/8/12/16/24/32 only; the 10px radii retired. |
| Text width constrained? | Summaries truncate at one line; prose at `max-w-prose`. |
| Contrast? | Readable text ≥ `jh-mute` (4.8:1); `jh-mute-2` for chevrons/placeholders only. |
| Shadows match elevation? | List `jh-1`, sheet `jh-3`, rail none. |

---

## 7. Revision 2026-11-01 — Profile / Settings split

**Decision:** the member's profile is edited on two pages that sit side by side in the account group of both shells (sidebar rows on desktop, icon targets in the header on mobile): **Profile** (`/profile`) is *who I am and what I'm aiming at*; **Settings** (`/settings`) is *what the agents work from*. One `profile.yml` still carries everything — a section's page is where it is **edited**, not where it is stored. Export and upload stay on Profile and cover the whole file.

**Source of the IA:** the "JHG Compass (UX)" and "JHG keywords" columns of *Career-Ops Profile Config for JHG* (Rafael, 2026-11-01), mapped onto the storage model. Both pages render from one registry (`lib/profile-sections.ts`) through one layout (`components/profile/SectionsPage.tsx`).

### 7.1 Mapping — JHG vocabulary → page section → storage

| JHG Compass (UX) | JHG keywords | Page · section | Storage (`profile.yml`) | Editor |
|---|---|---|---|---|
| **Profile — Who am I** | Header: name, phone, email, LinkedIn, location, portfolio URL (optional) | Profile · **Contact details** — first/last name · phone · email (read-only, the sign-in email) · LinkedIn URL · location · portfolio URL | `firstName`/`lastName`/`email` on the account (`users/{uid}`) · `contact.phone · linkedin · location · portfolio` | `ContactPolicy part="contact"` |
| | Headline (previously *lane statement*) | Profile · **Headline** — its own section, one field | `contact.title` (→ `candidate.title`) | `ContactPolicy part="headline"` |
| | Exit story | Profile · **Exit story** | `personalization.exitNarrative` (→ `narrative.exit_story`) | `Personalization only=[exitNarrative]` |
| | Core competencies (superpowers) | **Settings · Archetypes** — with the framing they feed (moved out of Who am I, 2026-11-01) | `personalization.crossCuttingAdvantage` (→ `narrative.superpowers[0]`) | `Personalization only=[targetRoles, adaptiveFraming, crossCuttingAdvantage]` |
| | Proof points | *reserved* (`proof`) — not rendered | — | — |
| **North Star — What's my target** | Target roles, salary, geographies, industries, company type | Profile · **Target role & market** | `goal.*` | `NorthStarSource` |
| | Target salary (floor), geographies (flexibility, visa, work rights) | Profile · **Salary floor & location** | `policy.*` | `ContactPolicy part="policy"` |
| | Comp targets, negotiation, location policy | Profile · **Comp & location policy** | `personalization.compTargets · negotiationScripts · locationPolicy` | `Personalization only=[…]` |
| | Culture screen | *reserved* (`culture`) | — | — |
| | Target companies / Top 10 / portals to scan | **Settings · Target companies** (cross-linked from Target role & market) | `watchlist.*` | `WatchlistPanel` |
| **Artefacts — What value do I create** | Stories L1 / L2 (CCARR), Proof bank | *reserved* (`stories`, `proof`) — group not rendered until the worker reads them (§5.5) | — | — |
| **Outreach** | — (no JHG keywords yet) | not registered | — | — |
| *(career-ops config)* | Master CV | **Settings · Master CV** | `cv` | `CvPanel` |
| | Archetypes (primary / secondary / adjacent) + framing | **Settings · Archetypes** | `personalization.targetRoles · adaptiveFraming` (+ `crossCuttingAdvantage`, above) | `Personalization only=[targetRoles, adaptiveFraming, crossCuttingAdvantage]` |
| | Portfolio / demo (URL, what, when) | **Settings · Portfolio / demo** | `personalization.portfolio` | `Personalization only=[portfolio]` |
| | Portal credentials | **Settings · Portal accounts** — *only when CareerOps is on* (needs the worker's vault key) | `users/{uid}/careerOpsVault` (not in the file) | `PortalAccounts` |
| | Notes for the agents | **Settings · Notes for the agents** | `notes` | `NotesPanel` |

### 7.2 Page shapes

```
/profile  (rail groups = the JHG questions)          /settings  (flat)
 WHO AM I                                             ✓ Master CV
  ✓ Contact details                                   ✓ Target companies        10
  ✓ Headline                                          ○ Portal accounts   (CareerOps only)
  ○ Exit story                                        ◐ Archetypes                3
 WHAT'S MY TARGET                                     ○ Portfolio / demo
  ✓ Target role & market    Compass                   ✓ Notes for the agents
  ◐ Salary floor & location
  ○ Comp & location policy      0/3
```

- Same rail / overview / drill-in / `?section=` behaviour as §1; `parseSection(raw, sectionsFor(page))` so a Settings URL cannot open a Profile section and `accounts` is only reachable with CareerOps on.
- Section header on the content side gets the group as its eyebrow: `PROFILE · WHO AM I` → `h2` → ask. Rail rows are grouped under `.section-label` questions; mobile rows are one `.card` per group.
- Progress bar per page, over that page's sections. Fill is **ink** (information), as is the targeting progress bar inside `Personalization` (was red).
- The `Personalization` and `ContactPolicy` panels take a subset (`only` / `part`) and **save only that subset** over what is stored, so two panels editing one storage object can never wipe each other.
- Upload review rows are still the **file's** six sections (`FILE_SECTIONS`); each names the page section a member goes to afterwards (`watchlist → Settings · Target companies`, `targeting → Profile · Exit story`).
- **Who am I is exactly three sections** (decision 2026-11-01): Contact details · Headline · Exit story. Contact details is the CV header as the member reads it — name, phone, email, LinkedIn URL, location, portfolio URL (optional) — so the name fields write to the account document and the email is shown read-only (it is the sign-in). `contact.location` is new in the storage model (→ `candidate.location`, falling back to the goal city, then the account country). GitHub is no longer collected on this page; a stored value survives every save. Core competencies left the group for Settings · Archetypes.

### 7.3 Vocabulary

Member-facing labels of the eight targeting sections now use the JHG words — **Archetypes** (was Target roles), **Core competencies** (was Cross-cutting advantage), **Exit story** (was Exit narrative). The headings in the rendered `_profile.md` are unchanged: that file is career-ops' contract.

### 7.4 Not changed

The CareerOps portal's own Setup screen (`/careerops/setup`) and the intake wizard still edit the same documents in one place; they are the first-run path and keep their whole-document behaviour. Retiring the duplicated Setup surfaces in favour of Settings is a separate task.

### 7.5 RUI score

| Surface | Before | After |
|---|---|---|
| `/profile` | 8.5 / 10 (flat six-row list; one section mixed two storage objects and ten fields) | **9 / 10** — grouped by the questions a member actually asks; every section ≤ 2 storage objects; one red button per screen; `.label` headers over the archetype rows; 44px icon buttons everywhere. Who am I reads as the CV header → one-line headline → the story: three sections, each one question, the headline alone on its row instead of buried as the first of five inputs |
| `/settings` | — (lived inside `/careerops/setup` as five stacked cards with one whole-document Save, 42px buttons, `mute-2` hints) | **9 / 10** — same layout as Profile, per-section Save, vault form on `.label`s and `.btn-sm`, hints at `jh-mute` |
| Shell account group | Profile · Sign out | Profile · Settings · Sign out (desktop rows; three 44px icons on mobile) |

Remaining to reach 10: `Personalization`'s three-column rows still stack as unlabelled inputs below `sm` (§4.3 pattern — summary rows + edit sheet — not yet applied); `CvPanel`'s review step still shows a 2-up editor/preview at `md` that is cramped at 768px.
