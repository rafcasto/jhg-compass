# Refactoring UI audit — the four Compass tabs

**Scope:** Compass · Performance · Progress (Tracker) · Coaching, plus the shared shell (sidebar / bottom tab bar) they sit in.
**Method:** Refactoring UI's seven principles (hierarchy, spacing, typography, colour, depth, images & icons, layout), scored 0–10 per tab from the source in `app/(app)/*`, `components/{compass,performance,tracker,coaching,shell}`, `app/globals.css` and `tailwind.config.ts`. Contrast figures are computed against the brand hexes in `design-system/colors_and_type.css`.
**Branch:** `audit/compass-tabs-refactoring-ui` (from `origin/main` @ `64260bb`).

| Tab | Score | One-line verdict |
|---|---|---|
| Compass | **8 / 10** | Clearest hierarchy of the four; a few off-scale sizes and one failing contrast on the article step label. |
| Coaching | **7.5 / 10** | Deliberate, contrast-aware CSS; red density is high and the no-scroll layout can invert group spacing. |
| Progress (Tracker) | **6 / 10** | Functionally rich but visually flat: equal-weight icon rows, hairline checkboxes, 16px hit targets, two radius systems, red-soft doing four jobs. |
| Performance | **6 / 10** | Looks fine in the handoff, but the whole screen is inline-styled with its own token copy — 10 font sizes, 7 off-scale spacings, 4 failing contrasts, N floating primary buttons. |
| **Overall** | **6.5 / 10** | Four tabs, three page-header treatments, two button systems, two form-label philosophies, three radius scales. The brand tokens exist; the tabs don't all use them. |

---

## Status — applied on `audit/compass-tabs-refactoring-ui`

Roadmap steps 1–7 are applied in this branch. What changed, by file:

| Area | Change |
|---|---|
| `app/globals.css` | One button system (`.btn-*`; `.cbtn-*` are now aliases), `.btn-sm`; `.label/.field` restyled to the muted `.clabel/.cfield` (now aliases); `.card` → 12px; `.eyebrow` → `jh-mute`; `.pill-hidden` → violet on blue-grey, `.pill-visible` → ink on mist, `.pill-neutral`; new `.icon-btn` (40px target), `.link`, `.section-label`; native `select.field` chevron; Coaching: ink benefit rules, on-scale margins, capped in-group gap, left caption on desktop. |
| `tailwind.config.ts` | `jh-body` (`#3a3f4d`) — the body grey that passes 4.5:1 on the blue-grey tint. |
| `components/shell/PageHeader.tsx` *(new)* | Eyebrow → h1 → intro + actions slot; used by Compass, Performance and Progress. **2026-10-26:** intro spans the text column (no `max-w-prose`); below `sm` the actions stack under the text instead of squeezing it. |
| `components/shell/Segmented.tsx` *(new)* | Shared segmented control (`aria-pressed`), used for the Progress view switch and the Performance period toggle. |
| `components/performance/PerformanceScreen.tsx` | Rewritten on Tailwind tokens — no local colour table. Type collapsed to 12/13/16/24/30; spacing to 4/8/12/16/24. Actual = ink → green when met → red **only** once the period has closed short; target de-emphasised (16/500 mute); `+` is an ink outline (no glow); Visible banner on mist; 40px chevrons with labels. **2026-10-26:** fills the content column (no fixed `max-w`); period controls stay a centred ≤576px group; rows go two-up once the screen is ≥860px (`.market-rows`, a container query so the admin phone preview stays single-column); market sections (order **visible → hidden**, tints, grid) come from the shared `components/performance/MarketSection`, also used by onboarding step 3 (which dropped its inline colour table, 36px buttons and `+` shadow for the same rows). |
| `components/tracker/ReminderRow.tsx` *(new)* | One reminder row for the Reminders view and the job sheet. 24px checkbox (border `jh-mute`, ≥3:1) in a 40px target. |
| `components/tracker/Sheet.tsx` | `aria-modal`, Esc to close, focus moved in / trapped / returned; 40px close button. |
| `app/(app)/tracker/page.tsx` | `PageHeader` with intro under the h1 (no `-mt-2`); `Segmented`; translated market pills; cards `rounded-sm` with shadow-lift hover; empty states with the primary CTA; contact rows show links + one `⋯` menu (notes / edit / delete) instead of six icons; all icon-only controls are `.icon-btn` with labels; section labels replace the collapsed `h3`s; `jh-mute-2` off readable text. |
| `components/tracker/ImportSheet.tsx` | Radii to scale, 12px floor, `jh-mute` on text, `.section-label`. |
| `components/compass/*` | `PageHeader`; `space-y-6`; form 2×2 with full-width role (no orphan); salary field plain ink; placeholders `white/55`; carousel `h2` on scale, card body `p-4`, step label `.section-label`. |

Coaching desktop (2026-10-26): the column fills the main area up to 960px (952px at 1280×800) instead of a fixed 640px; ≥720px the benefits and entitlement lists lay out two-up and the CTA caps at 440px (container queries, mirrored in `COACHING_DESKTOP` + `estimateCoachingScreenHeight`, so the admin preview and "fits" pill still measure the real layout). Not changed (deliberately): K6 (desktop Coaching column scrolls) — kept the no-scroll contract the admin "fits" check depends on; P10 (emoji → Lucide on the Performance banners) — the emoji is admin-authored content, so it's kept and given a fixed 40px footprint instead. `.label/.field` and `.btn-*` are used app-wide (login, onboarding, admin, CareerOps), so those screens pick up the muted labels and 8px buttons too.

---

## 0. Cross-tab findings (fix these first — they lift every tab)

### 0.1 Three button systems for the same roles
- `.btn-primary/.btn-secondary` (10px radius, `py-3 px-5`, 15px) — Progress, all sheets, onboarding.
- `.cbtn-primary/.cbtn-secondary` (8px radius, `12px 18px`, 15px) — Compass.
- Inline-styled pills (`8px 15px`, 12.5px, `1.5px` border) — Performance's *Edit targets* and period toggle.

**Fix:** one system. Keep `.cbtn` (it's the one that matches `--radius-sm: 8px` and the brand's "no transform on hover" rule), retire `.btn`, and give it a `.cbtn-sm` size for toolbar/inline use so Performance stops hand-rolling pills.

### 0.2 Two form-label philosophies, one of them inverted
- `.label` — Poppins **600 14px ink**: the label is as heavy as the value. Used by Progress sheets + 9 other screens.
- `.clabel` — Roboto **500 13px mute**: label recedes, value leads. Used only by Compass.

RUI: *labels are secondary.* `.clabel/.cfield` is the correct one. **Fix:** make `.label/.field` aliases of `.clabel/.cfield` (one-line change in `globals.css`) and delete the `variant` prop in `GoalFields`.

### 0.3 Three radius scales
Brand tokens are 4 / 8 / 12 / 16 / 24. Actual usage across the four tabs:

| Radius | Count | Where |
|---|---|---|
| `rounded-[10px]` | 10 | Tracker cards, reminder rows, sheets' inner table, `.btn`, `.field` |
| `rounded-[6px]` | 3 | checkboxes |
| `rounded-lg` (16) | 6 | `.card`, board columns, empty states |
| `rounded-sm` (8) / `rounded-[8px]` | 4 | nav rows, `.cbtn`, mobile stage select |
| `rounded-xl` (24) / `rounded-2xl` (16) | 2 | goal card, Performance banners |

10px and 6px are off-scale and are the *most used*. Nested radii are also wrong in the board: a 16px column holding 10px cards with 8px padding (inner radius should be ≤ outer − padding = 8).
**Fix:** cards/rows/fields → `rounded-md` (12) or `rounded-sm` (8); checkboxes → `rounded-xs` (4); columns → `rounded-md` so cards at `rounded-sm` nest cleanly.

### 0.4 Red is over-budget
Red (`#c2001f`) and red-soft (`#f6e0e3`) currently mean, on the same screens:
primary CTA · active nav item · page eyebrow · reminder count badge · "hidden market" pill · "Set a daily goal" pill · overdue · import errors · *every* un-met Performance number · *every* per-row `+` button · Visible-market banner tint · 3px benefit rules.

RUI: *semantic colour ≠ visual weight.* When red is everywhere, the one thing that should be red (the CTA / the overdue item) stops popping. **Fix — a red budget per screen:** primary action + active nav + genuine negative state only. Concretely:
- `.eyebrow` → `text-jh-mute` (keep red eyebrow only on the dark goal card where it's already mute-2).
- "hidden" pill → `bg-jh-blue-grey text-rb-violet` (blue-grey + violet are both brand tokens and unused on the board).
- Performance *Actual* number → ink until done (green); red only when the period has ended below target.
- Performance `+` button → ink outline at rest; the single filled-red button on the screen should be *Edit targets* when active.
- Visible-market banner → `bg-jh-mist` instead of `#fbe3e6`.

### 0.5 Three page-header treatments
| Tab | Eyebrow | H1 |
|---|---|---|
| Compass, Progress | `.eyebrow` 13px / .08em red | global `h1` 30→36px 700 |
| Performance | inline 11px / .09em red | inline **27px** 700 |
| Coaching | — | 36 / 18 / 44px stack |

Coaching is a sales screen and can differ; Performance shouldn't. **Fix:** a `PageHeader` component (eyebrow + h1 + right-aligned actions slot) used by Compass, Performance and Progress.

### 0.6 Tertiary grey used for body text (contrast)
`#9aa0ad` (`jh-mute-2`) on white is **2.9 : 1** — fails 4.5 : 1 for text under 18px. It's used on real text in 11 places (listed per tab below). **Fix:** `jh-mute-2` is for placeholders, disabled states and decorative icons only; all readable text ≥ `jh-mute` (`#6b7280`, 4.8 : 1).

### 0.7 Icon-only buttons at 16–20px
Trash / X / Pencil / MessageSquare / chevrons are rendered at their icon size with no padding — 16–20px hit targets against a 44px minimum, and several have no `aria-label`. **Fix:** a `.icon-btn` utility: `grid h-10 w-10 -m-2 place-items-center rounded-sm` (visually small, 40px target) + required `aria-label`.

### 0.8 Mixed iconography
Compass & Progress use Lucide (1.5 stroke, consistent). Performance & Coaching use emoji for the same role (section glyphs). Emoji render differently per OS and have no stroke/weight relationship to the Lucide set. Acceptable on Coaching (editorial, admin-authored); on Performance the banner emoji should be a Lucide icon in a tinted circle.

---

## 1. Compass tab — 8 / 10

**What's working**
- Textbook three-level hierarchy: mute eyebrow → h1 → the dark goal card is the only element using all three levers (size, weight, dark). The statement is 19/23px Poppins 600 at 1.5 line-height — right for a sentence that has to be read, not scanned.
- Secondary *Edit* is an outlined `.cbtn-secondary`; primary *Save objective* only appears in edit mode. Correct button hierarchy.
- Article cards: `shadow-jh-1` at rest → `shadow-jh-3` on hover, image bleeds to card edge, `object-cover`, 150px fixed height, broken-image fallback to `bg-jh-mist`. This is exactly RUI's image treatment.
- Page sections separated by `space-y-8 md:space-y-10` (32/40) vs `space-y-5` (20) inside — groups > within-group. Good.

**Issues**

| # | Principle | Finding | Fix |
|---|---|---|---|
| C1 | Colour | Article step label (`ArticlesCarousel.tsx:119`): 11px uppercase `text-jh-mute-2` on white = 2.9 : 1. | `text-jh-mute`, 12px. The coloured dot already carries the step. |
| C2 | Typography | `h2` set to `text-2xl md:text-[26px]` — 26 is off the 24/30 scale. | `text-2xl md:text-3xl` or just `text-2xl`. |
| C3 | Spacing | Card body `px-[18px] py-4` — 18 is off-scale. | `px-4 py-4` (16) or `p-5` (20). |
| C4 | Hierarchy | Salary input is `text-rb-green-dark font-medium` — one field's *value* is coloured while the other four are ink. Colour inside an input reads as validation state. | Plain ink; if "money" needs signalling, use a `$` prefix adornment. |
| C5 | Layout | Edit form is `auto-fit minmax(220px)` over 5 fields → a 2-column grid with one orphan on most widths. | Make role full-width (`col-span-full`) — it's the longest value — then 2×2 below. |
| C6 | Colour (borderline) | Statement placeholders `text-white/45` on ink ≈ 3.9 : 1. Passes the 3 : 1 large-text threshold at 19px/600, but only just. | `text-white/55`. |
| C7 | Spacing | `space-y-5` (20px) between header / card / form. Tailwind has 20, the RUI scale doesn't. | `space-y-6` (24). |

---

## 2. Performance tab — 6 / 10

**What's working**
- Constrained `max-w-md` column; eyebrow/h1/toggle/date-nav stack reads top-down.
- Per row, the numbers (24px 700) dominate the label (15px 600) — data > label, correct.
- Bullet bar (12px fill + 3px ink target tick) is a genuinely good single-glance visualisation.
- Explicit comments show the screen was built to a handoff — the *result* is coherent; the *implementation* is what breaks the system.

**Issues**

| # | Principle | Finding | Fix |
|---|---|---|---|
| P1 | System | Entire screen is `style={{…}}` with a local `C` token object that **drifts** from the brand: `line #eef0f5` (token `#e6e8ef`), `track #e3e9f4` (`#e2ebfb`), `bannerRed #fbe3e6` (`#f6e0e3`), `slash #c5c9d2` (not a token). | Delete `C`; use Tailwind classes against `jh-*`/`rb-*`. The admin CMS preview renders this same component, so one fix covers both. |
| P2 | Typography | **10 distinct font sizes** on one screen: 10.5, 11, 12.5, 13, 13.5, 15, 16, 22, 24, 27. | Collapse to 12 / 13 / 14 / 16 / 24 / 30: labels 12, pills & hints 13, toggle 14, row label 15→16, h1 27→30 (`text-3xl`, matching the other tabs). |
| P3 | Spacing | Off-scale spacing everywhere: `marginTop 2/3/11/12/13`, `gap 11`, `padding 15px 18px`, `18px 0`, `8px 15px`, `6px 12px`. | 4 / 8 / 12 / 16 / 24 only. Row padding `py-4`, banner `p-4`, inner gaps `gap-3`. |
| P4 | Colour | Four text contrast failures on white: ACTUAL/TARGET labels 10.5px `#9aa0ad` (2.9 : 1); inactive period toggle 13.5px `#9aa0ad`; edit-mode hint 12.5px italic `#9aa0ad`; footer 12.5px italic `#9aa0ad`. | All → `#6b7280` (`jh-mute`). Labels to 12px. |
| P5 | Hierarchy | *Actual* and *Target* are both 24px 700 — they compete. Target is the context, actual is the metric. | Actual 24/700; target 16/500 `jh-mute` ("/ 5" style, like "vs last month"). |
| P6 | Colour | Every unmet *Actual* is red → a fresh day opens with 6–8 red numbers before the user has done anything wrong. | Ink while in progress, green when met. Red only when the period is closed and below target. |
| P7 | Depth | Every row has a filled-red `+` with a `0 4px 12px rgba(194,0,31,.28)` glow — 6–8 "floating primary CTAs" per screen. *If everything floats, nothing has depth.* | `+` = ink outline circle (`border-jh-ink`), filled on `:active`. One red CTA per screen max. |
| P8 | Colour | Visible-market banner is red-tinted. Nothing is wrong with the visible market; the tint reads as a warning next to the blue "hidden" banner. | `bg-jh-mist` for Visible, keep `bg-jh-blue-grey` for Hidden. |
| P9 | Sizing / a11y | Date-nav chevrons are bare `<button>`s → ~20px hit targets. Period toggle has no `aria-pressed`. | `.icon-btn` (40px); `aria-pressed={period === p}`. |
| P10 | Icons | Banner glyphs are 24px emoji next to Lucide everywhere else. | Lucide `EyeOff` / `Eye` in a 36px tinted circle. |
| P11 | Layout | 448px column inside a 1200px main on desktop — ~750px dead space; Coaching uses 640. | `max-w-xl` (576) on `md+`. |

---

## 3. Progress (Tracker) tab — 6 / 10

**What's working**
- Header hierarchy (eyebrow → h1 → secondary *Import* + primary *Add*) is right, and *Import* collapses to icon-only on narrow screens.
- Segmented view toggle (white active pill + `shadow-jh-1` on a mist track) is the correct pattern, and the red count badge on *Reminders* is a legitimate use of red.
- Board scrolls horizontally with `snap-x` at every breakpoint; mobile gets a `<select>` to move cards. Pragmatic.
- Bottom-sheet-on-mobile / centred-modal-on-desktop `Sheet` with `max-h-[90vh]`.

**Issues**

| # | Principle | Finding | Fix |
|---|---|---|---|
| T1 | Hierarchy | `ContactCard` puts up to **six 16px icons in a row** (LinkedIn · Mail · Phone · Notes · Edit · Delete) at identical weight. Links, actions and a destructive action are indistinguishable. | Links (LinkedIn/Mail/Phone) stay inline; Notes/Edit/Delete go behind a single `⋯` menu, or Delete moves into the edit sheet. Vary emphasis. |
| T2 | Sizing / a11y | Icon-only buttons at 16px with no padding: Trash (`:396`, `:701`, reminders ×2), X detach, Pencil, MessageSquare; several lack `aria-label` (`:701`, `:709` area, reminders trash). Sheet close X is 20px. | `.icon-btn` 40px + `aria-label` everywhere. |
| T3 | Colour (UI contrast) | Unchecked reminder checkbox: `border-2 border-jh-line` (`#e6e8ef`) on white ≈ **1.2 : 1**. Needs 3 : 1 for UI components. 20px target. | `border-jh-line-2` minimum, better `border-jh-mute`; 24px box inside a 44px label hit area. |
| T4 | Colour (text) | `text-jh-mute-2` on readable text: empty-column "Drop here" (`:137`), *Done · N* section label (`:284`), note timestamps (`:407`, `:712`), in-job reminder due date 11px (`:654`). All 2.9 : 1. | `text-jh-mute`; nothing under 12px. |
| T5 | Typography | Enum rendered raw: market pill shows `hidden` / `visible` lowercase (`{o.market}`) beside Title-cased UI. 29 occurrences of ≤13px text in tracker + import; `text-[9px]`, `text-[10px]`, `text-[11px]` present. | `t("tracker.f.hidden")`; 12px floor. |
| T6 | Colour | Red-soft pill = "hidden market" **and** reminder badge red **and** import error chip **and** required-column chip. Same tint, four meanings. | Market → blue-grey/violet (see 0.4). Keep red for errors & overdue only. |
| T7 | Depth | Card hover is `border-jh-red/40` (colour) while article cards hover with a shadow lift. Same object type, two affordances. | `hover:shadow-jh-2` on cards; drop the red border. |
| T8 | Spacing | `-mt-2` twice (`:93` intro, `:609–610` detail meta) to fight `space-y-5`. The intro paragraph is separated from its heading by the toggle. | Move intro under h1 inside the header block; remove negative margins. |
| T9 | Spacing / radius | 16px columns → 8px padding → 10px cards (should nest ≤ 8); mobile stage select 8px inside a 10px card. | Columns `rounded-md`, cards `rounded-sm`, select `rounded-xs`. |
| T10 | Hierarchy (headings) | Inside `DetailModal`, `h3` is the 18px sheet title *and* the 14px section labels (*Contacts*, *Reminders*). The heading scale is collapsed to one level. | Section labels → `p` 12px uppercase mute (eyebrow-style), keep `h3` for the title. |
| T11 | Consistency | A reminder is white + border + shadow on the Reminders view, mist with no border inside a job's detail. Same object, two treatments. | One `ReminderRow` component used in both places. |
| T12 | Empty states | Dashed box + 24px icon + sentence, no action. Reminders and Contacts both. | Add the primary CTA (*Add a reminder* / *Add a contact*) into the empty state; it's the one place centring is correct. |
| T13 | Forms | `.label` 14px 600 ink competes with values (see 0.2); `DateField` placeholder overlay is `jh-mute-2` on white (2.9 : 1). | Switch to `.clabel`; placeholder → `jh-mute`. |
| T14 | a11y (outside RUI but adjacent) | `Sheet` has `role="dialog"` but no `aria-modal`, no focus trap, no Esc handler. | Add all three. |

---

## 4. Coaching tab — 7.5 / 10

**What's working**
- The CSS reasons about contrast in comments (`#3a3f4d` not `#6b7280` on the blue-grey tint — "drops to ~4.0 : 1"). That's the right instinct and it's correct.
- Three-line headline uses size + weight + colour exactly once: line 3 (the offer) is 44/62px red. Everything else is ink. This is RUI's "save all three levers for the single most important element."
- 640px desktop column, **left-aligned** (not centred). Full-width 48px CTA. Caption at 13px `#6b7280` on `#fafafa` ≈ 4.6 : 1 — passes.
- Container query scales type on the column's own width, so the admin preview is honest.

**Issues**

| # | Principle | Finding | Fix |
|---|---|---|---|
| K1 | Spacing | The no-scroll contract gives all vertical slack to `.coaching-benefits` (`flex:1; justify-content:space-evenly`). On a tall phone the gap **between** benefit rows can exceed the 12–14px margin between the benefits group and the entitlement card — *within-group > between-group*, which flattens the grouping. | Cap it: `justify-content:flex-start; gap: clamp(8px, 2vh, 20px)` and let the slack sit *above the CTA* or below the headline instead; or raise `.coaching-card` margin to 24 so the group boundary always wins. |
| K2 | Colour | Red density: 4× 3px red benefit rules + red headline line + red glowing CTA. The rules dilute the CTA. | Rules → `#191c27` (ink) or `#e6e8ef`. Red stays on headline-3 and the CTA only. |
| K3 | Icons | Emoji as list glyphs (22–26px). Platform-dependent rendering, no stroke relationship to the Lucide set used on the sibling tabs. | Acceptable since admins author them; if changing, map to a small Lucide allow-list in the CMS. |
| K4 | Typography | Off-scale sizes: 10, 11 (margins), 22, 26 (emoji), 44, 52, 62 (headline). 44/62 are fine as display sizes; `headline-2` at 18 → 24 jumps a step. | Minor. Keep display sizes; nudge margins to 8/12/16. |
| K5 | Layout | CTA caption is centred while every other line is left-aligned. | `text-align: left` under a full-width button, or centre only on phone. |
| K6 | Layout | On a 1280×800 desktop, the 640 column has to fit 36→52 / 44→62px headline, 4 benefits, 3 entitlements and CTA in `100dvh − 88px`. It fits, but with less breathing room than the phone — the opposite of what the extra width should buy. | Allow the desktop variant to scroll (`height:auto; min-height`), keep the no-scroll contract phone-only. |

---

## 5. Roadmap to 10 / 10 (ordered by leverage)

1. **Tokens first (0.1–0.3, 0.5).** Alias `.label/.field` → `.clabel/.cfield`; retire `.btn-*` for `.cbtn-*` (+ `.cbtn-sm`); normalise radii to 4/8/12/16; add `PageHeader`. One PR, mostly `globals.css`. Lifts Progress and Performance by ~1 point each.
2. **Performance → Tailwind (P1–P5, P9–P11).** Rewrite `PerformanceScreen` with classes; drop `C`. The CMS preview comes along for free.
3. **Red budget (0.4, P6–P8, T6–T7, K2).** Eyebrow to mute, market pill to blue-grey/violet, Performance numbers ink-until-done, `+` outline, Visible banner mist, Coaching rules ink.
4. **Contrast sweep (0.6, C1, P4, T3–T4, T13).** `jh-mute-2` off all text; checkbox border to `line-2`/`mute`.
5. **Hit targets + labels (0.7, P9, T2, T14).** `.icon-btn`, `aria-label`, `aria-pressed`, `aria-modal` + Esc.
6. **Progress polish (T1, T8–T12).** Overflow menu on contact rows, shared `ReminderRow`, empty-state CTAs, kill `-mt-2`.
7. **Compass & Coaching nits (C2–C7, K1, K5–K6).** Off-scale sizes, orphaned form field, spacing cap on the benefits list.

Expected after steps 1–5: Compass 9, Coaching 8.5, Progress 8, Performance 8.5 → **~8.5 overall**. Steps 6–7 close the rest.

---

## Appendix — numbers behind the contrast calls

| Pair | Ratio | Threshold | Result |
|---|---|---|---|
| `#9aa0ad` on `#ffffff` | 2.9 : 1 | 4.5 (text < 18px) | **Fail** |
| `#6b7280` on `#ffffff` | 4.8 : 1 | 4.5 | Pass |
| `#6b7280` on `#fafafa` | 4.6 : 1 | 4.5 | Pass |
| `#6b7280` on `#e2ebfb` | ~4.0 : 1 | 4.5 | **Fail** (already avoided in Coaching) |
| `#3a3f4d` on `#e2ebfb` | ~8.4 : 1 | 4.5 | Pass |
| `#9aa0ad` on `#191c27` | ~6.5 : 1 | 4.5 | Pass (goal-card eyebrow) |
| `rgba(255,255,255,.45)` on `#191c27` | ~3.9 : 1 | 3.0 (large text) | Pass, borderline |
| `#e6e8ef` border on `#ffffff` | ~1.2 : 1 | 3.0 (UI component) | **Fail** (checkboxes) |
| `#d4d8e2` border on `#ffffff` | ~1.5 : 1 | 3.0 | Fail — use `#6b7280` for control borders |
