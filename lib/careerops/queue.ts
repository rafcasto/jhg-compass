import "server-only";
import { Redis } from "@upstash/redis";
import {
  KEYS, dayKey, isJobStatus, isJobType, makeJobId, workerOnline,
  type CareerOpsJobStatus, type CareerOpsJobType,
} from "./keys";
import type { AgentsStatus, CareerOpsJob, WorkerHeartbeat, WorkerState } from "./types";

// Server-side view of the Pi queue. Vercel never runs a model: it LPUSHes job ids
// here and reads status/log/result back; the worker on the Pi RPOPs and HSETs.
// The Pi worker (rafcasto/careerops-worker) mirrors this contract in lib/keys.js.

const LIST_LIMIT = 50;
let client: Redis | null | undefined;

export function isQueueConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function redis(): Redis {
  if (client === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    client = url && token ? new Redis({ url, token }) : null;
  }
  if (!client) throw new QueueNotConfigured();
  return client;
}

export class QueueNotConfigured extends Error {
  constructor() { super("Agents queue is not configured (UPSTASH_REDIS_REST_URL / _TOKEN)"); this.name = "QueueNotConfigured"; }
}

const num = (v: unknown): number | undefined => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
};
function json<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return null; } }
  return v as T;
}

function toJob(raw: Record<string, unknown> | null): CareerOpsJob | null {
  if (!raw || typeof raw.id !== "string" || !isJobType(raw.type)) return null;
  const status: CareerOpsJobStatus = isJobStatus(raw.status) ? raw.status : "queued";
  return {
    id: raw.id, type: raw.type, status,
    uid: typeof raw.uid === "string" ? raw.uid : "",
    payload: json<Record<string, unknown>>(raw.payload) ?? {},
    createdAt: num(raw.createdAt) ?? 0,
    createdBy: typeof raw.createdBy === "string" ? raw.createdBy : "",
    startedAt: num(raw.startedAt), endedAt: num(raw.endedAt),
    worker: typeof raw.worker === "string" ? raw.worker : undefined,
    progress: typeof raw.progress === "string" ? raw.progress : undefined,
    log: typeof raw.log === "string" ? raw.log : undefined,
    result: raw.result === undefined ? undefined : json<unknown>(raw.result),
    error: typeof raw.error === "string" ? raw.error : undefined,
    cancel: num(raw.cancel),
  };
}

export async function enqueueJob(input: { type: CareerOpsJobType; uid: string; payload: Record<string, unknown>; createdBy: string }): Promise<CareerOpsJob> {
  const r = redis();
  const createdAt = Date.now();
  const id = makeJobId(createdAt);
  const job: CareerOpsJob = { id, type: input.type, status: "queued", uid: input.uid, payload: input.payload, createdAt, createdBy: input.createdBy };
  const p = r.pipeline();
  p.hset(KEYS.job(id), { id, type: job.type, status: job.status, uid: job.uid, payload: JSON.stringify(job.payload), createdAt, createdBy: job.createdBy });
  p.zadd(KEYS.jobs, { score: createdAt, member: id });
  p.zadd(KEYS.userJobs(input.uid), { score: createdAt, member: id });
  p.lpush(KEYS.queue, id);
  await p.exec();
  return job;
}

export async function getJob(id: string): Promise<CareerOpsJob | null> {
  return toJob(await redis().hgetall<Record<string, unknown>>(KEYS.job(id)));
}

async function listByZset(key: string, limit: number): Promise<CareerOpsJob[]> {
  const r = redis();
  const ids = await r.zrange<string[]>(key, 0, Math.max(0, limit - 1), { rev: true });
  if (!ids.length) return [];
  const p = r.pipeline();
  for (const id of ids) p.hgetall<Record<string, unknown>>(KEYS.job(id));
  const rows = await p.exec<(Record<string, unknown> | null)[]>();
  // Listings are for humans: keep the log out (fetched per job).
  return rows.map(toJob).filter((j): j is CareerOpsJob => !!j).map((j) => ({ ...j, log: undefined }));
}
export const listJobs = (limit = LIST_LIMIT) => listByZset(KEYS.jobs, limit);
export const listUserJobs = (uid: string, limit = 20) => listByZset(KEYS.userJobs(uid), limit);

// Queued jobs leave the queue now; running jobs get a flag the worker checks
// between steps (it kills the spawned process).
export async function cancelJob(id: string): Promise<CareerOpsJob | null> {
  const r = redis();
  const job = await getJob(id);
  if (!job) return null;
  if (job.status === "queued") {
    await r.lrem(KEYS.queue, 0, id);
    await r.hset(KEYS.job(id), { status: "cancelled", cancel: 1, endedAt: Date.now() });
  } else if (job.status === "running") {
    await r.hset(KEYS.job(id), { cancel: 1 });
  }
  return getJob(id);
}

/** Position in the FIFO (0 = next up), or null when not queued. */
export async function queuePosition(id: string): Promise<number | null> {
  const ids = await redis().lrange<string>(KEYS.queue, 0, -1); // LPUSH/RPOP → the tail is next
  const i = ids.indexOf(id);
  return i === -1 ? null : ids.length - 1 - i;
}

// ---- quota (per member, per UTC day) ----
export async function bumpQuota(uid: string, now = Date.now(), kind = ""): Promise<number> {
  const r = redis();
  const key = KEYS.quota(uid, dayKey(now) + (kind ? `:${kind}` : ""));
  const n = await r.incr(key);
  if (n === 1) await r.expire(key, 2 * 86_400);
  return n;
}
export const getQuotaUsed = async (uid: string, now = Date.now(), kind = "") => (await redis().get<number>(KEYS.quota(uid, dayKey(now) + (kind ? `:${kind}` : "")))) ?? 0;

// ---- worker ----
export const getHeartbeat = async () => json<WorkerHeartbeat>(await redis().get<unknown>(KEYS.worker));
export const getWorkerState = async () => json<WorkerState>(await redis().get<unknown>(KEYS.state));
export const getQueueLength = () => redis().llen(KEYS.queue);

export async function getAgentsStatus(): Promise<AgentsStatus> {
  if (!isQueueConfigured()) return { configured: false, worker: null, online: false, state: null, queueLength: 0 };
  const [worker, state, queueLength] = await Promise.all([getHeartbeat(), getWorkerState(), getQueueLength()]);
  return { configured: true, worker, online: workerOnline(worker?.at), state, queueLength };
}
