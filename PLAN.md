# JobHacker Compass — Build Plan

Mobile-first PWA + responsive desktop web app. Job-search **activity tracker** (Hidden vs Visible
job market) + **CRM** (contacts, interactions, opportunities) + **dashboard**, with gated access,
an admin portal, and full event tracking — built on the JobHackers design system.

## Stack (revised)
- **Next.js (App Router) + TypeScript + Tailwind** — one codebase, mobile-first → responsive desktop
- **Firebase** — **Auth + all app data (Firestore)**: profile, CRM, opportunities, activities, access grants, admin config
- **Supabase** — **event/analytics logs only** (`compass_events`), written server-side; plus existing `jobhackers_leads`
- **Resend** — transactional email (set/reset password) with admin-editable copy
- **Kit** — marketing email
- Firebase **GA4** — client analytics
- Design tokens from `/design-system` (Poppins/Roboto, `--jh-red`, etc.)

## Event log (Supabase)
`stage` (acquisition|activation|retention) · `tag` (`EVENT->ACTION->TRACKER`) · `source` (tracker).
e.g. signup → `stage: activation`, `tag: EVENT->REGISTRATION->TRACKER`.

## Phases
- [x] **0. Foundation** — design tokens, Tailwind, fonts, Supabase events migration
- [x] **1. Data layer pivot** — Firebase client/admin, Firestore model + rules, event pipeline, taxonomy in code
- [ ] **2. Auth** — Firebase email/password, set/reset password via Resend (admin-editable copy)
- [ ] **3. App shell** — mobile-first bottom nav + responsive desktop sidebar, PWA manifest
- [ ] **4. Tracker** — weekly Actual/Target/Variance by category; 80/20 Hidden/Visible split (req 1)
- [ ] **5. CRM** — contacts, interactions (info/job/pleasure interviews + thank-yous), opportunities (req 2)
- [ ] **6. Dashboard** — 80/20 balance, week trend, NO→YES funnel (7–9 NOs → 1 YES) (req 3)
- [ ] **7. Access webhook** — POST endpoint; Admin SDK creates user + accessGrant (req 6)
- [ ] **8. Grant logic** — 3-month grants (req 7); limited 24–48h redeem window (req 8); auto-expire
- [ ] **9. Paywall** — block expired users; modal w/ admin copy + CTA (req 9)
- [ ] **10. Admin portal** — edit paywall copy/CTA/URL + password email copy (req 10)
- [ ] **11. Event tracking** — wired across flows (req 11)
- [ ] **12. Design pass** — brand polish (req 12)

## Needed from user
- Firebase **service account JSON** (base64 → `FIREBASE_SERVICE_ACCOUNT_B64`) for webhook/admin/password-reset.
- Run `supabase/migrations/0001_events.sql` in the Supabase SQL editor.
- Deploy `firestore.rules` to Firebase.
