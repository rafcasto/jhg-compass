# Performance tab — target vs actual (onboarding + logging)

**Scope:** how a member *sets* a target (onboarding step 3, Performance "Edit targets", per-row "Set a daily goal") and how they *log* an actual against it (Performance − / +), in day / week / month.
**Method:** Refactoring UI (hierarchy · spacing · type · colour · depth · layout) on `components/performance/PerformanceScreen.tsx`, `app/onboarding/page.tsx` (step 3), `lib/period.ts`, `lib/targets.ts`; plus the interaction model, since the visuals were already refactored in `UX_AUDIT_COMPASS_TABS.md §2`.
**Date:** 2026-10-26

| Area | Score | Verdict |
|---|---|---|
| Visual system (post-refactor) | **8 / 10** | Tokens, 40px targets, labels recede, red budget respected, bullet bar is excellent. |
| Target ↔ actual interaction | **5 / 10** | One stepper with two meanings, two edit modes, a lossy day↔week conversion that makes targets *disappear*, and 15 steppers as the last onboarding step. |
| **Overall** | **6.5 / 10** | The screen looks right and behaves confusingly. |

---

## 1. Assessment

### 1.1 The target quietly rounds to zero (the big one)

Targets are stored per **week**; the Day view divides by 5 workdays and `Math.round`s (`scaleTarget`). With the shipped defaults:

| Weekly default | Rows | Shown per day |
|---|---|---|
| 1 | pleasure interview · job interview · networking event · headhunters · placement agency · unsolicited | **0** |
| 2 | information interviews · post CV | **0** |
| 3 | thank-you notes · personal branding · answer ads | 1 |
| 5 / 8 | research ×2 · referral · cold outreach | 1 / 2 |

Consequences:
- **Onboarding step 3** ("Set your daily targets") opens with **8 of 15 rows at 0**, even though every row has an admin target. The member thinks nothing is set.
- **Performance, Day view** (the default) shows **"Set a daily goal"** on those same 8 rows — again, a target exists.
- **Lossy round-trip.** Tap `+` once on a 1/wk row in Day view → `toWeekly(1) = 5`. The member asked for "one a day", got "five a week"; switch to Week and the number jumps 1 → 5 with no explanation. Editing in Month view is worse: 22 → 23 writes `round(23·7/31) = 5`, i.e. nothing changes, and the stepper appears broken.
- **Weekend false negatives.** A past Saturday is `closed`; target 1, actual 0 → the row goes **red** ("missed") on a day the 5-workday model says has no target.

This is not a visual bug, but it defeats the visual work: the bar, the tick and the green/red states are all driven by a number that is wrong for half the rows.

### 1.2 One control, two meanings (mode error)

The row's `−` / `+` **logs an actual** normally and **moves the target** in edit mode. The only cues are a 12px hint ("Set your daily target →") in the bar slot and the header button turning red. RUI's hierarchy problem here: in edit mode the stepper acts on the **small, muted** number (target, 16/500 mute) while the **big, bold** number (actual, 24/700) sits untouched beside it. The eye lands on the element the control does *not* change.

### 1.3 Two edit modes, three entry points

`editAll` (header button → every row) and `editRows` (per-row "Set a daily goal" → that row, with its own *Done*). Opening the global mode wipes per-row state; a per-row *Done* and the header *Done* look different (`btn-ghost` vs `btn-primary`). Two mental models for one job.

### 1.4 Copy says "daily" in every period

`perf.setGoal` = "Set a daily goal" and `perf.setTargetHint` = "Set your daily target →" render unchanged in Week and Month view. The month target (e.g. **22**) is a derived number with no unit, so it reads as something the member chose.

### 1.5 Onboarding step 3 is a 15-decision form

The last step before the app asks for 15 stepper values, with no "use the recommended plan" path and no sign that the pre-filled numbers *are* recommendations (they look like the member's own). The subtitle promises "fine-tune any time in Performance" — correct, but the step still demands the decisions now. Spacing/type are on-scale; the cost is cognitive, not visual.

### 1.6 Instructions as a footer

"Tap + / − to log today. Tap Edit targets to set them." A UI that needs a legend under it is telling you its controls are ambiguous (see 1.2).

### 1.7 What is working (keep)

- Bullet bar + target tick: one-glance actual-vs-target; fill ink → green → red-only-when-closed is exactly the red budget.
- ACTUAL / TARGET as `.section-label` once per section on desktop; actual 24/700, target 16/500 mute — correct hierarchy for *reading*.
- `Segmented` period control, `.icon-btn` 40px chevrons, `aria-label`s on every icon button, `role="img"` bar with "a of t".
- Market sections shared with onboarding so the two screens can't drift.
- Write rule in `lib/targets.ts`: untouched rows are not persisted, so admin defaults keep flowing. Keep this.

---

## 2. Proposal — "targets are weekly, logging is daily"

One principle fixes 1.1–1.6: **edit the number you store, log the number you did.** Targets are set and edited **per week** only (the canonical unit); Day and Month show *derived* targets, read-only. The row stepper has exactly one meaning: log.

### 2.1 Performance tab

**Row controls**
- `−` / `+` always log. Remove `editAll` / `editRows` and the per-row *Done*.
- The **target cell becomes the edit affordance**: it is a quiet button (`.link`-style, mute → ink on hover, 44px hit area) that opens the *Targets* sheet scrolled to that row. Tapping the number you want to change, to change it, is the obvious mapping.
- Rows with no target show **"Set a target"** (period-agnostic) in the same slot — same button, same sheet.

**Derived-target display (fixes the zero)**

| View | Target cell | Bar |
|---|---|---|
| Week | `5` | actual / 5 — the stored truth, no rounding |
| Day, weekly ≥ 5 | `1` (= 5 ÷ 5 workdays) | actual today / 1 |
| Day, weekly < 5 | `1 / wk` (the real figure, with its unit) | week-to-date progress for that row, tick at the weekly target |
| Month | `~22` with a `/ mo` suffix | actual / 22 |

Rule: never show a target of **0** for a row that has one. If the per-day share is < 1, show the weekly figure and let the bar track the week. A `≈` or `~` prefix on every derived figure (day, month) so no derived number looks authored.

**Default period → Week.** It is the stored unit, nothing is rounded, and a job-search week is the coaching cadence. Day stays one tap away for logging. (Optional: remember the last period in `localStorage`.)

**Weekend rule.** In Day view, Saturday/Sunday rows show the `1 / wk` form and never go red on close. (Implementation: `closed && isWorkday(anchor)` for the `missed` state, and `scaleTarget` returns the weekly share only for workdays.)

**Logging feedback.** Keep the bar animation; add a 200ms count-up on the actual number (`transition` on a `key` change) so a tap in a tall list is visibly acknowledged. When `done` flips, the `+` is already green — enough.

**Copy.** Delete the footer legend. `perf.setGoal` → "Set a target"; `perf.setTargetHint` is no longer needed. Header button stays **"Edit targets"** (`btn-secondary btn-sm`) and opens the sheet at the top.

### 2.2 The Targets sheet (reuse `Sheet`)

Bottom sheet on a phone, centred modal on desktop — the component already does this.

```
Weekly targets                                   ✕
Set how much you'll do each week. Day and month
views work it out from here.

VISIBLE JOB MARKET
Post CV on job boards                 [−]  2  [+]
                                      ≈ 0.4 / day · Recommended 2
Contact headhunters                   [−]  1  [+]
…
HIDDEN JOB MARKET
Research & read target industry       [−]  5  [+]
                                      ≈ 1 / day
…
                                       [Reset all]   [ Done ]
```

- One stepper per row, **weekly**, 40px pill buttons as today. Value 24/700 ink (the thing you are editing is the loudest thing on the row — fixes 1.2).
- Under the value, 13px mute: the derived daily share (`≈ 1 / day`) and, only when the member's number differs from the admin default, `Recommended 5 · Reset` (`.link`). Nothing shows when they match — quiet by default.
- Saves on *Done* with the existing `withTargetEdits` (only touched rows), one `SET_TARGET` event per changed row.
- Opened from a row, the sheet scrolls that row into view and focuses its `+`.

Why a sheet and not inline: it isolates the mode (no control changes meaning), it gives the weekly unit one home, and it keeps the main list a single-purpose logging surface.

### 2.3 Onboarding step 3 → "Your weekly plan"

Replace the 15-stepper form with a **recommended plan the member accepts or adjusts**:

```
Your weekly plan 🎯
These are the targets we recommend for a hidden-market job search.
You can change them any time from Performance.

VISIBLE JOB MARKET  ·  ~20% of your success
Post CV on job boards                          2 / wk
Contact headhunters / search firms             1 / wk
…
HIDDEN JOB MARKET   ·  ~80% of your success
Research & read target industry                5 / wk
…

[ Use this plan ✓ ]            Adjust targets
```

- Primary CTA **Use this plan** writes nothing (admin defaults keep flowing — the existing rule) and finishes onboarding.
- **Adjust targets** (`btn-ghost`) opens the *same* Targets sheet from 2.2, pre-filled. Done → back to this step with the member's numbers in place and a small `Customised` label on changed rows.
- Values are read-only text here (16/600 ink, unit 13px mute), so the step reads as a plan, not a form. 15 steppers → 1 decision.
- Same `MarketSection` component, so order and tints still can't drift.

### 2.4 Red budget after the change

Red on the Performance screen: active nav + a closed-short bar/number only. The header *Edit targets* is `btn-secondary`; the sheet's *Done* is the one primary. Onboarding: *Use this plan* is the one primary.

---

## 3. What changes, by file

| File | Change |
|---|---|
| `lib/period.ts` | `scaleTarget` → return `{ value, unit: "day" \| "week" \| "month", derived: boolean }`; day share only for weekly ≥ 5 and workdays; keep `toWeekly` for the sheet (week only). |
| `components/performance/TargetsSheet.tsx` *(new)* | Sheet from 2.2; props `weeklyTargets`, `userTargets`, `onSave(edits)`, `focusId?`. |
| `components/performance/PerformanceScreen.tsx` | Remove `editAll`/`editRows`/`perRowEdit`; `−`/`+` log only; target cell → button opening the sheet; derived display + `~`; week-to-date bar for `< 5/wk` rows in Day view; default period `week`; drop footer. |
| `app/onboarding/page.tsx` | Step 3 → read-only plan + *Use this plan* / *Adjust targets* (sheet). `TargetRow` goes. |
| `lib/content.ts` | `perf.setGoal` → "Set a target"; retire `perf.setTargetHint`, `perf.footer`; add `perf.targetsSheetTitle/Intro`, `onb.planTitle/Intro/UsePlan/Adjust`. |
| `tests/` | Update `performance-screen`, `onboarding-targets`, `targets`; add `scaleTarget` cases for 1/wk and 2/wk → no zero. |

## 4. Status — applied 2026-10-26 (branch `audit/compass-tabs-refactoring-ui`, on top of `origin/main` @ `5b057d3`)

| File | What landed |
|---|---|
| `lib/period.ts` | `displayTarget(weekly, period, anchor)` → `{ value, unit, derived }` and `isWorkday`. Day = weekly ÷ 5 only when ≥ 1 and a workday, else the weekly figure with unit `week`; month derived. `scaleTarget` / `toWeekly` kept for the maths and tests. |
| `lib/targets.ts` | `targetEdits(userTargets, defaults, values)` → `{ set, unset }`: rows that differ from the default are written, rows put back on the default drop their override (`deleteField`) so admin changes flow again. `withTargetEdits` removed (unused). |
| `components/performance/TargetsSheet.tsx` *(new)* | The one edit surface (`Sheet`, size `lg`): market banners, one **weekly** stepper per row (24/700 ink), `≈ n / day` under it, `Recommended n · Reset` only when the figure differs, *Reset all* as the ghost secondary only when any row differs, *Done* saves via `targetEdits`. `focusId` scrolls to / focuses a row's `+`. |
| `components/performance/PerformanceScreen.tsx` | No edit modes. `−`/`+` log only. Target cell is a 40px button (`Change target: …`) opening the sheet at that row; *Edit targets* (`btn-secondary btn-sm`) opens it at the top. Derived figures carry `~`; a `< 5/wk` row (or any row on a weekend) in Day view shows `n / wk` and its ACTUAL + bar count the week to date. Default period **Week**. Footer legend removed. `onSetWeeklyTarget` → `onSaveTargets({ set, unset })`. |
| `app/(app)/performance/page.tsx` | Writes `set` and `deleteField()` for `unset` in one `setDoc(…, { merge: true })`; one `SET_TARGET` event per changed row (`period: "week"`). |
| `app/onboarding/page.tsx` | Step 3 is the read-only **weekly plan** (`PlanRow`: 16/600 figure + `/ wk` 13px mute, `Customised` tag on changed rows). Primary **Use this plan** writes nothing; **Adjust targets** opens `TargetsSheet` and keeps its `{ set, unset }` until finish. |
| `components/admin/tofu/OnboardingEditor.tsx` | Step-3 preview shows `n / wk` rows + the two buttons. |
| `lib/content.ts` | `perf.setGoal` → "Set a target"; `perf.targetsTitle/Intro`, `perf.perDay`, `perf.recommended`, `perf.reset`, `perf.resetAll`; `onb.targetsTitle/Subtitle` reworded to the plan, `onb.perWeek/usePlan/adjust/customised`; retired `perf.footer`, `perf.setTargetHint`, `onb.perDay`, `onb.finish`. |
| `tests/` | `period` (+6 `displayTarget` cases), `targets` (`targetEdits`), `performance-screen` (log-only rows, sheet round-trip, no-0 Day view, weekend), `onboarding-targets` (plan + Adjust flow + write shape), `market-section` (content mock). |

Deviations from §2: the *"Set a target"* action for a row without one stays in the **bar slot** (the target cell is too narrow for the words); the cell shows `—` and is still the tap target. Verified by `tsc`, `next lint` and vitest (488 pass; the 2 `ghost` failures and the `progress-cms` timeouts under full-suite load pre-exist on main). **Not** yet verified by screenshot at 390 / 1280.

## 5. Expected result

Visual 8 → **9** (one meaning per control, the edited number is the loudest number, no legend). Interaction 5 → **9** (no vanishing targets, no lossy round-trip, one edit surface, one onboarding decision). Overall **~9 / 10**.
