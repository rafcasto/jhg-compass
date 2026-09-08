# JobHacker Compass

Mobile-first job-search **activity tracker + CRM + dashboard** for the hidden vs visible job market.
Built on the JobHackers design system. Firebase (auth + data) · Supabase (event logs) · Resend · Kit.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill values (dev values already in .env.local)
npm run dev                  # http://localhost:3000
```

## Compass tab — goal statement + reading rail
- **Goal statement** is stored per member at `users/{uid}.goal` (`role, salary, city, subsector, companyType`). Legacy onboarding
  values in `users/{uid}.compass` are mapped on read (`lib/goal.ts`) so existing members don't see an empty statement.
- **Articles carousel** pulls posts from the Ghost Content API server-side (`lib/server/ghost.ts`, 10-min cache) and serves them to
  the client through `GET /api/articles` — the key never reaches the browser. Set `GHOST_CONTENT_API_URL` + `GHOST_CONTENT_API_KEY`.
  If Ghost is unreachable or unconfigured the section simply doesn't render.
- **Admin → Articles** tab chooses what the rail shows: every post carrying a Ghost tag (newest first), or a hand-picked ordered list.
  Stored in `config/articles`; defaults to `tag:compass`.
- Step-dot colours map from the post's first public tag; numbered live slugs (`1-focus`, `4-outreach`, `5-hidden-offers`…) are normalised
  in `lib/ghost.ts`.

## Coaching tab — admin-editable screen
- `/coaching` renders `components/coaching/CoachingScreen.tsx` with the **published** copy from `config/coachingScreen`
  (seed copy in `lib/coaching-screen.ts` until something is published). Designed for 390×844 with no scrolling.
- **Admin → Lead magnet CMS → Coaching** edits every string beside a true-size 390×844 preview of the real component, with
  soft character counters, a "won't fit" flag, save-as-draft / publish and an audit line. API: `GET/POST /api/admin/coaching-screen`.

## Admin portal (`/admin`)
Four top-level tabs, each with sub-tabs; the location lives in the URL hash (`/admin#cms/compass`) so links are shareable.

| # | Tab | Sub-tabs | What it owns |
|---|---|---|---|
| 1 | **TOFU** — top of the funnel | Landing page · Quiz · Registration & access · Onboarding | `config/funnel` (landing, details, quiz + scoring, thank-you, expired, already-done), invite-link generator (`/register/<token>`, "Use in funnel" points the thank-you CTA at it), sign-in / verify / set-password copy, paywall & transactional emails (`config/admin`), onboarding copy |
| 2 | **Lead magnet CMS** | Compass · Performance · Progress · Coaching | One editor per member-facing tab, in the order members see them. Every editor = form beside a **true-size preview of the real screen** + sticky save bar with audit line. Compass: header/goal copy, reading rail (Ghost curation, `config/articles`), tab names. Performance: copy, effort split, activity taxonomy (previewed with the real `PerformanceScreen`). Progress: pipeline stages + every board string. Coaching: draft/publish editor. |
| 3 | **User interactions** | Feedback · Usage | In-app survey (UAT) config + responses (`config/feedback`, `users/*/feedback`); members / access / latest Compass events |
| 4 | **Analytics** | Quiz results · Segments · Pirate metrics | Quiz dashboards; the **4-quadrant matrix** (ICP fit × buying propensity, threshold + one follow-up action per quadrant in `config/segments`); **AAARRR** in three layers — FO dashboard (Supabase + **Google Analytics** for awareness — set `GA4_PROPERTY_ID` and grant the Firebase service account Viewer on the property, see `lib/server/ga4.ts`), MO configurator (which event tag rolls into which stage, `config/events`), BO data source |

Editors that share `config/content` save only the text keys they own (`text` is deep-merged server-side), so saving the
Compass tab can never clobber Progress copy. `components/admin/nav.ts` is the single source of the tab structure.

## Tests
```bash
npm test          # vitest (jsdom + testing-library)
```

## One-time setup
1. **Firebase console** → Authentication → enable **Email/Password**. Add `localhost` to authorized domains.
2. **Firestore** → create database. Deploy rules: `firebase deploy --only firestore:rules` (or paste `firestore.rules`).
3. **Service account** → Project Settings → Service Accounts → *Generate new private key*. Then:
   ```bash
   base64 -i serviceAccount.json | tr -d '\n'   # paste into FIREBASE_SERVICE_ACCOUNT_B64 in .env.local
   ```
4. **Supabase** → SQL editor → run `supabase/migrations/0001_events.sql`.
5. **Admin user + test pass** → after the service account is set:
   ```bash
   node scripts/grant.mjs you@email.com --admin           # make yourself an admin
   node scripts/grant.mjs you@email.com --days 90          # 3-month access (req 7)
   node scripts/grant.mjs you@email.com --redeem-hours 48  # 3-month pass, redeem within 48h (req 8)
   ```

## Granting access in production (req 6)
Your lead-magnet / payment page calls the webhook:
```bash
curl -X POST https://YOURAPP/api/webhooks/access \
  -H "x-compass-secret: $COMPASS_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@user.com","firstName":"Ada","durationDays":90,"redeemHours":48,"source":"payment"}'
```
Omit `redeemHours` for immediate 3-month access. The user is emailed a set-password link via Resend.

## Requirement → feature map
| # | Requirement | Where |
|---|---|---|
| 1 | Track activities (Excel taxonomy) | `/tracker` · `lib/categories.ts` |
| 2 | Contacts + opportunities | `/contacts` (+ interactions) · `/opportunities` |
| 3 | Progress dashboard | `/dashboard` |
| 4 | Mobile-first | bottom nav, bottom-sheet modals |
| 5 | Responsive desktop | sidebar layout @ md+ |
| 6 | Access webhook | `POST /api/webhooks/access` |
| 7 | Time-boxed access (3 mo) | `durationDays` in grants |
| 8 | 24–48h redeem window | `redeemHours` → pending grant + `/api/access/sync` |
| 9 | Block expired + modal/CTA | `components/Paywall.tsx` + sync expiry |
| 10 | Admin portal (copy/CTA/email) | `/admin` (4 tabs, see above) · `/api/admin/*` |
| 11 | Events in Supabase | `compass_events` · `lib/events.ts` · `lib/track-client.ts` |
| 12 | Design system | `app/globals.css` · `tailwind.config.ts` · `/design-system` |

See `PLAN.md` and `FIRESTORE.md` for architecture details.
