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
- **Admin → Coaching** edits every string (headline, subhead, benefits 2–4, entitlements 1–6, CTA) beside a true-size
  390×844 preview of the real component, with soft character counters, a "won't fit" flag, save-as-draft / publish and
  an audit line. API: `GET/POST /api/admin/coaching-screen`.

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
| 10 | Admin portal (copy/CTA/email) | `/admin` · `/api/admin/config` |
| 11 | Events in Supabase | `compass_events` · `lib/events.ts` · `lib/track-client.ts` |
| 12 | Design system | `app/globals.css` · `tailwind.config.ts` · `/design-system` |

See `PLAN.md` and `FIRESTORE.md` for architecture details.
