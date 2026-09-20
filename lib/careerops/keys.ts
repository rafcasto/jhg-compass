// Redis key contract shared with the Pi worker (careerops-worker/worker.js).
// Pure module — no Upstash, no Firebase — so it is unit-testable and the worker
// can mirror it verbatim. Change both sides together.
//
//   careerops:queue             list    job ids — site LPUSH, worker RPOP (FIFO)
//   careerops:jobs              zset    job ids scored by createdAt (admin listing)
//   careerops:job:<id>          hash    the job record (CareerOpsJob)
//   careerops:user:<uid>:jobs   zset    that member's job ids (member listing)
//   careerops:quota:<uid>:<day> string  evaluations queued today (EX 2 days)
//   careerops:worker            string  heartbeat JSON, EX 120 s
//   careerops:state             string  worker-published snapshot (models, agents, gpu)
//   careerops:rpc / :rpc:<id>   list / string  short synchronous calls, 60 s reply TTL

export const KEYS = {
  queue: "careerops:queue",
  jobs: "careerops:jobs",
  job: (id: string) => `careerops:job:${id}`,
  userJobs: (uid: string) => `careerops:user:${uid}:jobs`,
  quota: (uid: string, day: string) => `careerops:quota:${uid}:${day}`,
  worker: "careerops:worker",
  state: "careerops:state",
  rpc: "careerops:rpc",
  rpcReply: (id: string) => `careerops:rpc:${id}`,
} as const;

/** Heartbeats older than this mean the Pi worker is offline. */
export const WORKER_STALE_MS = 90_000;

// ---- job types ----

// Members queue the first group; only admins may queue the second.
export const MEMBER_JOB_TYPES = ["evaluate", "scan", "pdf", "cover", "sync_setup", "deep", "advise", "contacto", "apply", "interview_prep", "followup", "patterns"] as const;
export const ADMIN_JOB_TYPES = ["import_model", "build_dataset", "generate_gold", "finetune", "exam", "promote"] as const;
export type MemberJobType = (typeof MEMBER_JOB_TYPES)[number];
export type AdminJobType = (typeof ADMIN_JOB_TYPES)[number];
export type CareerOpsJobType = MemberJobType | AdminJobType;

export const JOB_TYPE_LABELS: Record<CareerOpsJobType, string> = {
  evaluate: "Evaluate job",
  scan: "Scan portals",
  pdf: "Tailor CV → PDF",
  cover: "Draft cover letter",
  sync_setup: "Sync CV & profile",
  deep: "Company deep-dive",
  advise: "Training / project verdict",
  contacto: "Outreach contact + DM",
  apply: "Application answers",
  interview_prep: "Interview prep",
  followup: "Follow-up draft",
  patterns: "Rejection patterns",
  import_model: "Import model",
  build_dataset: "Build dataset",
  generate_gold: "Generate gold (Claude)",
  finetune: "Fine-tune",
  exam: "Exam",
  promote: "Promote model",
};

export const isMemberJobType = (t: unknown): t is MemberJobType => (MEMBER_JOB_TYPES as readonly string[]).includes(t as string);
export const isAdminJobType = (t: unknown): t is AdminJobType => (ADMIN_JOB_TYPES as readonly string[]).includes(t as string);
export const isJobType = (t: unknown): t is CareerOpsJobType => isMemberJobType(t) || isAdminJobType(t);

export const JOB_STATUSES = ["queued", "running", "done", "failed", "cancelled"] as const;
export type CareerOpsJobStatus = (typeof JOB_STATUSES)[number];
export const isJobStatus = (s: unknown): s is CareerOpsJobStatus => (JOB_STATUSES as readonly string[]).includes(s as string);
export const isTerminal = (s: CareerOpsJobStatus) => s === "done" || s === "failed" || s === "cancelled";

// ---- agents ----

export const AGENT_KEYS = ["scout", "extractor", "evaluator", "tailor", "writer", "researcher"] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];
// kind: "llm" agents run a model with an editable system prompt; "script" agents are
// career-ops scripts (zero tokens) — no prompt, no model. Scout and Extractor may gain an
// LLM triage / cleanup step later; until then the admin UI says so instead of showing a blank.
export const AGENT_LABELS: Record<AgentKey, { label: string; mode: string; help: string; kind: "llm" | "script"; scriptNote?: string }> = {
  scout:     { label: "Scout",     mode: "scan.mjs",                  kind: "script", help: "Finds postings on the member's portals by reading the public job-board APIs and filtering titles by keywords. Zero tokens.", scriptNote: "Runs career-ops scan.mjs — no model involved. A future version may add an LLM triage step that ranks what it found against the member's profile." },
  extractor: { label: "Extractor", mode: "fetch + browser-extract.mjs", kind: "script", help: "Pulls the JD text from a posting URL and checks the posting is still live. Zero tokens.", scriptNote: "Plain page fetch with career-ops browser-extract.mjs as fallback — no model involved. A future version may add an LLM cleanup step (clean JD, salary/location fields, closed-posting detection)." },
  evaluator: { label: "Evaluator", mode: "_shared.md + oferta.md",   kind: "llm", help: "The A–G evaluation with a 1–5 score. The agent we train first." },
  tailor:    { label: "Tailor",    mode: "text.md / pdf.md",         kind: "llm", help: "Tailors the CV for a posting and renders the ATS-safe PDF." },
  writer:    { label: "Writer",    mode: "cover.md / email.md / apply.md / followup.md", kind: "llm", help: "Drafts cover letters, application answers and follow-ups — never sends." },
  researcher:{ label: "Researcher", mode: "deep.md / contacto.md",    kind: "llm", help: "Company intelligence and the right person to contact. Uses Claude with web search when the Pi has an Anthropic key; otherwise the local model works from what it is given." },
};

// Which agent's model/prompt each member job runs on (the worker mirrors this in jobs/*.js).
export const JOB_AGENT: Record<MemberJobType, AgentKey> = {
  evaluate: "evaluator", scan: "scout", pdf: "tailor", cover: "writer", sync_setup: "extractor",
  deep: "researcher", contacto: "researcher", advise: "evaluator", interview_prep: "evaluator", patterns: "evaluator",
  apply: "writer", followup: "writer",
};
export const LLM_AGENTS = AGENT_KEYS.filter((k) => AGENT_LABELS[k].kind === "llm");

// ---- helpers ----

/** UTC day bucket for quotas: "20260919". */
export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10).replace(/-/g, "");

/** Sortable, unique job id: 20260919T031500-1a2b3c4d. */
export function makeJobId(now = Date.now(), rand = Math.random().toString(16).slice(2, 10)) {
  const stamp = new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
  return `${stamp}-${rand.padEnd(8, "0").slice(0, 8)}`;
}

export const workerOnline = (heartbeatAt: number | null | undefined, now = Date.now()) =>
  heartbeatAt != null && now - heartbeatAt < WORKER_STALE_MS;
