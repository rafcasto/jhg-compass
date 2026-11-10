# The coach in the portal — proposal

**Status:** phase 1 built (2026-11-10, branch `feat/coach-narrative`, on the engine foundation of PR #95): the launcher and the docked panel on every JobHacking / Settings page, Coach 1 · Narrative in conversation, `update_profile` writing the profile through the upload's own path, the session document, metering and the monthly limit. Not yet: Coaches 2–6 (shown in the panel as *on its way*), the expanded page and its rail, the empty-row link, the live-write highlight, voice (phases 2–3). Scope: the JobHacking portal and Compass → Settings; the admin's per-member switches; the Claude API on Vercel. **The CareerOps portal and its Pi worker are unchanged** (Rafael, 2026-11-10); the coach is the first consumer of a new Claude engine for JobHacking and Compass (`docs/CAREER_OPS_CLAUDE.md` — its phase 0, the foundation, is this coach's prerequisite), on which CareerOps modules will later be reused inside these two portals.

**Ask (Rafael, 2026-11-10):** embed the AI coach in both portals instead of uploading the six `.yml` files; a voice **conversation** (not push-to-talk) so the coach can interview the member; Claude API; behind a flag the admin switches on per member. **Clarified:** no file — the coach knows the schema and the member's profile is its context; it writes the profile directly. **No upload** for coach members after this. The JobHacking menu keeps its **two levels — JobHacker Compass · Artefacts**.

**Decisions (Rafael, same day):** 1 model as recommended · 2 a conversation, not push-to-talk · 3 a floating coach on every section, expandable — evaluated in §3 · 4 web search as recommended · 5 no upload · 6 prompts in the repo + admin override in Firestore · 7 a monthly quota, measured first.

**Method:** Refactoring UI's seven principles, scored against the way a member builds a profile today, applied through the existing system (`docs/UX_AUDIT_COMPASS_TABS.md §0`, `docs/UX_JOBHACKING.md`, `docs/UX_SETTINGS_HUB.md`). No new component where one exists; no second way to write the profile.

---

## 0. Where we are — score 5 / 10

The six Gemini Gems (`maleta/gemini-pack`, v7) are the better product: one question at a time, warm but blunt, never fabricate, each coach owns one part of the profile. The portal is the better reader: one schema, merge key by key, every field shown on the page it belongs to. What is wrong is the seam between them.

| Today | What's wrong (Refactoring UI lens) |
|---|---|
| The member builds the profile **in Gemini**, then carries six files to the portal | The portal's primary job — build your profile — has no primary action in the portal. **Hierarchy:** the one thing that matters most is a link out to another product. |
| JobHacking → Settings is the only door; every page reads *Not in your profile yet* until the files arrive | A new member sees four pages of empty rows and a Settings page that asks for files they do not have. **Empty state** with no call to action. |
| Each Gem asks the member to upload the earlier files it reads | The portal already holds them. The member is the courier between two systems that know the same things. |
| Save points are the member's job | A chat that gets too long loses work. Nothing in the portal knows a coach was half done. |
| The coach's rules live in six Gem prompts outside the repo | Not versioned with the schema the portal validates. |

What is right and stays: the six coaches in order; one question at a time; the member says yes to every table and draft *in the conversation*; the schema; `mergeProfile`; `FileFacts`; the pages; the two-level menu.

## 1. The idea in one line

**The coach sits beside every page and writes the profile as you talk.** The member's profile (`users/{uid}` + `users/{uid}/careerOps/setup`) is the coach's context and its output: it reads the stored profile when a conversation opens, and every time the member says yes to a table or a draft it writes those keys — the same schema paths a file would have carried — straight into the profile. The page beside it updates live. No file, no slot, no upload, no review step: the conversation is the review.

```
Gemini (today)       member ──talks──▶ Gem ──prints──▶ file ──member carries──▶ Settings slot ──review──▶ merge ──▶ pages
Coach (proposed)     member ──talks──▶ Coach ──"yes"──▶ update_profile ──merge──▶ the page beside the conversation
```

## 2. Target IA

### JobHacking portal — the menu does not change

```
sidebar (unchanged)                          what the coach adds
JOBHACKER COMPASS                            ◉ launcher, bottom-right of every page  → docked panel (desktop) · full-height sheet (mobile)
  Narrative          ← Coach 1                 the panel opens on the coach for the page you are on
  True North         ← Coach 2               /jobhacking/coach           the panel expanded: the full page, rail of six in the two groups
  Target companies   ← Coach 3               /jobhacking/coach?coach=…   one coach in conversation
ARTEFACTS
  Story Bank         ← Coach 4
  Master CV          ← Coach 5
  LN                 ← Coach 6
account: Settings · Sign out                 Settings for a coach member = progress + export (§5), no slots
```

The six coaches **are** the six menu rows — the two levels hold: Coaches 1–3 write the JobHacker Compass pages, 4–6 the Artefacts. No *Coach* row is added to the menu, and no *Talk to your coach* button to page headers: the launcher is the one door, on every page, so a second door would be the two-doors mistake `UX_SETTINGS_HUB.md §0` removed. Empty rows still point at it — *Not in your profile yet* becomes *Your coach writes this — open the coach ›*, which opens the panel on that coach, on that section.

### Compass → Settings

```
/settings                 hub: identity · YOUR COACH (six rows, two groups) · YOUR PROFILE (five areas)      — the files card is gone for coach members
/settings/<area>          unchanged; the launcher is here too, opening the coach that writes this area
/settings/coach           the expanded page, base=/settings, eyebrow SETTINGS · COACH
```

The hub's `.btn-primary` becomes **Continue with your coach** (the first unfinished coach). *Export profile.yml* stays a page action — a CLI checkout still reads it.

### Who sees it — the flag

`GrantFeatures.coach?: boolean`, same shape as `careerOps` and `jobHacking`:

| Layer | Change |
|---|---|
| `lib/types.ts` | `coach?: boolean` on `GrantFeatures`, with the doc comment. |
| `lib/access.ts` · `lib/firestore/access.ts` | `coach` on `MemberAccessRow`; `coachEnabled: ok && grant?.features?.coach === true` on `useAccess`. |
| `lib/server/grants.ts` · `app/api/admin/access/features` | the rows carry `coach`; the route accepts it (`setGrantFeatures` already takes a partial). |
| `components/admin/tofu/AccessRenewals.tsx` | a third switch pair, `PORTAL_LABEL.coach = "Coach"`, the same *Enable for N · Disable* row with a `MessageSquare` glyph; a *Coach* column in the table (`on` pill / mute `off`). |
| `lib/server/auth.ts` | `requireCoachMember(req)` — signed in, grant active, `features.coach` or admin — on every `/api/coach/*` route, the way `requireAgentsMember` gates CareerOps. |
| `AppShell` · `JobHackingScreen` · `SectionsPage` · `SettingsHub` | the launcher, the empty-row link and the hub section render only when `coachEnabled \|\| isAdmin`. Admins always have it. |

The flag is independent of the portals: a JobHacking-only member can have it; a Compass member with it sees it on Settings.

## 3. Where the coach lives — the floating coach, evaluated

The ask: a bubble floating on each section, with the option to expand. Four candidates scored for a conversation that lasts one to four hours and writes fields the member wants to see land.

| Candidate | What it is | Hierarchy | Width / type | Mobile | The live writes | Score |
|---|---|---|---|---|---|---|
| **A. Bubble + popover** (Intercom) | 56 px disc; tap → a 380×560 box anchored above it | The disc is good presence; the box competes with the page it floats over and hides the bottom-right of every page | 380 px − padding ≈ 45ch: the floor of the readable range; tables from the coach won't fit | A 560 px box on a phone is the page minus a sliver — all the cost of a sheet, none of the structure | The page is behind the box; a write lands under it | **6** |
| **B. Bubble + docked panel** | The same disc; tap → a panel docked to the right edge, full height, the page stays visible and interactive beside it | One column of conversation next to one column of page — two things, each in its lane; the disc hides while the panel is open | 440 px − 2×24 ≈ 55ch: inside 45–75; the coach's tables fit | The disc opens a full-height `Sheet` — the thing the app already does for every long dialog | The page is beside the panel: *Updated · Salary range* and the row changes, on screen, as it is said. **This is the reason to float the coach at all.** | **9** |
| **C. Bottom sheet everywhere** | Tap → a sheet from the bottom, half or full | On desktop a half-sheet is a letterbox; full is a modal that hides the page | fine | native | hidden behind the sheet | 6.5 |
| **D. Full page only** | A `Coach` page, no presence elsewhere | Clean, but the member leaves the page they were filling; one more menu row in a menu decided as two groups | best | best | on another page | 7.5 |

**Recommendation: B, with D as its expanded state.** The floating disc is the presence; the docked panel is where the work happens; *Expand* opens the full page for the long sessions (Coach 3's forty companies) and for a phone held for an hour. One conversation, one transcript, three sizes — the member never loses a turn moving between them.

### The launcher

```
                                                  ┌────┐
                                                  │ ◉  │  56 × 56, bg-jh-ink, white MessageSquare (24 px)
                                                  └────┘  fixed bottom-6 right-6 (desktop); above the tab bar + safe-area on mobile
```

- **Ink, not red.** Red is the page's primary action (a Save inside an editor); the disc is a door, always there. A dark disc on a white page carries weight through contrast alone (*semantic colour ≠ visual weight*). The one red on it is a **6 px dot** at the top-right when the coach has asked something and is waiting — the one genuine "your turn" state — and never otherwise.
- **The one floating element.** `shadow-jh-3` — the largest in the scale, which nothing else on these pages uses, so the disc is the one thing that sits above the page. Radius: full. Hover: `bg-jh-ink` → a 4% lift (`shadow-jh-3` stays). Hidden while the panel is open; the panel's × brings it back.
- **A label when it matters.** First visit to a page whose coach is unfinished: the disc carries a tail — *Start True North* / *Continue True North*, `font-display` 15 px on ink — that collapses to the disc after the first open (remembered on the session document). After that, the `aria-label` carries the state.
- **Never over content.** 24 px inset on desktop; on mobile `bottom: calc(tab-bar + safe-area + 16px)`, right 16. The pages' content has `pb-24` already, so the last row is never under it.

### The panel

```
┌ page (still live) ─────────────────────────────┐┌ panel 440px ─────────────────────────────────┐
│ JOBHACKING · TRUE NORTH                        ││ COACH 2 OF 6 · TRUE NORTH      ◯ Voice ⤢  × │
│ ┌ rail ─────┐ ┌ Salary range ────────────────┐ ││                                              │
│ │ Industry  │ │ Range   AUD 200,000–230,000  │ ││ Noted: floor AUD 180,000. And the range      │
│ │ Roles     │ │ Floor   AUD 180,000          │◀┼┼ you're aiming at?                            │
│ │ Seniority │ │ Scripts —                    │ ││                                              │
│ │ ● Salary  │ │                      [ Save ]│ ││ YOU                                          │
│ │ Location  │ └──────────────────────────────┘ ││ 200 to 230.                                  │
│ │ …         │  FROM YOUR TRUE NORTH FILE       ││                                              │
│ └───────────┘  range · floor · negotiation      ││ ✓ Updated Salary range                       │
│                                                ││                                              │
│                                                ││ Now where you'll be based — the city, and    │
│                                                ││ how flexible you are about it?               │
│                                                ││ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │
│                                                ││ 🎙  Type your answer…              [ Send ] │
└────────────────────────────────────────────────┘└──────────────────────────────────────────────┘
```

- **It is `Sheet`, docked.** The tracker's `Sheet` already has the three-part anatomy (sticky header · scrolling body · sticky footer), the focus handling, Esc, the stack and `dvh` + safe-area on mobile. It gains one prop, `dock="right"`: on `md+` it renders fixed to the right edge, full height, `bg-white border-l border-jh-line shadow-jh-3`, **no scrim and no scroll lock** — the page beside it stays interactive, so a member can correct a field by hand while talking. Below `md` the prop is ignored: the same full-height bottom sheet every dialog uses. Width 440 (`sm:max-w-[440px]`; `lg` in the size scale is 576 — too wide for a side lane on a 1280 screen; 440 is added to `SIZE` as `side`).
- **Header**: `.section-label` eyebrow *COACH 2 OF 6 · TRUE NORTH*, the **Voice** switch, `⤢` *Expand* (`.icon-btn`, → `/jobhacking/coach?coach=trueNorth`), ×. No title line — the eyebrow is enough and the body starts 16 px below.
- **Body — a transcript, not bubbles.** Left-aligned, 15 px / 1.6 in the panel (16 / 1.75 on the expanded page). The coach's turns are plain prose in `jh-ink` (markdown via `react-markdown` + `remark-gfm`, already in the deps — the coach's review tables stay tables). The member's turns under a `.section-label` **You** on a `jh-mist` block, radius 8. No avatars, no timestamps in the flow. 24 px between turns, 8 px inside a turn: groups read as groups.
- **Writes are the status line.** Each `update_profile` renders as the portal's `role="status"` line — `✓ Updated Salary range` with *View ›* when the section is not the one beside it. On the page, the row that just changed gets a **600 ms `bg-jh-mist` fade** (`prefers-reduced-motion`: none) — the one microinteraction, and the one that connects talk to page.
- **Footer — the composer.** Textarea (auto-grow to 6 lines) · the mic `.icon-btn` · **Send** `.btn-primary` — the one red in the panel. In voice (§4) the footer becomes the voice strip.
- **Page-aware.** The panel opens on the coach for the page (and the section the member has open, if any) and the coach is told so — a mid-conversation `system` message *The member is looking at True North · Salary range* — so "let's do this one" works, and the empty-row link lands exactly there. The message is appended, never edited into history, so the cache holds.
- **Persistent across pages.** Opened on Narrative, still open on True North — the panel is mounted in `AppShell`, above the routed page; the launcher state and the open coach live in one small store. A coach that is not the page's is fine; the eyebrow says which one it is.

### The expanded page — `/jobhacking/coach` · `/settings/coach`

`SectionsPage` geometry: 232 px rail + a `max-w-prose` transcript; overview rows → drill-in on mobile. The rail is the six coaches **under the menu's two headings** (`.section-label` *JobHacker Compass* · *Artefacts*, the same `DesktopSidebar` recipe), each row the slot grammar: state glyph (`✓ · ◐ · ○` from `jhg.progress.<coach>`) · name · *about 1 hour* · chevron; a dot on the one in conversation; *N of 6 complete* and the ink progress bar under them. A coach whose inputs are not complete is a mute row with *After True North* under it — tappable, it explains in one line rather than dead. The transcript and composer are the panel's, wider. **Collapse** (`⤡`, `.icon-btn`) returns to the page the member came from with the panel open. On mobile this is where a long session lives; the bottom tab bar hides while the composer is up.

## 4. Voice — a conversation

The Claude API has no speech endpoint; the voice is built around it, in the browser first, as a **continuous conversation** rather than push-to-talk.

**The loop.** *Voice* on (the header switch, `jh-ink` when on) →

1. **Listening.** The mic stays open (`SpeechRecognition`, `continuous`, `interimResults`). Interim words appear in `jh-mute` in the voice strip as they are recognised; a final result in `jh-ink`.
2. **End of turn.** ~1.2 s of silence after a final result sends the turn. No button. (A member who wants to think says nothing final — interim text does not send.)
3. **Thinking.** The strip reads *Thinking…* with the three-dot pulse the Progress board uses.
4. **Speaking.** The coach's reply streams in; each sentence is spoken through `speechSynthesis` as it completes, so the first words are heard in ~1 s, not after the whole turn. The mic is muted while the coach speaks — the browser would otherwise hear it — and reopens on the last sentence.
5. **Interrupting.** A tap on the strip (or Space, when the panel has focus) stops the speech and opens the mic: barge-in. The unspoken rest of the turn stays in the transcript.

```
┌ voice strip (replaces the composer) ─────────────────────────────┐
│ ▁▃▅▃▁  Listening…                                                │   bars in jh-ink, 44 px tall, the whole strip is the interrupt target
│ "two hundred to two thirty"                                      │   interim in jh-mute → final in jh-ink
│                                       ⌨ Type instead   ◯ Voice  │   .btn-ghost in ink (not red) · the switch
└──────────────────────────────────────────────────────────────────┘
```

- **The transcript is still the record.** Every spoken turn is a transcript turn; a wrong word is corrected by saying so ("not 230, 220") — the coach already handles corrections — or by *Type instead*, which drops back to the textarea with the mic paused. Nothing is lost between the two.
- **The coach talks differently when heard.** While Voice is on, the request carries a mid-conversation `system` message — *Voice: the member is listening. Keep turns under 60 words, one question, no tables; when you need a yes on a table, say its lines in a sentence.* — cache-safe, and off again the written register returns.
- **Numbers and names.** Recognition is weakest on exactly what the profile needs — figures, company names, URLs. Rule in the prompt: *in voice, read back every number, name and URL before writing it* — the yes the Gems already ask for, made explicit. URLs and emails are typed: the coach asks for them and the strip offers *Type instead* in that moment.
- **Where it works.** Chrome, Edge, Safari (Safari's `continuous` restarts itself every ~60 s; the hook restarts it silently). Firefox has no `SpeechRecognition`: the switch is absent, not disabled, and the composer is the conversation. `speechSynthesis` voices differ by device; the hook picks the best `en` voice available and the admin can set a preferred voice name.
- **v2 — a provider, behind the same switch.** When the complaint is recognition (accents, names) or the robotic voice, the loop moves to a streaming STT/TTS provider over a websocket from `/api/coach/voice` (Deepgram / ElevenLabs / OpenAI audio — chosen then, not now): same strip, same states, same transcript, same Claude turn in the middle. Nothing in the panel changes. Not built until measured use asks for it.

## 5. No upload — what Settings becomes

For a member with the flag (decision 5), **the six slots, the drop zone, the upload sheet and the upload lock do not render.** `ProfileFilesPanel` stays for members without the flag (unchanged, with its lock); nothing is deleted.

- **JobHacking → Settings** (`JobHackingSettings`): the header *Your coach writes your profile* + one line; the six coach rows in the two groups (the expanded page's rail, as a list — open one, see its state); then *Export profile.yml* (`.btn-secondary`) and, under a `.section-label` *Danger*, *Start a coach over* (`.btn-ghost`, confirm; clears that transcript, never the profile).
- **Compass → Settings hub**: *Your profile files* is replaced by **Your coach** — the same six rows — above *Your profile*. Export stays the page action.
- The `jhg.progress.<coach>` stamps the coach writes drive every state the slots used to show; `profileFiles` is simply not written. A member who had uploaded Gemini files before the flag keeps everything: the coach reads the profile as it is and resumes from it (the Gems' own rule).

## 6. The API — Claude on Vercel

The coach runs on Vercel against the Claude API — as the CareerOps engine will, once it leaves the Pi: `app/api/coach/turn/route.ts`, `runtime = "nodejs"`, streaming. One key, `ANTHROPIC_API_KEY`, in Vercel env (Production + Preview), never in the browser; `@anthropic-ai/sdk` joins the deps.

| Piece | Decision |
|---|---|
| Model | `claude-opus-5-5` at `output_config.effort: "low"`; a Coach 1 run on `claude-sonnet-5-5` measured before phase 1 closes (decision 1). Server-side refusal fallback on (`fallbacks: "default"`). The model id lives in `config/coach` so it can be changed without a deploy. |
| Streaming | `client.messages.stream(...)` → SSE to the browser; the transcript fills as the coach writes, sentence boundaries flagged for the voice. `max_tokens` 4096 — turns are ≤ 250 words by the prompt's rule. |
| System prompt | Stable, cached (`cache_control: { type: "ephemeral", ttl: "1h" }`): the coach's instructions + `profile-schema.md` (the authority for every key) + its sample, ~20–40K tokens. Today's date after the breakpoint. Verify `usage.cache_read_input_tokens` > 0 on turn two — logged (§8). |
| The profile as context | The server builds it from Firestore when a conversation opens — `profileFromSetup` → `profileToYaml`, the whole profile so far in the schema the coach knows — into the first user turn. After each `update_profile` the tool result returns the keys as stored; a member's own edit on the page is appended as a short system note on the next turn (*The member changed Salary range by hand: …*). History is never edited, so the cache holds. |
| Tools | **`update_profile`** (`strict: true`): `{ patch: <partial profile in the schema's keys>, progress?: "in_progress" \| "complete" }`. The server validates the patch against the schema, restricts it to **the keys this coach owns** (§1 of the schema; `lib/coach/owns.ts`, tested — a Narrative key from Coach 2 comes back as a tool error the coach reads), merges with `mergeProfile` semantics (lists replace, maps merge key by key, nothing unmentioned is dropped), writes one `setDoc` with merge to `users/{uid}/careerOps/setup` — `jhg.identity.fullName` to `users/{uid}` as `shapeJhFile` does — and stamps `jhg.progress.<coach>`. Coaches 2 and 3 also get `web_search_20260209` (`max_uses` 10 per turn) for market wording, postings and growth signals (decision 4); *nothing found online becomes a claim about the student* stays in the prompt. |
| Long sessions | Server-side compaction (`compact-2026-01-12`, `client.beta.messages`), the whole `response.content` appended back each turn; since every yes is already in the profile, a compacted summary never holds the only copy of anything. |
| Thinking | Omitted (adaptive by default on Opus 5.5); `display` stays `omitted`. |
| Prompts (decision 6) | The six `gem-*.md` + `profile-schema.md` + samples move into the repo as `lib/coach/prompts/` (the source stays in `maleta/`; the pack is a build output already), with the Gemini-isms replaced once: "print the file / offer a download" → "call `update_profile` after each yes, `progress: complete` at hand-over"; "upload your files" → "your profile is in front of me"; Google Search → the tool; the voice and page-context rules added. **Admin override in Firestore** through the pattern `agents-config.ts` already has: `config/coach/{coach}` with `systemPrompt`, `promptVersion`, `updatedBy`, archived versions under `config/coach/promptVersions/{coach}-{n}`, *Reset to default* restoring the repo text — edited in Admin → CareerOps → a new **Coach** tab (§8). |

## 7. Storage

```
users/{uid}/coachSessions/{coachKey}       coachKey = JhgFileKey (narrative · trueNorth · targetCompanies · storyBank · masterCv · linkedin)
  status: "idle" | "in_progress" | "complete"
  messages: MessageParam[]                   the API transcript, appended whole (tool blocks, compaction blocks included)
  turns, lastTurnAt, openedOn: JhPageKey     (openedOn: which page the launcher was on — the tail label's memory)

users/{uid}/coachUsage/{YYYY-MM}             the month's meter (§8)
  turns, inputTokens, cacheWriteTokens, cacheReadTokens, outputTokens, webSearches, estimatedUsd
  byCoach: { narrative: { turns, estimatedUsd }, … }

config/coach                                 model, monthlyBudgetUsd (0 = no limit), monthlyTurnQuota (0 = no limit), preferredVoice
config/coach/{coach}                         the prompt override (§6)
```

Written by the route (Admin SDK); read live by the panel (`useLiveDoc`; owner rules already cover `users/{uid}/**`). **The profile has no new home**: the coach writes `users/{uid}/careerOps/setup` and `users/{uid}` — the documents every page already reads live. *Start over* clears a transcript and nothing else.

## 8. The monthly quota — measure first (decision 7)

- **Every turn is metered.** The route adds the response's `usage` (input, cache write, cache read, output; web searches from the server-tool blocks) to `coachUsage/{YYYY-MM}` and prices it with `lib/coach/pricing.ts` — a small table of per-MTok rates by model id (Opus 5.5: $4 / $20, cache read $0.20, cache write 1.25×; Sonnet 5.5: $2 / $10, cache read $0.10; web search per call) that the admin can see and edit on the Coach tab. `estimatedUsd` is an estimate, labelled so.
- **Limits start at 0 = none.** `config/coach.monthlyBudgetUsd` and `monthlyTurnQuota`; both off until the first month's numbers are in. When one is reached, the route answers 429 and the panel shows one mute line in the transcript — *You've used this month's coaching time. It resets on 1 December.* — no modal, nothing red; the pages and the transcript stay readable. An admin is never limited.
- **Admin → CareerOps → Coach** (a tab beside Models, same `Section` grammar):
  - *This month*: one `StatCard` row — members active · turns · est. cost · cost per active member — then a table, member · turns · tokens (in / cached / out) · est. USD · coaches complete · last turn; sortable by cost; last three months in a `Segmented`.
  - *Limits*: the two numbers and the model id (`NumberField`s, as Models has).
  - *Prompts*: the six coaches, each with the prompt editor, version and *Reset to default* — the Agents tab's prompt editor reused.
  - The flag itself stays where the portals are switched: Admin → TOFU → Access renewals.

## 9. Components

| Component | Status | Role |
|---|---|---|
| `components/coach/CoachLauncher.tsx` | new | The disc + tail + dot; mounted in `AppShell` for both portals when the flag is on. |
| `components/coach/CoachPanel.tsx` | new | `Sheet dock="right"` with the header, `Transcript`, the composer / voice strip; mounted once in `AppShell`. |
| `components/coach/CoachScreen.tsx` | new | The expanded page: `SectionsPage` geometry, rail of six in two groups. |
| `components/coach/Transcript.tsx` | new | Coach prose (markdown), member blocks, status lines, the streaming turn. |
| `components/coach/Composer.tsx` · `VoiceStrip.tsx` | new | Textarea · mic · Send; the continuous `SpeechRecognition` + `speechSynthesis` hook (`useVoiceConversation`). |
| `components/tracker/Sheet.tsx` | touched | `dock="right"` (no scrim, no scroll lock on `md+`) and a `side` width. |
| `components/profile/SectionsPage.tsx` | touched | The empty-row link to the coach; the 600 ms row highlight on a live write. |
| `JobHackingSettings` · `SettingsHub` | touched | §5 — the coach rows instead of the files card for flagged members. |
| `AccessRenewals` · `useAccess` · `grants.ts` · `auth.ts` | touched | The flag (§2). |
| `components/admin/careerops/CoachTab.tsx` | new | §8. |
| `lib/coach/` | new | `prompts/`, `owns.ts`, `turn.ts` (request builder: cache breakpoints, tools, voice + page-context system messages), `write.ts` (validate · restrict · merge · stamp · `setDoc`), `session.ts`, `usage.ts`, `pricing.ts`. Pure where it can be; tested like `profile-files.ts`. |

Nothing red that isn't a primary action or the one waiting dot; radii 8/12 (full on the disc); the row grammar everywhere; 44 px targets; `jh-mute` the floor for readable text; `shadow-jh-3` on the disc and the panel only.

## 10. RUI score — target 9 / 10

| Surface | Now | Target | Why |
|---|---|---|---|
| Building the profile (JobHacking) | 5 | **9** | One door on every page; the page fills beside the conversation; empty rows point at it; the menu's two levels untouched. Remaining: a four-hour Coach 3 on a phone — the expanded page carries it; a "ten at a time" chapter list in its rail is the v2 if members stall. |
| The launcher + panel | — | **9** | One floating element with the one floating shadow; ink disc, red only for "your turn"; a `Sheet` the app already has, docked; 55ch; two lanes, each with one job. Remaining: on a 1024–1279 screen the page beside a 440 panel is narrow — the panel overlays there (the page scrolls under it) rather than docking; acceptable, the expanded page is one tap away. |
| Voice | — | **8.5** | A real loop (listen → send on silence → speak as it streams → barge-in), the transcript as the record, numbers read back. Remaining: browser recognition and voices — the measured v2 trigger. |
| Compass → Settings hub | 9 | **9** | One section swapped for another in the same row grammar; the primary button moves to the thing that matters. |
| Admin → Coach tab | — | 8.5 | The Models / Agents grammar reused; cost labelled as an estimate. |

## 11. Phases — one PR each

1. **Flag + Coach 1 in the panel, text** — on the engine foundation (`docs/CAREER_OPS_CLAUDE.md` phase 0: `claude.ts`, the meter, `config/engine`). The flag end to end; `/api/coach/turn` with caching, metering and `update_profile` restricted to the Narrative keys; `Sheet dock="right"`; launcher + panel in `AppShell`; the Narrative coach; the empty-row link; the live-write highlight. Behind the flag to you and two members. Read the first month's meter.
2. **All six + the expanded page + Settings.** `owns.ts` for every coach; web search on 2 and 3; compaction; the rail's *After X* state; `/jobhacking/coach` and `/settings/coach`; §5's Settings; the Admin Coach tab with prompts, limits and usage.
3. **Voice.** The conversation loop, the strip, the voice system message, the mobile composer. Then the provider decision from real use.

## 12. Readiness for CareerOps — confirmed against the code

The engine's three required inputs (`intakeSteps`, `lib/careerops/intake.ts`) and the coach that writes each (through `maletaToSetupPatch`, the same mapping an upload uses):

| CareerOps needs | Stored as | Written by | |
|---|---|---|---|
| A CV — every agent quotes it as evidence | `setup.cvMarkdown` | **Coach 5 · Master CV** (`cv`) | ✓ |
| A North Star goal — scoring is relative to it | `setup.intakeGoal`, `goalSource: "intake"` | **Coach 2 · True North** (`goal`) | ✓ |
| Companies to watch, with careers pages | `setup.portals.companies[].careersUrl` · `positive` · `negative` | **Coach 3 · Target companies** (`watchlist.companies`); **Coach 2** (the title keywords) | ✓ — 25 of the 40 (`MAX_COMPANIES`); a company without a careers URL stays on the list but out of the Scout's file |
| Standard answers | `careerOpsAnswers` | no coach — the Apply screen asks | optional |

The Pi worker reads `cvMarkdown` + `profileYaml` (goal · contact · policy · notes · personalization) + `portalsYaml`; Coach 1's contact, bridge story and superpowers reach it through `personalization`, and Coach 4 (stories, proof points) and Coach 6 (LinkedIn) are stored but not read — the schema marks `stories`, `narrative.proofPoints`, `companyLists`, `linkedin` as "not yet". **The Claude engine for JobHacking and Compass reads the whole stored profile** — its prompts are ours to write, so when CareerOps modules are reused in these portals the Story Bank feeds the Tailor's evidence, the ranked lists feed the Scout's priorities and the LinkedIn blocks feed outreach. The Pi keeps reading what it reads today. Nothing a coach writes is wasted.

Consequences for this design:

- **CareerOps is runnable after Coach 5, not after Coach 3** — the CV is required. The rail says so on the Master CV row: *CareerOps can run from here.* `features.coach` does not switch CareerOps on; a member still needs `features.careerOps` for that portal — two switches, deliberately.
- **`write.ts` rebuilds `profileYaml` and `portalsYaml` after every `update_profile`** (`buildSetupProfileYaml`, `buildPortalsYaml`) — they are the derived strings the Pi reads, and the Pi stays. (Found while checking: `ProfileUploadSheet` rebuilds `profileYaml` but not `portalsYaml`, so an uploaded `target-companies.yml` does not refresh the Scout's file until the Watchlist panel is next saved; the shared helper fixes it.)
- **One meter, one quota.** The meter of §8 is the engine's (`users/{uid}/claudeUsage/{YYYY-MM}`, `byCoach` beside `byJob`), so the monthly budget covers coaching and every later reuse together; the Admin Coach tab is the engine's admin surface. The Pi's quotas and Admin → CareerOps are untouched.

## 13. Still open (small)

- The silence that ends a spoken turn: 1.2 s proposed; tuned on the first voice sessions.
- The panel's width on 1024–1279 screens: overlay (proposed) or a narrower 400 dock.
- Which `en` voice to prefer per platform — set from the admin tab once heard on real devices.
