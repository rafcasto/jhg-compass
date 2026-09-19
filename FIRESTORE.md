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
                                   { model, numCtx, numPredict, temperature, systemPrompt, promptVersion,
                                     promptEditedBy?, promptEditedAt?, enabled, n8nWorkflowId } },
                                   dailyEvalQuota, collectLiveData, updatedBy, updatedAt }
                                 // Admin → Agents → Models / Prompts. Seeded by the Pi worker; read by it on every
                                 // job (Admin SDK). A prompt with promptEditedBy set is never auto-upgraded by the
                                 // worker. Job queue/status live in Upstash Redis (careerops:*), not here.
  ├─ promptVersions/{agent}-{v}  { agent, version, systemPrompt, savedBy, savedAt, note }   // every saved prompt
config/agentsDefaults            { agents{…}, workerVersion, updatedAt }

trainingExamples/{id}            { agent, source: claude|live, split: train|exam, approved, company, role, market?,
                                   intendedFit?, notes?, cv, profileYaml, jd, report, summary{}, teacherModel,
                                   studentPromptVersion, memberUid?, createdAt, createdBy, jobId, reviewedBy?, reviewedAt? }
                                 // Admin → Agents → Training. id = sha1(jd + cv)[0:20]. Claude gold arrives approved;
                                 // live examples (member 👍 + collectLiveData on) arrive unapproved and PSEUDONYMISED
                                 // (lib/careerops/pseudonymise.ts). Client access: none (Admin SDK only).
trainingDatasets/{name}          { agent, sources[], bySource{}, train, exam, dir, promptVersion, builtAt, builtBy, jobId }
trainingModels/{tag}             { tag, agent, source: finetune|import|ollama, status, base?, dataset?, epochs?,
                                   exam?{scoreMae, within05, archetypeAgreement, legitimacyAgreement, summaryRate,
                                   avgSeconds, cases[]}, error?, startedAt, endedAt }   // doc id = tag with ":" → "__"
                                 // The worker's built-in prompts/settings, published on boot ("Load worker default").

users/{uid}/careerOps/setup      { cvMarkdown, profileYaml, notes?, portals?{companies[],positive[],negative[]}, portalsYaml?, updatedAt }
                                 // Agents → Setup: owner-writable. profileYaml is generated from Profile + Goal
                                 // (lib/careerops/profile-yaml.ts). The Pi worker copies both into the member's
                                 // career-ops root before every job.
users/{uid}/careerOpsReports/{jobId}
                                 { jobId, n, file, company, role, url, title, score, archetype, legitimacy,
                                   summaryFound, markdown, agent, model, promptVersion, via, usage, durationMs,
                                   jdChars, jd, pipelineId?, createdAt, addedOpportunityId?, feedback?{verdict,note,at} }
                                 // Written by the Pi worker (Admin SDK) when an evaluate job finishes; the member
                                 // reads it live. "Add to Progress board" creates users/{uid}/opportunities/{id}
                                 // and stamps addedOpportunityId here.
users/{uid}/careerOpsPipeline/{id}
                                 { url, company, title, location, status: pending|evaluated|dismissed, foundAt,
                                   lastSeenAt, reportJobId?, score? }   // id = sha1(url)[0:20]; Scout-written, owner triages
users/{uid}/careerOpsDocs/{jobId}
                                 { kind: cv|cover, reportJobId, company, role, file, storage: drive|bucket|inline,
                                   driveFileId?, driveLink?, storagePath?, url?, size, pageCount, template?, words?,
                                   text?, letter?, payload?, keywordsUsed[], keywordsMissing[], model, via, durationMs,
                                   createdAt, pdfBase64? (inline only) }
                                 // Tailor / Writer output. PDFs go to the admin's Google Drive folder (one subfolder
                                 // per member email); /api/agents/docs/{id}/download streams them to the owner.

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
