# Share a JobHacking page — a read-only link

**Status:** built (2026-11-07). Scope: the JobHacking portal. Compass → Settings renders the same pages without the control.

**Ask (Rafael, 2026-11-07):** a public, shareable, read-only link to a page's content so a member can send it to someone and get feedback. Four links — **Narrative · True North · Target companies · Artefacts** — one per page. **Revised 2026-11-09** (`docs/UX_JOBHACKING.md §10`): the three artefacts are pages of their own, so the links are six — **Narrative · True North · Target companies · Story Bank · Master CV · LinkedIn profile**; the Artefacts hub has no link, and an Artefacts link minted before still renders all three. No comments, no feedback box: feedback travels back wherever the link was sent. The page should read like a Word document, not like the app.

**Method:** Refactoring UI's seven principles, applied through the portal's own system (`docs/UX_AUDIT_COMPASS_TABS.md §0`, `docs/UX_JOBHACKING.md`). Nothing new was designed where the system had the answer; the new piece is the document grammar of the public page.

---

## 1. Where the control lives — the page header, scored

Two candidates were scored; they do not tie.

| Candidate | Score | Why |
|---|---|---|
| **Page header** — one `Share` button beside the title | **9 / 10** | *Hierarchy:* the thing being shared is the h1, and `PageHeader` already reserves the slot for page-level actions; one secondary button (`btn-secondary btn-sm`, `Share2`), no red — Save stays the only primary. *Proximity:* the decision ("is this ready to show someone?") is made while reading the page; zero navigation, zero recall. The point off: the state is visible only on that page — fixed by the status line below. |
| **Settings rows** — a "Shared links" block under the four file slots | 6 / 10 | Settings is deliberately one thing (the four slots, §4 of the JobHacking doc). A second four-row block of the same four names is "everything looks the same"; four 32-char URLs on a page are noise (a URL is a value nobody reads — it gets copied); and the decision is made two taps away from the content. |

**Built:** the header button, plus a `role="status"` line under the header while the link is on (`SectionsPage`'s `status` slot):

```
JOBHACKING
True North                                   [ ↗ Share ]
What you're aiming at. Every section fills …

↗ Shared — anyone with the link can read this page.   Copy link   Stop sharing
```

The line answers "is this page public?" every time the page is opened — which is also the right place for the reminder — and carries the only two things you would do next, as text. No URL on screen.

## 2. The sheet

The shared `Sheet` (`size="sm"`), two states:

| Link off | Link on |
|---|---|
| Title *Share True North*. One paragraph: anyone with the link can read this page as a document — exactly what is on it now, nothing else on the account; switch it off any time. Footer: **Turn on link** (primary) · Cancel. | Title *Share True North*. The link in a read-only `.field` (selects on focus) with a `Shared 7 Nov · live` line. Footer: **Copy link** (primary; says *Copied* for a moment) · *Stop sharing* (danger, far left). |

Red budget: the sheet's primary is the one thing you came for — turn on, or copy. *Stop sharing* is the footer's danger slot, as every destructive action in the app.

The button is hidden while the page has nothing to share and no link is on (`shareEmpty`); on a phone it sits full-width on the page overview, as every page action does.

## 3. The public page — `/share/<token>`

Outside the shell: no sign-in, no sidebar, no bottom bar, `noindex`. Rendered on the server from the member's own documents; the browser receives the one page and the member's name, nothing else.

```
[logo]  JobHackers Global                                  ← 24px mark, mute wordmark (.share-chrome)

True North                                                 ← h1, 30 / 36
Ana Ferreira · shared 7 Nov 2026                           ← 14px mute

In 60 days, I'm working as Senior Delivery Lead, in …      ← the statement, as an opening
                                                              paragraph (True North only)
Target industry                                            ← h2, 20px, 48px above
Freight dispatch software
INDUSTRIES RESEARCHED                                      ← .label (13px, mute) — recedes
Logistics software
  Freight dispatch · Sunrise · …                           ← a quiet line under each entry

…                                                          ← every section of the page, in the
                                                              page's order; an empty one is left out
────────────────────────────────────────────
Shared read-only by Ana Ferreira from JobHackers Global · live — what you see is the current version.
```

**Document, not app.** `max-w-prose` (~65ch), left-aligned, on the paper itself — no white card on grey, which is the single biggest "app" cue. Hierarchy by size and weight only: h1 → author line → h2 per section → `.label` → value. Ink, body and mute; **zero red, zero buttons, zero state glyphs, zero counts**. Lists are stacked entries with a hairline between (the portal's row grammar flattened: a mono index, one heavy name, a mute line, label · value pairs under it, a nested list for a story's snapshots or an industry's sub-sectors); keyword groups are plain bullets; the CV is its markdown. The only links are the ones the member's data carries (a careers page, a posting, a proof-point URL) — ink, underlined, never a button. `@media print` drops the logo line and the footer, lets the column take the sheet, and keeps a section on one page where it can (`.share-doc` in `globals.css`), so ⌘P gives a clean PDF.

A dead link (unknown, or switched off) gets the same frame with one quiet heading — *This link is no longer shared* — not an error screen.

**RUI score: 9 / 10.** Remaining: the Top 40's ~40 rows and a long Master CV scroll long on a phone with no in-page jump; a sticky section heading is the next step if readers ask.

## 4. What a document carries

The page's own sections (`jhSectionsFor(page, { portal: "jobhacking" })`), in the page's order, **less Contact details** — the author line carries the name; the phone, email and links never enter a document. Compass-only sections (Work rights, Portfolio / demo, the Agents area) are never shared. A section with nothing in it is left out; a reader sees what is there, never *Not set*.

Every block is read from the same fields the page shows (`jhSectionFields`) and the same workbook helpers its panels use — the member's own values first, the file's facts after, never doubled:

| Page | Sections in the document |
|---|---|
| Narrative | Headline (+ the Narrative file's positioning line) · Bridge story (+ one-line version) · Core competencies (+ superpowers, lead skills) |
| True North | the statement as the lead · Target industry (+ industries researched) · Target roles (archetypes, framing, titles, keeper phrases, clusters, postings read) · Seniority · Salary range (range, floor, comp notes, scripts, negotiation lines) · Location (+ rules, the file's will-work-in / remote / relocate) · Company type · Boundaries |
| Target companies | Top 3 · Top 10 · Top 40 (sunrise / sunset groups of ranked rows, each with the research written for that list; the Top 40 adds other sub-sectors and the coach's challenges) · Watchlist (careers pages, titles to include / exclude) |
| Artefacts | Story Bank (proof points; stories with STAR-R lines, the fact behind each, snapshots under them) · Master CV (markdown, house rules, locked sections, languages) · LinkedIn profile (LinkedIn's seven sections) |

**Note on the CV.** The Master CV is the member's own document, written to be sent: its header — name, phone, email — renders as written. Sharing *Artefacts* shares the CV as it is.

**Live, not a snapshot.** The link reads the same documents the page does, so an edit shows on the link at once — what makes a second round of feedback cheap. The footer says so.

## 5. Mechanics

Mirrors registration links.

```
shareLinks/{token}            { uid, page, createdAt, revokedAt? }   server-only (rules: allow read, write: if false)
users/{uid}/shares/{page}     { token, createdAt }                   owner reads live (users/{uid}/{sub=**}); server writes
```

- **Token:** `crypto.randomUUID()` without dashes — 32 hex chars, checked before any read (`isShareToken`). Minted by the server, never in the browser.
- **`POST /api/share { page }`** mints (revoking any current link for that page first); **`DELETE /api/share { page }`** revokes. Bearer ID token (`requireUser`); `page` must be one of the four. The owner's record and the index are written in one batch.
- **Revoke** deletes the owner's record and stamps the index `revokedAt`; switching back on mints a **new** token, so a link forwarded before stays dead. `resolveShare` also checks the owner's record still names the token.
- **`/share/[token]`** is a server component (`force-dynamic`, `noindex`): `loadSharedDocument` → `shareDocument(page, { profile, setup })` → `SharedDocument`. One page in the response, no uid, no email.
- The control is the JobHacking portal's (`JobHackingScreen` passes it only when `portal === "jobhacking"`); the Agents area, Compass-only, is never a share page.

## 6. Components

| | |
|---|---|
| `lib/jobhacking/share.ts` | the four share pages, token / URL / date helpers, and the **document model** — `shareDocument(page, signals)` → title · author · lead · sections of blocks (`text · markdown · facts · list · entries`); `shareEmpty` — pure, tested |
| `lib/server/shares.ts` | `createShare · revokeShare · resolveShare · loadSharedDocument` — Admin SDK |
| `app/api/share/route.ts` | POST / DELETE, bearer-authenticated |
| `components/jobhacking/SharePage.tsx` | `useShare` (the owner's record, live) · `ShareButton` + the sheet · `ShareStatus` |
| `components/share/SharedDocument.tsx` | the document renderer and the dead-link page — server-safe, no hooks |
| `app/share/[token]/page.tsx` | the public route, `generateMetadata` with `noindex` |
| `app/globals.css` | `.share-doc` print rules |
| `tests/jobhacking-share.test.ts` | the model against the Packer's four example files: sections per page, no contact details, own values before file facts, empty sections left out |
| `tests/share-document.test.tsx` · `tests/jobhacking-share-control.test.tsx` | the renderer; the button, sheet and status line against a mocked `/api/share` |

## 7. Not built, on purpose

- **No feedback box.** v1 is read-only as asked. If feedback ever belongs in-app, the clean step is a small *Leave a note* at the foot of the public page writing to `shareLinks/{token}/feedback` (rate-limited, no account), and a count on the page header — a change of its own.
- **No per-section links.** One grain for v1: the page. A reviewer asked about a Bridge story gets the Narrative link.
- **No overview of all links.** The status line answers "is this page public?" page by page. If "all my links in one place" comes up, the home for it is the Compass Settings hub's area rows (which already quote each area's state), not JobHacking → Settings.
- **No expiry, no view count.** Switch it off when you are done.
