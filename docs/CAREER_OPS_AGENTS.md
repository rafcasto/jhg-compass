# Career-Ops Agents in JobHacker Compass — Design

Status: **proposal** (2026-09-19). Nothing here is built yet.

Goal: give a selected group of Compass members a GUI over
[career-ops](https://github.com/career-ops-hq/career-ops) (scan → evaluate A–G →
tailor CV → track), running on **local models on the Raspberry Pi** through
**n8n agent workflows**, bridged by **Upstash Redis**, with an admin
**Agents** tab (tab 5, after Analytics) to pick models, edit agent prompts,
and run / import fine-tuned models.

Vercel never runs a model; it queues jobs and reads status back. The Pi side
lives in its own repo: [rafcasto/careerops-worker](https://github.com/rafcasto/careerops-worker).

---

## 0. Before anything else — rotate the Upstash token

The `UPSTASH_REDIS_REST_TOKEN` was pasted into a chat. Treat it as leaked:
Upstash console → database → **Reset token**, then put the new value in
Vercel env (Production + Preview) and in the Pi's `~/careerops-worker/.env`.
It must never appear in git, n8n workflow JSON, or a Modelfile.

Decision needed: **dedicated Upstash DB or shared?** Either works — all keys
below are namespaced `careerops:*`. A dedicated DB is cleaner for billing/limits.

---

## 1. Topology

```
 Member browser ──► Compass (Vercel, Next 14, Firebase Auth)
                       │  /agents page (feature-flagged)     /admin#agents (admin claim)
                       │  API routes: enqueue job, read status, save config
                       ▼
                 Upstash Redis (REST)          Firestore (source of truth for results/config)
                 careerops:queue  ◄────────────────────────────┐
                 careerops:job:<id> (status/log)               │ Admin SDK writes
                 careerops:worker (heartbeat)                  │
                 careerops:state  (models, n8n, versions)      │
                       ▲ RPOP / HSET                           │
                       │                                       │
 Raspberry Pi 5 (16 GB) ─────────────────────────────────────  │
   careerops-worker (node, systemd)  ── webhook ──► n8n 2.38 (agents)
        │  per-user data root                              │
        │  ~/careerops-data/<uid>/  (cv.md, profile.yml,   │ Ollama chat node
        │   data/, reports/, output/)                      ▼
        └── runs career-ops scripts               Ollama 0.34 :11434
            (scan.mjs, generate-pdf.mjs …)        qwen2.5:1.5b · llama3.2:3b · careerops-* (fine-tuned)
        │
        └── ssh gpu (192.168.1.95:2222) ── unsloth LoRA fine-tune ── GGUF back ── `ollama create`
```

Why Redis in the middle: the Pi has no public IP. The worker *pulls* (RPOP over
HTTPS) so nothing is exposed, and Vercel functions stay stateless and short.

Why the worker exists next to n8n: n8n can't long-poll Redis REST cleanly and
shouldn't hold the Upstash token in workflow JSON. The worker owns queue,
heartbeat, per-user filesystem, Firestore writes and the GPU ssh; n8n owns
**what an agent does** (prompt, model, tools) — the part you want to edit
visually and train later.

---

## 2. Access control ("selected group of users")

**Flag lives on the grant**, written by Admin SDK only (rules already allow
owner read / admin write on `accessGrants/{uid}`):

```ts
// lib/types.ts
export interface AccessGrant {
  …existing…
  features?: { careerOps?: boolean };   // Admin → TOFU → Access renewals
  featuresUpdatedAt?: number; featuresUpdatedBy?: string | null;
}
```

**Where the toggle lives** — the same screen that extends access:
`components/admin/tofu/AccessRenewals.tsx`.
- New column **"Agents"** with a pill (on/off) per member.
- The "Grant access" bar gets a second action: **"Enable agents for N selected"**
  / "Disable agents" (bulk, same selection model as renewals).
- API: `POST /api/admin/access/features { uids, careerOps: boolean }` →
  `setGrantFeatures()` in `lib/server/grants.ts`; audit-logged with `TAGS.AGENTS_TOGGLED`.

**Member side** — `components/AppShell.tsx` adds a 5th nav item when
`grant.features?.careerOps && hasAccess`:
`{ href: "/agents", label: t("nav.agents"), icon: Bot }`.
`app/(app)/agents/page.tsx` also checks the flag server-side on every API call
(`requireAgentsMember()` = valid ID token + active grant + flag), so a URL
guess is useless.

---

## 3. Multi-tenancy of career-ops

career-ops is single-user by design; the fix is the data-root env it already
supports (`modes/_shared.md` § Data Root):

```
CAREER_OPS_ROOT=/home/rafcasto/careerops-data/<uid>   # per job
```

System layer (`modes/`, `*.mjs`) = one shared upstream checkout at
`~/career-ops` (updatable with `node update-system.mjs`). User layer per uid:

```
~/careerops-data/<uid>/
  cv.md                    ← from the member's Compass upload/editor
  config/profile.yml       ← generated from Compass Profile + Goal (jobTitle, industry, geography, salary)
  modes/_profile.md        ← optional, editable in GUI later
  data/pipeline.md, data/applications.md, data/scan-history.tsv …
  reports/NNN-company-date.md
  output/*.pdf
```

Files stay canonical for the scripts (ARCHITECTURE.md doctrine); the worker
**mirrors** results into Firestore so the GUI is live (`onSnapshot`, like every
other Compass screen) and works even if the Pi is off:

```
users/{uid}/careerOps/reports/{reportId}   { n, company, role, url, score, archetype, verdict,
                                             markdown (A–G), scoreSummary{}, model, agent, jobId, createdAt }
users/{uid}/careerOps/pipeline/{id}        { url, title, company, location, source, status: pending|evaluated|dead }
users/{uid}/careerOps/setup                { cvMarkdown, profileYaml, cvUpdatedAt, portals[] }
```
PDFs → Firebase Storage `careerops/{uid}/output/{file}.pdf` (bucket already exists).

Firestore rules: `users/{uid}/**` is already owner read/write, so no rule change;
the worker uses the Admin SDK (same service-account JSON as Vercel, base64 in `.env`).

---

## 4. Redis contract (`careerops:*`)

Same shape as `training:*` so `worker.js` logic is reusable almost verbatim.

| key | type | meaning |
|---|---|---|
| `careerops:queue` | list | job ids — site `LPUSH`, worker `RPOP` (FIFO) |
| `careerops:jobs` | zset | job ids scored by createdAt (admin listing) |
| `careerops:job:<id>` | hash | `id,type,uid,status,payload,createdAt,createdBy,startedAt,endedAt,worker,progress,log,result,error,cancel` |
| `careerops:user:<uid>:jobs` | zset | that member's job ids (member listing / quota) |
| `careerops:worker` | string (EX 120) | heartbeat `{id,host,pid,version,at,current,pollMs,n8n:bool,ollama:bool}` |
| `careerops:state` | string | worker-published `{models[], agents[] (n8n workflow ids+active), datasets, gpu:{reachable}, updatedAt}` |
| `careerops:rpc` / `careerops:rpc:<id>` | list / string | short sync calls (e.g. `ollama list`, `n8n workflows`) — 60 s reply TTL |

Job types (`type` field):

| type | who can queue | what the worker does |
|---|---|---|
| `evaluate` | member | JD text or URL → liveness → **Evaluator agent** (n8n) → report.md + Firestore mirror |
| `scan` | member | `node scan.mjs` with member's `portals.yml` → pipeline.md → Firestore pipeline |
| `pdf` | member | `node generate-pdf.mjs <report>` → Storage |
| `cover` | member | **Writer agent** → cover letter md/pdf |
| `sync_setup` | member (auto on save) | write cv.md / profile.yml into the user root |
| `import_model` | admin | download GGUF+Modelfile from Storage → `ollama create` |
| `build_dataset` | admin | approved reports → `train.jsonl` (+ golden from `career-ops/evals/golden`) |
| `finetune` | admin | rsync → `ssh gpu` unsloth LoRA → GGUF back → `ollama create careerops-<agent>:<tag>` |
| `exam` | admin | `eval-golden.mjs --live --model <tag>` agreement score |
| `promote` | admin | set agent's model in `config/agents` (worker just validates the tag exists) |

Quota: per member `careerops:quota:<uid>:<yyyymmdd>` counter, default 10 evaluations/day
(the Pi does ~4 tok/s on a 2 k prompt; an A–G report is 1–3 k tokens out).
Admin can raise it per user later; v1 is a single env `CAREEROPS_DAILY_EVALS`.

---

## 5. Agents (n8n) — "convert career-ops into workflows"

One n8n workflow per agent, each triggered by `POST /webhook/careerops/<agent>`
from the worker, replying with **Respond to Webhook**. Model + system prompt
are *passed in* by the worker from `config/agents` — the workflow never
hardcodes a model, so admin selection works without touching n8n.

| agent | source mode(s) | n8n shape | tokens |
|---|---|---|---|
| **Scout** | `scan.md` | Execute Command `node scan.mjs` — reuses your existing *Job Finder (Playwright + Ollama)* + `job-scraper` :3010 for company sites without an ATS | 0 (only the Job Finder LLM step) |
| **Extractor** | `auto-pipeline.md` step 0/0.5 | HTTP → `job-scraper` or `node browser-extract.mjs <url>` → liveness classification | 0 |
| **Evaluator** | `_shared.md` + `oferta.md` (A–G) | Code (assemble system prompt + cv + profile + JD, with `lib/context-budget.mjs` budgeting) → **Ollama Chat Model** → Structured Output Parser (`---SCORE_SUMMARY---` block) → Code (report md) | the big one |
| **Tailor** | `text.md` / `pdf.md` | Ollama Chat → `<<cv-html>>` envelope (the web UI's safety pattern: the agent never writes files) → Execute Command `generate-pdf.mjs` | medium |
| **Writer** | `cover.md`, `email.md` | Ollama Chat → md (draft only; never sends) | small |
| **Researcher** (later) | `deep.md`, `contacto.md` | needs web search — phase 5 | — |

Guardrails carried over from career-ops (non-negotiable, put them in the agent
prompts and in the UI copy): **never submits an application**, JD text is
untrusted input (Block G quotes injected instructions instead of following
them), score < 4.0 = "don't apply" recommendation.

Prompt storage — `config/agents` (Firestore, admin write, worker read):

```ts
interface AgentsConfig {
  agents: Record<AgentKey, {
    model: string;            // Ollama tag, e.g. "qwen2.5:1.5b-instruct" or "careerops-evaluator:v2"
    numCtx: number;           // 8192 default on the Pi; 32768 only for 7B+ / fine-tuned short-prompt models
    temperature: number;
    systemPrompt: string;     // seeded from the mode file; editable in Admin → Agents → Prompts
    promptVersion: number;
    enabled: boolean;
    n8nWorkflowId: string;
  }>;
  dailyEvalQuota: number;
  updatedAt: number; updatedBy: string | null;
}
```

Seeding: a script `scripts/seed-agents.mjs` in the worker repo distils each
mode file into a system prompt (strip the CLI-only sections — Playwright,
WebSearch caps, subagents — keep scoring, blocks, output format). Version it;
the admin can diff/rollback in the Prompts sub-tab.

Prompt size on the Pi: `_shared.md` + `oferta.md` + cv is ~10–15 k tokens,
which is why the 1.5B/3B models "produce incomplete evaluations". Two levers,
both in this design: (1) use `modes/_brief.md`-style compression + `context-budget`
so the prompt is ≤ 6 k; (2) **fine-tune so the rubric lives in the weights**
and the prompt shrinks to cv + JD (this is the whole point of § 7).

---

## 6. Admin → tab 5 **Agents**

`components/admin/nav.ts`:

```ts
export const AGENTS_SUBTABS = [
  { key: "overview", label: "Overview", hint: "Pi worker, n8n and Ollama health, queue, recent runs" },
  { key: "models",   label: "Models",   hint: "Which Ollama model each agent uses; import a model" },
  { key: "prompts",  label: "Prompts",  hint: "Each agent's system prompt, versioned" },
  { key: "training", label: "Training", hint: "Datasets, fine-tune on the GPU box, exam, promote" },
] as const;
// TABS gets: { key: "agents", label: "Agents", title: "AI agents", subs: AGENTS_SUBTABS }  ← 5th
```
(`tests/admin-nav.test.ts` asserts the tab list — update it.)

**Overview** — heartbeat card (online/offline, host, version, current job),
Ollama reachable, n8n reachable + each agent workflow active, queue length,
last 50 runs table (type, member, model, duration, tokens, status) with
log/result drawer, cancel button. Data: `GET /api/admin/agents/status`,
`GET /api/admin/agents/jobs`, `POST /api/admin/agents/jobs/[id]/cancel`.

**Models** — one row per agent: dropdown of tags from `careerops:state.models`
(live from the Pi), `numCtx`, `temperature`, **Save**. Plus "Import model":
upload `.gguf` + `Modelfile` to Storage → queues `import_model`. Shows size,
modified, and which agents use each tag; "Test" button runs a one-off `exam`.

**Prompts** — textarea per agent with version list, "Restore v N", "Reset to
career-ops mode file". Saves bump `promptVersion`.

**Training** — see § 7. Worker status must be online; buttons are disabled
otherwise.

All admin routes: `requireAdmin()` (already in `app/api/admin/access/route.ts`),
Zod-validated bodies, `logEvent` audit on mutations.

---

## 7. Training ("trained by Claude later")

Teacher–student. **Claude is the teacher, the Pi model is the student**, and
career-ops' own golden harness is the exam.

Dataset sources (all → `~/careerops-training/datasets/<name>/train.jsonl`,
one `{system, user(cv+jd), assistant(report)}` per line):

1. **Approved reports** — in the member GUI and the admin runs table an
   evaluation can be marked ✅ *good example* (optionally after editing).
   Only admins' own accounts by default; members' data enters a dataset only
   with an explicit per-user opt-in flag (privacy: CVs are PII).
2. **career-ops golden set** — `career-ops/evals/golden` (frozen Claude-tier
   verdicts) — free, licence-compatible (MIT).
3. **Claude-generated** — a `generate_gold` job: for N JDs in the pipeline,
   call Claude (API key on the Pi only, optional) with the *full* mode files
   to produce reference reports. This is the "train by Claude" path and is
   also how you refresh the dataset when you change a prompt.

Jobs (admin only, Training sub-tab):

| button | job | where it runs |
|---|---|---|
| Build dataset | `build_dataset` | Pi |
| Generate gold with Claude (N) | `generate_gold` | Pi → Anthropic API |
| Fine-tune `<agent>` from `<base>` | `finetune` | Pi → **ssh gpu** (192.168.1.95:2222, already in `~/.ssh/config`; `careerops-worker/training/train_lora.py` — unsloth LoRA, 8 GB VRAM is enough) → GGUF → `ollama create careerops-evaluator:<tag>` |
| Import model | `import_model` | Pi (for models trained elsewhere — Colab/RunPod — upload GGUF via the Models sub-tab) |
| Exam `<tag>` | `exam` | Pi: `node eval-golden.mjs --live --model <tag>` → archetype agreement %, score MAE |
| Promote | `promote` | writes `config/agents.<agent>.model` |

Bases that fit both the GPU box (8 GB VRAM enough per `train_lora.py`) and the
Pi at inference: `unsloth/Qwen2.5-1.5B-Instruct`, `unsloth/Llama-3.2-3B-Instruct`,
`unsloth/Qwen2.5-3B-Instruct`. Start with 1.5B for speed, 3B for quality.

If the GPU box is not always on: the worker checks `gpu.reachable` in
`careerops:state`; the Fine-tune button shows "GPU host offline — train
elsewhere and Import" instead of failing mid-run.

Hailo note: `hailortcli` reports firmware 5.1.1 on this Pi. Hailo-8/8L are
vision NPUs and won't run these LLMs; only a Hailo-10H would. Not part of v1.

---

## 8. Member GUI — `/agents`

Four sub-views (same `SubTabs` component as admin, member-facing copy in
`config/content.text` so it's CMS-editable):

1. **Setup** — CV editor (markdown, or upload .md/.txt/.docx→md), preview of
   the generated `profile.yml` from their Compass Goal (title, industry,
   geography, target/min salary, country → `authorized_in`), portals list.
   Save → `sync_setup` job. Empty state explains the "first evaluations won't
   be great — feed it context" idea from the README.
2. **Evaluate** — paste URL or JD text → job card with live status
   (`queued · 2 ahead · ~6 min`, `running · Block D`), then the A–G report
   rendered from markdown, score badge, verdict, Block G legitimacy flags.
   Actions: **Add to Tracker** (creates `users/{uid}/opportunities` doc with
   company/role/url and stage = first column — links the two products),
   **Tailor CV → PDF**, **Draft cover letter**, 👍/👎 (feeds § 7 when opted in).
3. **Scan** — run Scout; pending list from Firestore pipeline with
   "Evaluate" per row and "dead" badges.
4. **Reports** — history table (score, company, date, model) → open.

Realtime: job status via polling `GET /api/agents/jobs/[id]` every 3 s while
`queued|running`; results via `onSnapshot` on the Firestore mirror. No
websockets needed.

---

## 9. Code map

**Compass (this repo)**

```
lib/types.ts                              AccessGrant.features, AgentsConfig, CareerOpsJob, CareerOpsReport
lib/careerops/keys.ts                     Redis key contract (pure, unit-tested)
lib/careerops/queue.ts                    server-only: enqueue/get/list/cancel/heartbeat/state  (contract mirrored in careerops-worker/lib/keys.js)
lib/careerops/profile-yaml.ts             Compass Profile+Goal → profile.yml (pure, tested)
lib/server/grants.ts                      + setGrantFeatures()
lib/server/agents-config.ts               get/save config/agents
app/api/admin/access/features/route.ts    POST toggle flag
app/api/admin/agents/{status,jobs,jobs/[id],config,models}/route.ts
app/api/agents/{jobs,jobs/[id],setup}/route.ts   member routes (requireAgentsMember)
components/admin/nav.ts                   AGENTS_SUBTABS + 5th tab
components/admin/agents/{AgentsTab,Overview,Models,Prompts,Training}.tsx
components/admin/tofu/AccessRenewals.tsx  Agents column + bulk enable/disable
components/AppShell.tsx                   conditional 5th nav item
app/(app)/agents/page.tsx + components/agents/{Setup,Evaluate,Scan,Reports,ReportView,JobCard}.tsx
FIRESTORE.md                              new docs; .env.example: UPSTASH_REDIS_REST_URL/TOKEN, CAREEROPS_DAILY_EVALS
```

**Pi — [rafcasto/careerops-worker](https://github.com/rafcasto/careerops-worker)** (keep `~/career-ops` a clean upstream clone)

```
worker.js                 queue loop, heartbeat, state, rpc
jobs/{evaluate,scan,pdf,cover,sync_setup,import_model,build_dataset,generate_gold,finetune,exam}.js
lib/{user-root,firestore,storage,n8n,ollama,gpu}.js
n8n/*.json                exported agent workflows (Scout, Extractor, Evaluator, Tailor, Writer)
scripts/seed-agents.mjs   mode file → system prompt
training/train_lora.py    unsloth LoRA fine-tune (GPU box)
deploy/careerops-worker.service   user-level systemd unit
.env.example              UPSTASH_*, FIREBASE_SERVICE_ACCOUNT_B64, CAREER_OPS_REPO, DATA_BASE, N8N_URL, OLLAMA_BASE_URL, GPU_SSH_HOST, ANTHROPIC_API_KEY (optional)
```

---

## 10. Phases

| # | deliverable | ~effort |
|---|---|---|
| 0 | Rotate token · worker skeleton with heartbeat/state · Redis contract + queue lib in Compass · feature flag + toggle in Access renewals · `/agents` stub showing worker status · Admin tab 5 Overview | 1–2 days |
| 1 | Evaluator end-to-end: Setup (CV + profile.yml) → `evaluate` job → n8n Evaluator (Ollama) → report in Firestore → rendered A–G + Add to Tracker | 2–3 days |
| 2 | Admin Models + Prompts (model per agent, prompt versions); quota; runs table + cancel | 1–2 days |
| 3 | Scout (scan) + Tailor (PDF to Storage) + Writer (cover) | 2 days |
| 4 | Training: approved-report dataset, golden import, GPU fine-tune via ssh, import GGUF, exam, promote | 2–3 days |
| 5 | Researcher agent (web search), Claude gold generation at scale, per-user quotas | later |

---

## 11. Decisions (2026-09-19)

1. **Upstash:** dedicated DB `JHG-Compass`. Keys stay namespaced `careerops:*`.
2. **Training machine:** `gpu` (192.168.1.95:2222), **not always on** → the worker probes it
   every state publish; Fine-tune is disabled with an "offline" hint when unreachable, and
   the Import-model path (GGUF upload) is a first-class alternative, not a fallback.
3. **Training data:** primary source is **synthetic gold generated by Claude Fable 5.1**
   (`generate_gold` job, Anthropic API key on the Pi only). Live member data enters a dataset
   only when the admin turns **"Collect training data from live users"** on
   (`config/agents.collectLiveData`, default **off**); when on, approved reports are copied
   into the dataset with the CV pseudonymised (name/email/phone/links stripped by the worker).
4. **Tracker of record:** Compass `users/{uid}/opportunities` (kanban). `applications.md`
   is only the scripts' working file inside the per-user root.
5. **Cohort:** 10–20 members eventually, **1 tester now** → quota `CAREEROPS_DAILY_EVALS=20`
   for now, per-member override later.
