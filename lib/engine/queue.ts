import "server-only";
import { Client, Receiver } from "@upstash/qstash";
import { appBaseUrl } from "@/lib/server/app-url";
import type { EngineJobType } from "./keys";

// QStash — the push queue (decision 1, docs/CAREER_OPS_CLAUDE.md §2). The jobs route
// publishes one message per unit of work; QStash calls /api/engine/run with it,
// signed, and retries on a non-2xx. No poller, no heartbeat, no zombie reaping.
//
// Env (Vercel, server only): QSTASH_TOKEN · QSTASH_CURRENT_SIGNING_KEY · QSTASH_NEXT_SIGNING_KEY.
// Without them (local dev) a job runs inline in the jobs route instead — see run.ts.

export const RUN_PATH = "/api/engine/run";

export const isQueueConfigured = () => !!(process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY);

export interface RunMessage {
  uid: string;
  jobId: string;
  type: EngineJobType;
  /** This unit's share of a fan-out job (a company, a posting); absent on a single-unit job. */
  unit?: Record<string, unknown> | null;
}

let client: Client | null = null;
const qstash = () => (client ??= new Client({ token: process.env.QSTASH_TOKEN! }));

export class QueueNotConfigured extends Error {
  constructor() { super("The engine queue is not configured (QSTASH_TOKEN / QSTASH_CURRENT_SIGNING_KEY)"); this.name = "QueueNotConfigured"; }
}

export async function publishRun(msg: RunMessage, opts: { delaySeconds?: number; retries?: number } = {}): Promise<{ messageId: string }> {
  if (!isQueueConfigured()) throw new QueueNotConfigured();
  const base = appBaseUrl();
  if (!base) throw new Error("APP_URL (or VERCEL_PROJECT_PRODUCTION_URL) must be set for the queue to call back");
  const r = await qstash().publishJSON({
    url: `${base}${RUN_PATH}`,
    body: msg,
    retries: opts.retries ?? 3,
    ...(opts.delaySeconds ? { delay: opts.delaySeconds } : {}),
    headers: { "content-type": "application/json" },
  });
  return { messageId: (r as { messageId?: string }).messageId ?? "" };
}

let receiver: Receiver | null = null;

/** True when `rawBody` was signed by QStash for this deployment. */
export async function verifyRun(signature: string | null, rawBody: string): Promise<boolean> {
  if (!signature || !process.env.QSTASH_CURRENT_SIGNING_KEY) return false;
  receiver ??= new Receiver({ currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY });
  try { return await receiver.verify({ signature, body: rawBody }); } catch { return false; }
}

export function parseRunMessage(raw: unknown): RunMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.uid !== "string" || typeof r.jobId !== "string" || typeof r.type !== "string") return null;
  return { uid: r.uid, jobId: r.jobId, type: r.type as EngineJobType, unit: r.unit && typeof r.unit === "object" ? (r.unit as Record<string, unknown>) : null };
}
