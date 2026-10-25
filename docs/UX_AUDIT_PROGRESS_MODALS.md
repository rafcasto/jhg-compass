# UX audit — Progress tab modals (Refactoring UI)

Scope: every dialog the **Progress** tab (`/tracker`) can open. All nine sit on the shared
`Sheet` (`components/tracker/Sheet.tsx`), so most fixes land once and propagate.

| # | Modal | Component | Width | Opened from |
|---|-------|-----------|-------|-------------|
| 1 | Add job | `AddOpportunity` (`page.tsx:466`) | md | Board header |
| 2 | Job detail | `DetailModal` (`page.tsx:549`) | lg | Board card |
| 3 | Edit job | `EditOpportunity` (`page.tsx:504`) | md | **inside** Job detail |
| 4 | New contact (create & attach) | `CreateContact` (`page.tsx:752`) | md | **inside** Job detail |
| 5 | Edit contact | `EditContact` (`page.tsx:702`) | md | Contacts view **and inside** Job detail |
| 6 | Add contact | `AddContactStandalone` (`page.tsx:424`) | md | Contacts header |
| 7 | Add reminder | `AddReminder` (`page.tsx:299`) | md | Reminders header |
| 8 | Import CSV — pick / preview / done | `ImportSheet` | lg / lg / **md** | Board + Contacts header |

Method: Refactoring UI's seven principles, scored 0–10, plus the adjacent a11y / data-safety
issues the squint test surfaces. The previous pass (`UX_AUDIT_COMPASS_TABS.md` §T) already
fixed hit targets, `aria-modal`, focus trap, Esc, section labels and the ⋯ menu — this audit
starts from that baseline and does **not** re-raise those.

---

## Status — Sheet v2 shipped

Implemented in the same pass (see `components/tracker/Sheet.tsx`, `components/tracker/forms.tsx`,
`app/(app)/tracker/page.tsx`, `components/tracker/ImportSheet.tsx`, `tests/sheet.test.tsx`):

- **Sheet**: header / scrolling body / sticky footer; `size`, `eyebrow`, `description`, `onBack`,
  `headerActions`, `footer`, `dirty`, `viewKey`; `shadow-jh-3`; `92dvh` + safe-area; 180 ms entrance;
  body scroll lock. Stack registry ranked by DOM order — only the top sheet handles Esc / Tab, only the
  bottom one paints the scrim (S1–S10, F3). `SheetFooter` and `ConfirmBand` live beside it.
- **Forms**: `Field` (id / `htmlFor` / `aria-describedby`, required star, error line), `Row`
  (`grid-cols-1 sm:grid-cols-2`), `Group`, `useForm` (dirty tracking). One `ContactForm` and one
  `OpportunityForm`; `ContactEditor` / `OpportunityEditor` replace the five copied sheets. Market is a
  segmented control; URL / email / tel input types; Notes field added (F1–F11, D5).
- **Job detail**: company eyebrow + role title; stage pill-select in the status row (`move`); `⋯` menu
  with *Edit job* / *Delete job*; inline delete confirm; Edit / New contact / Edit contact render in the
  same sheet with ← Back; reminder composer collapsed behind `+ Add reminder` (D1–D4, D6–D9).
- **Contacts view**: delete asks first (inline band).
- **Import**: fixed `lg`, `Step n of 3` eyebrow, footer Back (ghost) / Import (primary), 40 px check
  rows, chevron disclosures, column guide in a closed `<details>`, orange warnings heading (I1–I6).
- **Copy**: 20 new admin-editable strings replace the hard-coded ones (F7); “Add to Wishlist” → “Add job” (F8).

Not done / to verify: a visual pass in the browser (this was built and tested headless — jsdom); the
`Field` error state has no caller yet (forms still rely on native `required`).

---

## 0. Score

**Current: 6 / 10.** The token system (`.field`, `.label`, `.btn-*`, radii, shadows) is solid
and consistently applied, so nothing looks *wrong*. What is missing is the layer above tokens:
the sheet has no anatomy (header / body / footer), forms have one spacing value for everything,
the detail modal has no hierarchy, and three behaviours lose user data.

| Principle | Score | One-line verdict |
|-----------|-------|------------------|
| 1 Visual hierarchy | 5 | Detail title is `Role · Company` at one weight; Cancel = Save at 50/50; two red primaries inside one sheet. |
| 2 Spacing & sizing | 6 | `space-y-3` / `gap-3` / `mb-1.5` everywhere — within-group = between-group. 2-col grid forced at 360px. |
| 3 Typography | 7 | Scale is right; the only miss is the concatenated title and 12px issue lists. |
| 4 Color | 8 | Red is disciplined (primary + overdue only). Delete is not red — good. |
| 5 Depth & shadows | 5 | Modal uses `.card` → `shadow-jh-1` (a *button* shadow). Nested sheets stack two 60 % scrims. No motion. |
| 6 Images & icons | 8 | Lucide at 16/20, `strokeWidth 1.5`. Only `▾ ▸` text glyphs in the import issue lists. |
| 7 Layout & composition | 5 | Title and submit scroll with the body; import sheet changes width between steps; sheets nest inside sheets. |
| A11y / data-safety (adjacent) | 4 | Esc in a nested sheet closes **both**; Delete has no confirm; backdrop tap discards a filled form; `vh` not `dvh`. |

To reach 10/10: ship §2 (Sheet v2), §3 (form rules), §4 (Detail redesign), §5 (Import) in that order.

---

## 1. Findings

### 1.1 Sheet container (`Sheet.tsx`) — affects all nine

| ID | Principle | What's there | Why it hurts | Fix |
|----|-----------|--------------|--------------|-----|
| S1 | Layout | One scrolling box: `space-y-4 overflow-auto` holds title, fields **and** the submit button. | On a phone with the keyboard up (≈ 45 % of 90vh left) the Add-contact sheet's submit is below the fold; the title scrolls away so the user loses context. | Three-part anatomy: sticky header, scrolling body, sticky footer with `border-t`. |
| S2 | Depth | `className="card …"` → `shadow-jh-1` (1 px). | A modal is the highest elevation in the system; it is wearing the lowest shadow. Reads flat against the scrim on light screens. | `shadow-jh-3` (already in the token set, unused here). |
| S3 | Depth / layout | `DetailModal` renders `EditOpportunity`, `CreateContact`, `EditContact` **as children**, so two `fixed inset-0 bg-jh-ink/60` layers stack. | 84 % darkness, two dialogs visible, two focus traps on the same `document`. | One scrim per stack (depth-aware provider) **or** no nesting — see §2.3. |
| S4 | **Bug** | Both sheets add `keydown` listeners to `document`. `e.stopPropagation()` does not stop sibling listeners on the same node; the outer (older) listener fires first. | **Esc inside "Edit job" closes the Detail modal and the edit sheet together — edits lost.** | Sheet stack registry: only the top-most sheet handles Esc (or `stopImmediatePropagation` + register inner first). |
| S5 | **Data loss** | Backdrop click → `onClose` unconditionally. | Desktop: a stray click outside a 7-field contact form discards it. | `onRequestClose(reason)`; forms pass `dirty` and the sheet ignores backdrop clicks when dirty (X / Cancel still work). |
| S6 | Sizing (mobile) | `max-h-[90vh]`, no safe-area padding. | iOS keyboard shrinks the layout viewport but not `vh`; the sheet bottom (and submit) sits behind the keyboard / home indicator. | `max-h-[90dvh]`, `pb-[max(1.5rem,env(safe-area-inset-bottom))]` on mobile, `overscroll-contain`. |
| S7 | Layout | No body scroll lock. | Page scrolls behind the sheet on touch; the board's horizontal scroll fights the sheet. | `document.body.style.overflow = "hidden"` while any sheet is open. |
| S8 | Microinteraction | Appears instantly. | Bottom sheet "pops" with no spatial cue of where it came from. | 180 ms `translate-y-4 → 0` + `opacity 0 → 1`, `ease-out`; respect `prefers-reduced-motion`. |
| S9 | Layout | Width is a per-call prop (`wide`). `ImportSheet` is `lg` on pick/preview and `md` on done. | Dialog visibly resizes between steps of one flow. | One size per flow; `ImportSheet` stays `lg`. |
| S10 | Hierarchy | Title `h3` overridden to `text-lg`; close X nudged with `-mt-2.5`. | Fine on one-line titles, misaligned on wrapped ones. | Header row `items-center min-h-10`; title 18 / 600, X in the same 40 px row. |

### 1.2 Forms — Add / Edit job, Add / Edit / Create contact, Add reminder

| ID | Principle | What's there | Fix |
|----|-----------|--------------|-----|
| F1 | Spacing | `space-y-3` between rows, `gap-3` between columns, `mb-1.5` label, `space-y-3` to the submit. Every gap ≈ 12 px → nothing groups. | Rows `gap-4` (16). Groups `gap-6` (24) with a `.section-label`. Footer separated by the sticky bar, not a gap. |
| F2 | Layout (mobile) | `grid grid-cols-2` at every width → two 140 px fields at 360 px. "Hiring manager" select, email, LinkedIn URL in 140 px. | `grid-cols-1 sm:grid-cols-2`. Keep 2-col on mobile only for short pairs (Due date · Linked job is borderline; move Linked job to its own row). |
| F3 | Hierarchy | Edit forms: `Cancel` and `Save` both `flex-1` → same width, same visual mass. Add forms: one full-width primary. Import: `Back` / `Import` 50/50. Three footer patterns. | One footer: desktop = `Cancel` as `btn-ghost` left, primary right; mobile = stacked, primary on top. The X already cancels — Cancel is a text affordance, not a peer. |
| F4 | Hierarchy | Only *Phone* says "(Optional)"; Company / Full name / What-to-do are required but unmarked. | Mark the required one(s) — there is 1 per form — and drop "(Optional)" everywhere, or mark all optional consistently. Required = `after:content-['*'] after:text-jh-red after:ml-0.5` on `.label`. |
| F5 | A11y | Only `type` / `phone` have `id` + `htmlFor`. Everything else: clicking a label does nothing; AT reads "edit text". | Every field gets an id via a `useId()` prefix in a `Field` wrapper. |
| F6 | Feedback | No error state in `.field`; invalid submit is silent (`if (!f.company) return`). | `.field-invalid` (border `jh-red`, ring `jh-red/15`) + 13 px helper line under the field, `aria-invalid`, `aria-describedby`. |
| F7 | Copy / i18n | `"Adding…"`, `"Saving…"`, `"Remove from job"`, `"Couldn't read that file."`, `"Close"`, `"More actions"` are hard-coded while everything else is `t()`. | Add to `lib/content.ts` under *Progress (Tracker)*. |
| F8 | Copy | Add job: title *Add job opportunity*, submit **Add to Wishlist** — but the first stage is admin-defined; rename *Wishlist* in the admin and the button lies. | `fillTemplate("Add to {stage}", { stage: stages[0].label })` or plain *Add job*. |
| F9 | Input types | `Link` / `LinkedIn URL` are `type="text"`. | `type="url" inputMode="url" autoComplete="url"`; email gets `autoComplete="email"`. |
| F10 | Hierarchy | *Market* is a 2-option `<select>` (Hidden / Visible). | Two options → segmented control (`Segmented` already exists) or two radio pills; shows both choices without a tap, and lets you add a 12 px helper explaining *Hidden*. |
| F11 | Layout | Add reminder: `Due date · Linked job` 2-col; the select's options are `Role · Company` strings that truncate at 140 px. | Title / Due date on row 1 (date `sm:w-44`), Linked job full-width on row 2. |

### 1.3 Job detail (`DetailModal`) — the heaviest modal

| ID | Principle | What's there | Fix |
|----|-----------|--------------|-----|
| D1 | **Data safety** | Trash icon deletes the job **immediately**, no confirm, 4 px from *Edit*. Same for *Remove from job* and the Contacts-view *Delete*. | Inline confirm band (`bg-jh-red-soft`): "Delete this job and its 3 reminders?  [Delete] [Keep]". No second modal. Move Delete out of the header into a ⋯ menu or footer-left ghost. |
| D2 | Hierarchy | Title is `${role} · ${company}` in one 18 px run. | Company as eyebrow (`.section-label`), role as the 20 px title. Squint test: one big thing, one small thing. |
| D3 | Hierarchy / IA | **Stage is not shown and cannot be changed here.** The most important attribute of a job lives only on the board. | Stage `<select>` styled as a pill in the header (colour dot + label), writes `move()`. Also fixes mobile, where drag isn't available. |
| D4 | Hierarchy | Meta row: market pill · job link · `ml-auto` Edit (secondary) · Trash — four different kinds of thing on one line. | Header: eyebrow + title + stage pill + market pill. Actions: `Edit` + `⋯` (Delete). Job link becomes a `.link` under the title. |
| D5 | Data | `opp.notes` is rendered but `EditOpportunity` has no *Notes* field — shown, never editable. | Add a textarea to Add/Edit job, or drop the render. |
| D6 | Hierarchy | Reminder composer uses `btn-primary` *Add*. With *Edit* (secondary) and nested sheets that also have primaries, the red CTA is diluted. | Composer collapsed behind a ghost `+ Add reminder`; on expand, *Add* is `btn-secondary btn-sm`. One red per surface. |
| D7 | Spacing (mobile) | Composer = input + date + button stacked = 3 rows ≈ 150 px before the first reminder. | Same as D6 — collapsed by default; list first. |
| D8 | Sizing | Attach-contact `<select>` is `py-2 text-sm w-auto` beside a `btn-sm` — a third input height inside the same sheet. | Use the standard `.field` height or make it a `btn-secondary btn-sm` "Attach…" that opens a small picker. |
| D9 | Layout | Edit job / New contact / Edit contact open **nested** sheets (S3, S4). | Detail sheet owns a `view` state: `"detail" \| "edit" \| "newContact" \| "editContact:id"`. Sub-views render in the same sheet with `← Back` in the header. One scrim, one focus trap, no Esc bug. |

### 1.4 Import CSV (`ImportSheet`)

Already the best-structured flow (pick → preview → done). Remaining:

| ID | Principle | What's there | Fix |
|----|-----------|--------------|-----|
| I1 | Layout | No step indicator; width jumps on *done* (S9). | `Step 1 of 3 · Choose file` as the header eyebrow; fixed `lg`. |
| I2 | Hierarchy | Preview footer `Back` / `Import {n}` at 50/50. | Back → `btn-ghost` left; Import primary right (`flex-1` on mobile only). |
| I3 | Icons | `▾ ▸` text glyphs as disclosure. | `ChevronDown` with `rotate-180` transition, like the rest of the app. |
| I4 | Sizing | Native 16 px checkboxes, no 40 px target. | Wrap in `label` with `py-2 -my-2` (40 px row), or use the `ReminderRow` 24 px check style. |
| I5 | Spacing | Column guide (5–6 rows) sits below the fold on mobile under the paste toggle. | Put the guide in a `<details>` closed by default; the template download covers the common path. |
| I6 | Color | Warnings are `jh-mute` — indistinguishable from body copy except by the count. | `rb-orange` text on the heading only (icon + text, never colour alone). |

---

## 2. Proposal — `Sheet` v2

### 2.1 Anatomy

```
┌──────────────────────────────────────────────┐
│ header  (sticky, px-6 pt-5 pb-4, border-b)   │
│   [← back]  EYEBROW                      [X] │
│             Title (18 / 600 / Poppins)       │
│             description (14 / jh-mute)       │
├──────────────────────────────────────────────┤
│ body    (scrolls, px-6 py-5, space-y-6)      │
│                                              │
├──────────────────────────────────────────────┤
│ footer  (sticky, px-6 py-4, border-t, white) │
│   [ghost secondary]            [primary]     │   desktop
│   [primary            ]                      │   mobile: stacked,
│   [ghost secondary    ]                      │   primary first
└──────────────────────────────────────────────┘
```

- Shadow `shadow-jh-3`; radius `rounded-t-lg` (16) mobile, `rounded-lg` desktop; scrim `bg-jh-ink/60` once.
- Sizes: `sm` 24rem (confirm), `md` 28rem (forms), `lg` 36rem (detail, import). Pass `size`, never `wide`.
- Mobile: `max-h-[92dvh]`, `pb-[env(safe-area-inset-bottom)]` on the footer, 4 × 36 px drag-handle bar above the header.
- Motion: 180 ms ease-out `opacity + translate-y-4` in, 120 ms out; none under `prefers-reduced-motion`.

### 2.2 API

```tsx
<Sheet
  size="md"
  eyebrow="Step 1 of 3"
  title={t("import.contacts.title")}
  description={t("import.contacts.intro")}
  onBack={view !== "detail" ? () => setView("detail") : undefined}
  onRequestClose={(reason) => {           // "esc" | "backdrop" | "button"
    if (dirty && reason === "backdrop") return;
    onClose();
  }}
  headerActions={<ActionMenu … />}
  footer={<SheetFooter primary={{ label: t("tracker.save"), form: formId, busy }} secondary={{ label: t("tracker.cancel"), onClick: onClose }} />}
>
  <form id={formId} onSubmit={save} className="space-y-6">…</form>
</Sheet>
```

The footer's primary submits the form via `form={formId}` so the button can live outside the
`<form>` and stay sticky.

### 2.3 Stacking

Replace nesting with a **view stack inside one sheet** (D9) for Detail → Edit / New contact /
Edit contact. If a genuine second layer is ever needed (e.g. a confirm over the import preview),
add a `SheetStackProvider`:

- counts open sheets; only depth 0 renders the scrim;
- keeps an ordered registry; `keydown` Esc / Tab are handled **only by the top entry**;
- `document.body` scroll lock while `count > 0`.

### 2.4 Sketch (`components/tracker/Sheet.tsx`)

```tsx
export function Sheet({ size = "md", eyebrow, title, description, onBack, onRequestClose,
  headerActions, footer, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useSheetStack(ref, onRequestClose);          // focus trap, Esc (top-most only), body lock, return focus

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center sm:p-4 bg-jh-ink/60 data-[depth]:bg-transparent"
         onClick={() => onRequestClose("backdrop")}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
           onClick={(e) => e.stopPropagation()}
           className={`flex w-full flex-col bg-white shadow-jh-3 motion-safe:animate-sheet-in
                       max-h-[92dvh] rounded-t-lg sm:rounded-lg ${SIZE[size]}`}>
        <span className="mx-auto mt-2 h-1 w-9 rounded-pill bg-jh-line-2 sm:hidden" aria-hidden />

        <header className="flex items-start gap-3 border-b border-jh-line px-6 pb-4 pt-5">
          {onBack && <button type="button" onClick={onBack} aria-label="Back" className="icon-btn icon-btn-tight -ml-2"><ArrowLeft className="h-5 w-5" /></button>}
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="section-label mb-1">{eyebrow}</p>}
            <h3 id={titleId} className="text-lg leading-snug">{title}</h3>
            {description && <p className="mt-1 text-sm text-jh-mute">{description}</p>}
          </div>
          {headerActions}
          <button type="button" onClick={() => onRequestClose("button")} aria-label={t("sheet.close")} className="icon-btn icon-btn-tight -mr-2">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>

        {footer && (
          <footer className="border-t border-jh-line bg-white px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

const SIZE = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-xl" } as const;
```

`SheetFooter`:

```tsx
export function SheetFooter({ primary, secondary, danger }: …) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      {danger && <button type="button" onClick={danger.onClick} className="btn-ghost text-jh-red sm:mr-auto">{danger.label}</button>}
      {secondary && <button type="button" onClick={secondary.onClick} className="btn-ghost text-jh-ink sm:ml-auto">{secondary.label}</button>}
      <button type="submit" form={primary.form} disabled={primary.busy} className="btn-primary">
        {primary.busy ? primary.busyLabel : primary.label}
      </button>
    </div>
  );
}
```

Tailwind additions (`tailwind.config.ts`):

```ts
keyframes: { "sheet-in": { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "none" } } },
animation: { "sheet-in": "sheet-in 180ms ease-out" },
```

---

## 3. Proposal — form rules (one `Field` primitive)

```tsx
// components/tracker/Field.tsx
export function Field({ label, required, optional, hint, error, children }: …) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={`label ${required ? "after:ml-0.5 after:text-jh-red after:content-['*']" : ""}`}>
        {label}{optional && <span className="ml-1 font-normal text-jh-mute-2">{t("tracker.f.optional")}</span>}
      </label>
      {cloneElement(children, { id, "aria-invalid": !!error, "aria-describedby": error || hint ? `${id}-h` : undefined,
        className: `field ${error ? "field-invalid" : ""}` })}
      {(error || hint) && <p id={`${id}-h`} className={`mt-1.5 text-[13px] ${error ? "text-jh-red" : "text-jh-mute"}`}>{error ?? hint}</p>}
    </div>
  );
}
```

```css
.field-invalid { @apply border-jh-red focus:ring-jh-red/20; }
```

Layout rules:

| Rule | Value |
|------|-------|
| Row gap | `gap-4` (16) |
| Group gap | `gap-6` (24) + `.section-label` when a form has ≥ 2 groups (contact: *Person* / *Company* / *Reach them*) |
| Columns | `grid-cols-1 sm:grid-cols-2`; pair only short siblings (Company · Role, Type · Email) |
| Required marker | asterisk on the 1 required field; drop "(Optional)" elsewhere |
| Footer | via `SheetFooter`; never a button inside the body |
| Busy label | `t("tracker.saving")` / `t("tracker.adding")` |

**Add contact / Edit contact / Create contact** are the *same form* three times (~40 lines × 3).
Fold into one `ContactForm({ initial, submitLabel, onSubmit })`; same for `OpportunityForm`.
That is the single biggest code-size win and guarantees the three never drift.

---

## 4. Proposal — Job detail

```
┌ header ──────────────────────────────────────┐
│ ACME CORP                                [⋯][X]
│ Senior Product Designer                       │
│ (● Interviewing ▾)  (Hidden)  Job link ↗      │
├ body ─────────────────────────────────────────┤
│ Source  LinkedIn                              │  ← only if present, label/value pair
│ Notes   …                                     │
│                                               │
│ CONTACTS                       [Attach ▾] [+] │
│ ┌ Maria Lopez · Hiring manager        in ✉ ⋯ ┐│
│ └─────────────────────────────────────────────┘│
│                                               │
│ REMINDERS                      + Add reminder │  ← ghost; expands composer
│ ☐ Send thank-you note · Oct 28                │
│ ☑ Apply · Oct 20                              │
└───────────────────────────────────────────────┘
```

- `⋯` menu: *Edit job* · *Delete job* (danger). Selecting *Delete* shows the inline confirm band
  at the top of the body: `Delete this job and {n} reminders? [Delete] [Keep]`.
- *Edit job*, *New contact*, *Edit contact* switch `view` and render inside the same sheet with
  `← Back`. Saving returns to `detail`.
- No footer on the detail view (it is a record, not a task); footers appear on sub-views.

---

## 5. Proposal — Import

- Eyebrow = `Step {n} of 3 · {Choose file | Review | Done}`; size `lg` throughout.
- Pick: primary *Choose CSV file*, secondary *Download template*, link *Or paste CSV text*;
  column guide in a closed `<details>`.
- Review: summary line → options (two 40 px check rows) → table → issues; footer *Back* (ghost) · *Import {n}* (primary).
- Done: keep the centred success (correct use of centring); footer *Close* primary.

---

## 6. Priority

| P | Items | Why first |
|---|-------|-----------|
| **P0 — correctness** | S4 (Esc closes both), D1 (delete confirm ×3), S5 (dirty guard), S6 (`dvh` + safe area) | Each one loses user data or hides the primary action on iPhone. |
| **P1 — Sheet v2** | S1, S2, S7, S8, S9, S10, §2 API, `SheetFooter`, stack provider | Lands once; every modal inherits header / body / footer. |
| **P2 — forms** | F1–F11, `Field`, `ContactForm` / `OpportunityForm` | Three copies of one form become one; mobile 2-col fixed. |
| **P3 — Detail** | D2–D9 | Stage in header + view stack removes the last nesting. |
| **P4 — Import + polish** | I1–I6 | Already good; cosmetic. |

Tests to extend: `tests/import-sheet.test.tsx` (step eyebrow, fixed width), new
`tests/sheet.test.tsx` (Esc handled by top sheet only, backdrop ignored when dirty, focus return),
`tests/tracker-detail.test.tsx` (delete requires confirm; stage select calls `move`).
