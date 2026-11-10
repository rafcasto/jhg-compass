// The Claude engine for the JobHacking portal and Compass (docs/CAREER_OPS_CLAUDE.md).
//
// Pure contract — agents, models, job types, statuses, ids. No SDK, no Firebase,
// so it is unit-testable and every route, handler and admin screen imports the
// same names. The CareerOps portal's engine on the Pi (lib/careerops/keys.ts) is
// a separate contract and is not touched by anything here.

export { makeJobId } from "../careerops/keys";

// ---- agents ----
//
// An agent is a model + effort + prompt the admin can tune. The coach is the
// first; the rest are the CareerOps agents as they are reused inside JobHacking
// and Compass (each port adds its handlers, not an agent).
export const ENGINE_AGENTS = ["coach", "evaluator", "tailor", "writer", "researcher"] as const;
export type EngineAgent = (typeof ENGINE_AGENTS)[number];

export const ENGINE_AGENT_LABELS: Record<EngineAgent, { label: string; help: string }> = {
  coach:      { label: "Coach",      help: "The six conversations that write a member's profile (Narrative → LinkedIn). Chat: low effort is enough." },
  evaluator:  { label: "Evaluator",  help: "The A–G evaluation with a 1–5 score — the judgment everything else rests on. High effort." },
  tailor:     { label: "Tailor",     help: "Tailors the master CV to one posting." },
  writer:     { label: "Writer",     help: "Cover letters, application answers, follow-ups — never sends." },
  researcher: { label: "Researcher", help: "Company intelligence and the right person to contact, with web search." },
};

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];
export const isEffort = (v: unknown): v is Effort => (EFFORTS as readonly string[]).includes(v as string);

// The models the admin can pick per agent. Ids are the API's own, complete as they are.
export const ENGINE_MODELS = [
  { id: "claude-opus-5-5",   label: "Claude Opus 5.5",   note: "the default — best judgment per dollar" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "half the price; a per-agent choice after reading the meter" },
  { id: "claude-haiku-5-5",  label: "Claude Haiku 5.5",  note: "cheapest; for simple, high-volume jobs only" },
] as const;
export type EngineModelId = (typeof ENGINE_MODELS)[number]["id"];
export const DEFAULT_MODEL: EngineModelId = "claude-opus-5-5";
export const isEngineModel = (v: unknown): v is EngineModelId => ENGINE_MODELS.some((m) => m.id === v);

// ---- jobs ----
//
// A job is one unit of queued work (docs/CAREER_OPS_CLAUDE.md §2) — or a parent
// of several units. The list grows as CareerOps modules are ported; `ping` is
// the smoke test that proves queue → run → Firestore end to end.
export const ENGINE_JOB_TYPES = ["ping"] as const;
export type EngineJobType = (typeof ENGINE_JOB_TYPES)[number];
export const isEngineJobType = (t: unknown): t is EngineJobType => (ENGINE_JOB_TYPES as readonly string[]).includes(t as string);

export const ENGINE_JOB_LABELS: Record<EngineJobType, string> = {
  ping: "Test job",
};

// Which agent a job runs on (its model, effort and prompt). ping runs no model.
export const ENGINE_JOB_AGENT: Partial<Record<EngineJobType, EngineAgent>> = {};

export const ENGINE_JOB_STATUSES = ["queued", "running", "done", "failed", "cancelled"] as const;
export type EngineJobStatus = (typeof ENGINE_JOB_STATUSES)[number];
export const isEngineJobStatus = (s: unknown): s is EngineJobStatus => (ENGINE_JOB_STATUSES as readonly string[]).includes(s as string);
export const isTerminal = (s: EngineJobStatus) => s === "done" || s === "failed" || s === "cancelled";

/** A job id as makeJobId mints it: 20260919T031500-1a2b3c4d. */
export const JOB_ID_RE = /^[0-9T]{15}-[0-9a-f]{8}$/;

// ---- the meter ----

/** The month bucket of the meter: "2026-11" (UTC). */
export const monthKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);

/** The first day of the month after `now`, as a date: the day a monthly limit resets. */
export function nextMonthStart(now = Date.now()): Date {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
