# JobHacking portal

**Decision (2026-11-03):** a third portal beside Compass and CareerOps, in the same shell. Three menu pages — **Profile · True North · Target companies** — plus **Settings**, which is one thing: upload a `profile.yml`. It renders from the same documents as Compass (`users/{uid}` and `users/{uid}/careerOps/setup`): a section here is another door onto the same field, never a copy.

**Method:** Refactoring UI's seven principles, applied through the Compass profile pages' own system (`docs/UX_PROFILE.md`, `docs/UX_AUDIT_COMPASS_TABS.md §0`). Nothing new was designed where the Compass system already had the answer; the one new piece is the True North statement.

**Rule:** no field is invented. Every section reads something `profile.yml` carries (schema below). Where the spec named something the file did not have (*Target seniority*), the field was added to the file's schema — on Rafael's explicit call — rather than derived.

## 1. Who sees it

| | How it is switched on | Where |
|---|---|---|
| Existing member | `accessGrants/{uid}.features.jobHacking = true` | Admin → TOFU → Access renewals → *JobHacking portal* row (Enable / Disable for the selected members); `JobHacking` column shows the state |
| New member, JobHacking only | A registration link with **Portal: JobHacking only** | Admin → TOFU → Registration access → Registration links. Signing up through it sets `features: { jobHacking: true, compass: false }` and lands on `/jobhacking/profile`. No Compass onboarding, no Compass email sequence. |
| Admin | always | — |

`features.compass` is absent for every member who predates this (absent = on). The Compass shell sends a JobHacking-only member to `/jobhacking/profile` before its onboarding gate. The portal switcher (the logo) lists whichever portals the member has.

Routes: `/jobhacking/profile` · `/jobhacking/true-north` · `/jobhacking/companies` · `/jobhacking/settings`. The account group of the JobHacking shell is **Settings · Sign out** (Profile is a primary tab there, so it is not repeated).

## 2. Mapping — menu → section → `profile.yml` → editor

| Page · section | `profile.yml` | Editor |
|---|---|---|
| **Profile · Contact details** | name + email on the account; `contact.phone · linkedin · location · portfolio` | `ContactPolicy part="contact"` |
| **Profile · Core competencies** | `personalization.crossCuttingAdvantage` | `Personalization only=[crossCuttingAdvantage]` |
| **Profile · Headline** | `contact.title` | `ContactPolicy part="headline"` |
| **Profile · Exit story** | `personalization.exitNarrative` | `Personalization only=[exitNarrative]` |
| **True North · Target roles** | `goal.role` + `personalization.targetRoles[]` (archetype · axes · buys) | `TrueNorthPanel section="roles"` |
| **True North · Target seniority** | `goal.seniority` *(new, decision B)* | `TrueNorthPanel section="seniority"` |
| **True North · Target salary** | `goal.salary` + `policy.minimumSalary` + `personalization.compTargets` | `TrueNorthPanel section="salary"` |
| **True North · Target industry** | `goal.subsector` + `goal.companyType` *(decision C)* | `TrueNorthPanel section="industry"` |
| **True North · Target location** | `goal.city` + `policy.locationFlexibility` + `personalization.locationPolicy[]` *(visa / work rights left out, decision D)* | `TrueNorthPanel section="location"` |
| **Target companies** | `watchlist.companies[]` + `watchlist.positive` / `negative` *(decision E)* | `WatchlistPanel` |
| **Settings** | the whole file | `ProfileUploadSheet` (pick → review the diff → unpack) |

Not on the menu, still in the file and stored: `personalization.adaptiveFraming · negotiationScripts · portfolio`, `policy.visaStatus · authorizedIn · needsSponsorship`, `contact.github`, `notes`, `cv`, and the artefacts (`narrative.proofPoints`, `stories`, `snapshots`). They survive every save and every export.

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

Every value is a link to the section that fills it; a blank renders the template's own bracketed label, dimmed, so the sentence keeps its shape. The five rail rows are the five blanks' questions — a member never sees *goal*, *policy* or *personalization*. Each section's Save writes only its own fields (the goal subset to the goal in effect, the policy subset merged into `policy`, the personalization subset merged into `personalization` and re-rendered into `profileMd`), and rebuilds `profileYaml` from the result.

`Target industry`'s company-type select lists `COMPANY_TYPES` and, when the stored value is not one of them (an uploaded "Scale-up"), that value too — it is never silently dropped. Archetype rows carry visible labels below `sm` (the gap `UX_PROFILE.md §7.5` names) and a column head above it.

## 4. Settings

One card: a drop zone, **Upload profile** (the page's single red button), the "read in your browser, nothing saved until you confirm" line, and *What it fills in* — the three pages as rows. Drag-and-drop anywhere on the page. After an unpack, a `role="status"` line lists the updated file sections, each a link to its JobHacking section where one exists (`JH_FILE_EDIT`). No Export here, by decision; the review step's *Download current profile* (offered only when something would be replaced) still works.

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

A watchlist company with no `careersUrl` is **kept** (warning, not dropped): it stays on Target companies with an empty URL field, and `buildPortalsYaml` leaves it out of the Scout's file until one is added.

Every reader of the file takes the new shape: the Profile page's upload, the CareerOps intake's upload (same codec), and the export. `public/profile.example.yml` carries every key.

## 6. Components

| | |
|---|---|
| `lib/jobhacking/sections.ts` | pages, sections, `?section=` parsing, row summaries, the statement's blanks and text — pure, tested |
| `components/jobhacking/JobHackingScreen.tsx` | the three pages on `SectionsPage` |
| `components/jobhacking/TrueNorthPanel.tsx` | the five True North editors |
| `components/jobhacking/TrueNorthStatement.tsx` | the lead |
| `components/jobhacking/JobHackingSettings.tsx` | upload |
| `components/profile/SectionsPage.tsx` · `SectionList.tsx` | generalised: take `SectionItem[]` (key, label, title, ask, href, icon, group) instead of the profile registry, so Profile, Settings and JobHacking share one layout; `profileItems()` adapts the profile registry |
| `components/profile/Identity.tsx` | the initials / name / email block, shared |

## 7. RUI score

| Surface | Score | Notes |
|---|---|---|
| `/jobhacking/profile` · `/jobhacking/companies` | **9 / 10** | The Profile/Settings layout as is: rail + content, overview → drill-in, state glyph + summary per row, `.label` recedes, one red button per screen, 44px targets, `jh-mute` minimum. |
| `/jobhacking/true-north` | **9 / 10** | The statement leads and links; five questions, not three storage objects; labelled archetype rows on mobile. Remaining: the statement card is the Compass card verbatim — fine while both portals exist, a second voice if JobHacking ever stands alone. |
| `/jobhacking/settings` | **9 / 10** | One action, one card, `max-w-2xl`; the empty state tells the member what the file does. |
