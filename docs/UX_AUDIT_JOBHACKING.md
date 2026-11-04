# Refactoring UI audit — the JobHacking portal

**Scope:** `/jobhacking/narrative` (called Profile when this was written) · `/jobhacking/true-north` · `/jobhacking/companies` · `/jobhacking/settings`, plus the shell pieces only this portal shows (switcher row, Settings-only account group).
**Method:** Refactoring UI's seven principles, scored 0–10 per surface from the source — `lib/jobhacking/sections.ts`, `components/jobhacking/*`, `components/profile/SectionsPage.tsx` + `SectionList.tsx`, the four editors the sections mount (`ContactPolicy`, `Personalization`, `WatchlistPanel` → `agents/Portals`, `TrueNorthPanel`), `app/globals.css`, `tailwind.config.ts`. Rules of the house applied as written: `docs/UX_AUDIT_COMPASS_TABS.md §0` and `docs/UX_PROFILE.md §3, §7`.
**Date:** 2026-11-03, on `main` @ `47a0cf0` (the portal's first commit). This revises the provisional scores in `docs/UX_JOBHACKING.md §7`.

| Surface | Score | One-line verdict |
|---|---|---|
| Narrative (then "Profile") | **8.5 / 10** | The Profile/Settings layout, correctly reused. Two paragraphs of mute copy before the first field (the section *ask* and the panel's own intro say the same thing), and CareerOps vocabulary ("the agents", "generated CV") on a portal that may not have agents. |
| True North | **8.5 / 10** | The statement leads and the five questions are the right IA. The values are links that look like text until hovered; three red items on one desktop screen (sidebar nav, rail nav, Save). |
| Target companies | **6.5 / 10** | The one weak page. The `Portals` editor was lifted from CareerOps Setup unchanged: a 90-word 12px paragraph at full width, unlabelled 1fr/2fr rows that squash to 100px on a phone, an *Advanced* disclosure under every row, 22px keyword chips, red on a positive suggestion, and "Scout / Pi / AI tokens / North Star" copy. |
| Settings | **8.5 / 10** | One card, one action — right. The one red button is the small size, and the *What it fills in* rows truncate a page intro that was never written to fit a row. |
| **Overall** | **8 / 10** | Three of four pages are the Profile system doing its job. The gap is the one editor nobody restyled when it crossed portals, plus a layer of copy that still speaks CareerOps. |

---

## 0. Cross-page findings (fix once, lifts every page)

### 0.1 Two intros before every form — hierarchy (duplication)
Every section renders `h2 → ask` in `SectionsPage`'s header, then the mounted panel renders **its own** intro paragraph as the first thing in the card:

| Section | `ask` (header) | Panel intro (card) |
|---|---|---|
| Profile · Contact details | "Your name, phone, email, LinkedIn, location and portfolio — the header of every generated CV…" | `ContactPolicy` `INTRO.contact`: "These go straight onto your generated CV and cover letter…" |
| Profile · Headline | "One line under your name that says what you do and for whom." | `INTRO.headline`: "The agents put this under your name on every CV…" + the field's own hint says it a third time |
| Target companies | "The companies on your list with the page that lists their jobs, plus the title keywords…" | `WatchlistPanel`: "Careers pages the Scout checks… Zero AI tokens…" + `Portals`' "Companies to watch" paragraph |

RUI: *start with too much white space and remove; the label supports the data, it doesn't compete.* Three mute paragraphs before an input is the opposite. The section header already owns the explanation.
**Fix:** `ContactPolicy` and `WatchlistPanel` take `intro?: boolean` (default `true`, so CareerOps Setup and the intake wizard are untouched); `JobHackingScreen` — and `ProfileScreen` / `SettingsScreen`, which have the same duplication — pass `intro={false}`.

### 0.2 CareerOps vocabulary on a JobHacking page — copy as hierarchy
A JobHacking-only member (`features.compass: false`, no CareerOps) reads: "the agents", "generated CV", "the Scout", "the Pi's browser", "Zero AI tokens", "your North Star", "Saved. Your statement and the agents' profile follow it." None of these exist for them. Copy that names things the member can't see is noise at best, a trust leak at worst.
**Fix:** the member-facing sentence on each JobHacking section comes from the registry (`JH_SECTIONS[].ask` — already JobHacking voice), not from the editor. With §0.1 applied, the editors' intros disappear here; the remaining strings are the three save confirmations (`TrueNorthPanel` "…the agents' profile follow it", `ContactPolicy` `SAVED.*`, `WatchlistPanel` "the Scout will check…"). Give each a neutral default ("Saved.") when `intro={false}`, or a `savedMessage` prop. Keep the agent-specific message where the agents exist.

### 0.3 Red budget on desktop — three reds on one screen
On `/jobhacking/true-north` at ≥ md the screen shows: the **sidebar's** active *True North* row (red-soft + red), the **rail's** active section row (`bg-jh-red-soft text-jh-red` in `SectionList` rail variant), and the section's red **Save**. §0.4 of the Compass audit allots red to *primary action + active nav + genuine negative state*. The rail is the second nav on the page; two active-nav reds halve the signal of each. (Same on `/profile` and `/settings`; the fix is in the shared list.)
**Fix:** rail active row → `bg-jh-mist text-jh-ink` with the state glyph in ink; keep the red for the shell's active tab. `aria-current="page"` stays. One red nav + one red button per screen.

### 0.4 One off-scale type size in the shell
`PortalSwitcher`'s "Switch portal" menu label is `text-[11px]`. §0.6 set the floor at 12px. **Fix:** `.section-label` (12px, same tracking, same colour).

### 0.5 Minor off-scale spacing (note, don't chase)
`mt-1.5` / `gap-1.5` (6px), `py-2.5` (10px) in `SectionsPage`, `SectionList` rows and `JobHackingSettings`. The app's practical scale is 4/8/12/16/24; 6 and 10 aren't on it. Fix opportunistically when touching those lines (`py-3`, `gap-2`, `mt-2`); not worth a pass of its own.

---

## 1. Narrative (then "Profile") — 8.5 / 10

**Working**
- Rail (232px, sticky) with identity on top → state glyph + label per row → ink progress bar; mobile overview is a card of rows that quote the data. Labels recede (`.label` 13px mute), values lead (`.field` 15px ink). One red button in the card.
- Contact details is a 2-column grid with the portfolio URL spanning both — no orphan. Email read-only in mute inside the field (4.8 : 1 on white — passes).
- Core competencies and Bridge story are one textarea each with the h2 as their label (`heading={false}` path of `Personalization`) — right: a single field doesn't need a second heading.

**Issues**

| # | Principle | Finding | Fix |
|---|---|---|---|
| P1 | Hierarchy | §0.1 — `INTRO.contact` under the section ask; on Headline the word "Headline" appears four times in 80px (rail, h2, `.label`, hint). | `intro={false}`; on `part="headline"` drop the `.label` (the h2 is the label) and keep the hint. |
| P2 | Colour / copy | §0.2 — "generated CV", "the agents" on Contact details, Headline and the saved message. | Registry `ask` only; neutral `savedMessage`. |
| P3 | Hierarchy | The rail's identity block (`Identity`) shows name · email · country; the Contact details section edits name but the country isn't editable anywhere in this portal (it's the Compass onboarding country). Identity shows a fact the page can't change. | Show `contact.location` (editable here) instead of `profile.country` when it is set; fall back to country. |

---

## 2. True North — 8.5 / 10

**Working**
- The statement is the single element using all three levers (dark, 23px, 600) — correct, it is the point of the page. Placeholders at `white/55` on ink ≈ 5.9 : 1; member values in white. The `Navigation` glyph at `white/5` is decoration, not competition.
- Five questions, not three storage objects. Each editor is ≤ 3 fields plus one repeatable list; Save writes only its own fields.
- Archetype rows carry visible `.label`s below `sm` in a bordered box, and a column head above `sm` — the gap `UX_PROFILE.md §7.5` named is closed here.
- Hints at 12px `jh-mute` (4.8 : 1) — the floor, but above it.

**Issues**

| # | Principle | Finding | Fix |
|---|---|---|---|
| T1 | Hierarchy (affordance) | The statement's values are `<Link>`s styled `italic text-white hover:underline`. At rest they are indistinguishable from the sentence; on touch there is no hover, so a phone member never learns they are the way in. The doc's promise — *every value is a link to the section that fills it* — is invisible. | Always underlined: `underline decoration-white/30 underline-offset-4 hover:decoration-white/70`. Blanks then read as fill-in lines — the metaphor the sentence already uses. |
| T2 | Colour | §0.3 — sidebar active + rail active + Save, all red. | Rail active → ink on mist. |
| T3 | Hierarchy | Row counts mean two things: *Target roles* shows "3" (archetypes), *Salary range* / *Location* show "2/3" (fields filled). Same column, different units. | Keep the fraction (it matches `/profile`'s *Comp & location policy* `0/3`) and drop the archetype count — the summary already says "3 archetypes". |
| T4 | Layout | `Seniority level` is a free-text field that the hint explains at length ("Senior, Lead, Head of… if the title already starts with it, it isn't repeated"). | `<datalist>` of common levels (Junior · Mid · Senior · Lead · Staff · Principal · Head of · Director · VP · C-level). Still free text, no new field; the hint can lose its second sentence. |
| T5 | Copy | "Saved. Your statement and the agents' profile follow it." | "Saved — your statement follows it." when `features.compass` / agents are off (§0.2). |

---

## 3. Target companies — 6.5 / 10

This is `WatchlistPanel` → `agents/Portals`, the CareerOps Setup editor rendered inside the Profile layout with no changes. It also backs `/settings · Target companies`, so every finding below is a Compass-side fix too.

**Working**
- Section ask is right and short. State row says "N companies · M without a careers page" — the one JobHacking-specific touch, and it's the right one.
- Remove buttons are `.icon-btn` with labels; Add company is `btn-secondary btn-sm`.

**Issues**

| # | Principle | Finding | Fix |
|---|---|---|---|
| C1 | Typography / layout | "Companies to watch" is followed by a **~90-word paragraph at `text-xs`** (Greenhouse, Lever, Ashby… "80+ others", Pi, SuccessFactors) with no `max-w` — at 1200px main width that is 150+ characters per 12px line. RUI: 45–75 characters, 14px minimum for anything meant to be read. | One 14px line in the panel ("Paste the page that lists the jobs — the *search jobs* link, not *life at …*"), `max-w-prose`. The board list and the browser fallback go into a `<details>` *How a page is read* under the list, at `text-sm`. |
| C2 | Hierarchy / layout | Company rows are `grid-cols-[1fr_2fr_auto]` at every width with **no visible labels** (aria-label + placeholder only) and no column head. Below `sm` the name input is ~100px and the URL ~200px. | Same pattern as the archetype rows in `TrueNorthPanel`: column head (`Company · Careers page`) above `sm`; below `sm` each row is a bordered `rounded-sm` box with `.label`s and stacked inputs. |
| C3 | Hierarchy | An *Advanced* `<details>` (12px, 14px icon, no 44px target) under **every** row. With ten companies that is ten identical disclosure lines between the list and the keywords. | One `.icon-btn` (`Settings2`, `aria-label="Advanced for {name}"`) at the row's right, toggling the two advanced fields *inside* that row's box. Rows that have a provider / API URL set show it as a 12px mute line under the URL, as now. |
| C4 | Spacing / targets | "Suggested for your goal" keyword chips are `px-2 py-0.5 text-xs` — about 22px tall. §0.7: 44px targets (40px with the `.icon-btn` negative-margin convention). "Use this" on the Scout suggestion is `text-xs px-2.5 py-1` — ~26px. | Chips → `btn-secondary btn-sm` with `min-h-[40px]`; "Use this" → `btn-secondary btn-sm`. |
| C5 | Colour | `PortalBadge`: the `Sparkles` icon for *"The Scout found this company's job board"* is `text-jh-red`. A found board is good news; red says "problem". `0 matched` is red while `found > 0` — borderline, but it's a hint to tune keywords, not a failure. | Sparkles → `text-rb-green-dark` (found = done, same as the state glyph); "0 matched" → ink with the *titles seen there* disclosure next to it. Red stays only on `method === "none"`. |
| C6 | Copy | §0.2 — "Scout", "Pi's browser", "Zero AI tokens", "North Star", "Saved — the Scout will check…" | `intro={false}` from JobHacking; neutral saved message; the one-line help in C1 names no agent. |
| C7 | Hierarchy | Keyword hints are 12px paragraphs with inline `<code>` and an *em* — two reading sizes under one textarea. Fine on Setup where the member is configuring the Scout; heavy on a page whose ask was one sentence. | Keep the first sentence of each hint; move the stem examples (`Test` vs `QA Manager`, `word:Intern`) into the C1 disclosure. |

---

## 4. Settings — 8.5 / 10

**Working**
- One card at `max-w-2xl`, left-aligned (not centred), `p-8` drop zone, the lock line under the button. Drag-and-drop on the whole page with a red dashed highlight — red for the one action. No Export by decision; the review step's *Download current profile* covers the safety copy.
- `role="status"` line after an unpack with links per section — the member sees where the file went.

**Issues**

| # | Principle | Finding | Fix |
|---|---|---|---|
| S1 | Hierarchy | **Upload profile** is `btn-primary btn-sm`. It is the only action on the page; the small size is for toolbars and inline rows. | `btn-primary` at full size. |
| S2 | Typography / layout | *What it fills in* rows show `p.intro.split(".")[0]` truncated — "Who you are: the contact block of every applic…" in a 672px card. The intro was written for a page header, not a 300px cell. | Derive the cell from the registry: `jhSectionsFor(p.key).map((s) => s.label).join(" · ")` → "Contact details · Headline · Bridge story · Core competencies". Nothing invented, nothing truncated at `md`; wrap instead of `truncate`. |
| S3 | Spacing | Rows are `py-2.5` (10px). | `py-3`. |
| S4 | Depth | The status line is a flat bordered strip on `mist/40`; the card below has `shadow-jh-1`. Two surfaces at two depths with no reason. | Status line → plain `text-sm` with the check, no box (it's a sentence, not a panel), or the same `.card` recipe. |

---

## 5. Diagnostic (RUI quick checklist)

| Question | Profile | True North | Companies | Settings |
|---|---|---|---|---|
| Hierarchy survives the blur test? | ✓ | ✓ statement dominates | ✗ paragraph and list compete | ✓ |
| Works in grayscale? | ✓ glyph + text state | ✓ | ✓ (after C5) | ✓ |
| Enough white space between groups? | ✓ `space-y-6` / `gap-8` | ✓ | ✗ list → details → keywords all `space-y-2/4` | ✓ |
| Labels recede vs values? | ✓ | ✓ | ✗ no labels on rows | ✓ |
| Spacing on scale? | ~ (6/10px stragglers) | ~ | ~ | ~ |
| Text width constrained? | ✓ `max-w-prose` on asks | ✓ | ✗ C1 | ✓ `max-w-2xl` |
| Contrast ≥ 4.5 : 1 on readable text? | ✓ (`jh-mute` floor) | ✓ | ✓ | ✓ |
| Targets ≥ 44px (40 with the icon-btn convention)? | ✓ | ✓ | ✗ C4 | ✓ |
| One red action per screen? | ✗ §0.3 | ✗ §0.3 | ✗ §0.3 + C5 | ✓ |

---

## 6. Proposal — ordered by lift per line changed

| Step | What | Files | Lifts |
|---|---|---|---|
| **1** | Target companies editor: one-line help + *How a page is read* disclosure (C1, C7); labelled rows with a column head and a stacked phone layout (C2); Advanced behind one icon button per row (C3); 40px chips and *Use this* (C4); green Sparkles, ink "0 matched" (C5). | `components/agents/Portals.tsx` | `/jobhacking/companies` **6.5 → 8.5**; `/settings · Target companies` and CareerOps Setup · Portals get the same. |
| **2** | `intro?: boolean` on `ContactPolicy` and `WatchlistPanel`; `savedMessage?: string` on `ContactPolicy`, `WatchlistPanel`, `TrueNorthPanel`; JobHacking passes `intro={false}` and neutral messages; Profile/Settings pass `intro={false}` (the ask is there too). | `components/careerops/ContactPolicy.tsx`, `WatchlistPanel.tsx`, `components/jobhacking/TrueNorthPanel.tsx`, `JobHackingScreen.tsx`, `components/profile/ProfileScreen.tsx`, `SettingsScreen.tsx` | §0.1, §0.2, P1, P2, T5, C6 — every JobHacking page, and `/profile`. |
| **3** | Rail active row → ink on mist; switcher label → `.section-label`. | `components/profile/SectionList.tsx`, `components/careerops/PortalSwitcher.tsx` | §0.3, §0.4, T2 — every sectioned page in all three portals. |
| **4** | Statement values always underlined (T1); drop the archetype count (T3); seniority `<datalist>` (T4). | `components/jobhacking/TrueNorthStatement.tsx`, `lib/jobhacking/sections.ts`, `TrueNorthPanel.tsx` | True North **8.5 → 9.5**. |
| **5** | Full-size Upload button (S1); *What it fills in* from section labels (S2); `py-3` (S3); status line unboxed (S4). | `components/jobhacking/JobHackingSettings.tsx` | Settings **8.5 → 9.5**. |
| **6** | Identity shows `contact.location` when set (P3). | `components/profile/Identity.tsx`, `JobHackingScreen.tsx` | Profile → 9.5. |

Tests touched: `tests/jobhacking-sections.test.ts` (T3 count, S2 derivation), `tests/jobhacking-statement.test.tsx` (T1 class). No schema change, no new field, no new page — every step is inside the rules in `CLAUDE.md` and `docs/UX_JOBHACKING.md` (*never invent a field*).

**What this does not propose:** the §4.3 pattern (summary rows + edit sheet) for the archetype and company lists on a phone. It is still the way to 10 on both `Personalization` and `Portals`, and still a rework of its own, as `UX_PROFILE.md §7.5` already says. Steps 1–6 get the portal to **9 / 10** without it.

**Not changed, deliberately:** the True North card is the Compass goal card verbatim (one voice while a member can hold both portals); no Export on JobHacking Settings; `.btn` / `.field` at 15px (the app's own scale, used everywhere).
