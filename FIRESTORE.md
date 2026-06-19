# Firestore data model — JobHacker Compass

Auth: **Firebase Auth** (email/password). All app data lives in **Firestore**.
Analytics/lifecycle events live in **Supabase** (`compass_events`), not here.

```
users/{uid}                      profile: { email, firstName, lastName, archetype, createdAt }
  ├─ contacts/{id}               { fullName, company, role, type, market, linkedinUrl, email,
  │                                phone, hasReferral, status, notes, lastContactedAt, createdAt }
  ├─ interactions/{id}           { contactId, type, scheduledAt, occurredAt, thankYouSent,
  │                                outcome, notes, createdAt }   // info/job/pleasure interviews, coffee
  ├─ opportunities/{id}          { contactId, company, role, market, stage, source, url, notes, createdAt }
  ├─ activityLogs/{id}           { categoryId, contactId?, loggedOn (YYYY-MM-DD), count, notes, createdAt }
  └─ activityTargets/{weekStart} { weekStart (YYYY-MM-DD, Monday), targets: { [categoryId]: number } }

accessGrants/{uid}               { email, plan, durationDays, source, status, redeemBy,
                                   startsAt, expiresAt, webhookPayload, createdAt, updatedAt }
                                 // status: pending | active | expired | revoked. Admin SDK writes only.

config/admin                     { paywallTitle, paywallBody, paywallCtaLabel, paywallCtaUrl,
                                   pwResetSubject, pwResetBody, updatedBy, updatedAt }
```

- `categoryId` values come from `lib/categories.ts` (the Excel taxonomy; static in code).
- `market`: `"hidden"` (~80% effort) | `"visible"` (<=20% effort).
- Admin users are flagged with a custom claim `admin: true` (set via Admin SDK).
- Security rules: `firestore.rules`.
