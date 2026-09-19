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
  └─ settings/targets            { targets: { [activityId]: weeklyNumber } }
                                 // ONLY rows the user has explicitly set. Effective target =
                                 // user override ?? config/content.activities[].defaultWeekly ?? 0
                                 // (lib/targets.ts — shared by Performance and onboarding)

accessGrants/{uid}               { email, plan, durationDays, source, status, redeemBy,
                                   startsAt, expiresAt, renewedAt?, renewedBy?, webhookPayload, createdAt, updatedAt,
                                   features?: { careerOps }, featuresUpdatedAt?, featuresUpdatedBy? }
                                 // features.careerOps: the member sees the Agents tab (Admin → TOFU → Access
                                 // renewals → Agents). Admin SDK writes only; owner reads it via useAccess().
                                 // status: pending | active | expired | revoked. Admin SDK writes only.
                                 // Stored status only flips to expired on the member's next login (syncGrant);
                                 // Admin → TOFU → Access renewals re-derives the effective status from the
                                 // timestamps (lib/access.ts) and re-grants via renewGrants (sets active,
                                 // fresh startsAt/expiresAt — or extends expiresAt if still active — renewedAt/By).

config/admin                     { paywallTitle, paywallBody, paywallCtaLabel, paywallCtaUrl,
                                   pwResetSubject, pwResetBody, updatedBy, updatedAt }

config/coachingScreen            { draft, published, publishedAt, publishedBy, updatedAt, updatedBy }
                                 // draft/published: { headline{line1,line2,line3}, subhead, benefits[],
                                 //   entitlements[], cta{label,url}, ctaCaption } — the Coaching tab copy,
                                 //   edited from Admin → Coaching (lib/coaching-screen.ts). App reads `published`.

config/content                   { effortSplit, activities[], text{}, stages[], updatedBy, updatedAt }
                                 // stages: [{ id, label, color }] — Progress-board columns in order,
                                 // managed from Admin → CMS → Progress (defaults in lib/stages.ts).
                                 // text{} is deep-merged on save: each CMS / TOFU editor writes only its keys.

config/segments                  { propensityThreshold, actions{ fit-high|fit-low|nofit-high|nofit-low:
                                   { title, description, owner, channel, automation } }, updatedBy, updatedAt }
                                 // Analytics → Segments: the 4-quadrant matrix (ICP fit × readiness) and the one
                                 // follow-up action per quadrant (lib/segments.ts)

config/agents                    { agents{ scout|extractor|evaluator|tailor|writer:
                                   { model, numCtx, temperature, systemPrompt, promptVersion, enabled, n8nWorkflowId } },
                                   dailyEvalQuota, collectLiveData, updatedBy, updatedAt }
                                 // Admin → Agents. Read by the Pi worker (Admin SDK). See docs/CAREER_OPS_AGENTS.md.
                                 // Job queue/status live in Upstash Redis (careerops:*), not here.

users/{uid}/careerOps/…          reports/{id}, pipeline/{id}, setup — mirrored by the Pi worker (phase 1+)

config/events                    { events{ [EventKey]: { enabled, tag, stage, label } }, updatedBy, updatedAt }
                                 // Analytics → Pirate metrics → Configurator. stage ∈ AAARRR (lib/tags.ts)
```

- `categoryId` values come from `lib/categories.ts` (the Excel taxonomy; static in code).
- `market`: `"hidden"` (~80% effort) | `"visible"` (<=20% effort).
- `opportunities.stage` holds a `config/content.stages[].id`; unknown / legacy ids are shown in the first column (`resolveStage`).
- **CSV import** (Progress tab) writes `contacts` and `opportunities` docs with exactly the shapes above via chunked
  `writeBatch` (`importRecords`, `lib/firestore/db.ts`); imported contact notes land in `log[]`, job notes in `notes`.
  Job → contact links resolve to existing `contacts/{id}` by email or full name at import time (`contactIds[]`).
- Admin users are flagged with a custom claim `admin: true` (set via Admin SDK).
- Security rules: `firestore.rules`.
