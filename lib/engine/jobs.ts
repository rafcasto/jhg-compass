// The job document — users/{uid}/engineJobs/{id} (docs/CAREER_OPS_CLAUDE.md §1).
// Replaces, for this engine, the Pi's Redis hash: created by the jobs route, run by
// the QStash-called run route one unit at a time, read live by the portal. Pure
// shapes and reducers here; the Firestore side is jobs-server.ts. Tested.

import { isTerminal, type EngineJobStatus, type EngineJobType } from "./keys";
import type { TokenUsage } from "./pricing";

export interface JobUnits { total: number; done: number; failed: number }

export interface EngineJob {
  id: string;
  uid: string;
  type: EngineJobType;
  status: EngineJobStatus;
  payload: Record<string, unknown>;
  createdAt: number;
  createdBy: string;
  startedAt?: number;
  endedAt?: number;
  /** One line for the member: what is happening now. */
  progress?: string;
  /** The tail of the run log, admin-only in the API. */
  log?: string;
  result?: unknown;
  error?: string;
  /** Set by cancel; a running unit checks it between steps. */
  cancel?: boolean;
  /** A parent of several units (a scan's companies, a batch's postings). Absent on a single-unit job. */
  units?: JobUnits;
  usage?: TokenUsage & { estimatedUsd: number };
}

/** What the member's own API returns: no log, no payload. */
export type EngineJobView = Omit<EngineJob, "log" | "payload">;
export const jobView = ({ log: _l, payload: _p, ...rest }: EngineJob): EngineJobView => rest;

export const LOG_TAIL_BYTES = 16_000;

/** The log with one more line, trimmed from the front to the tail size. */
export function appendLogTail(log: string | undefined, line: string, max = LOG_TAIL_BYTES): string {
  const next = `${log ?? ""}${line}\n`;
  return next.length > max ? next.slice(next.length - max) : next;
}

/** A parent job after one of its units lands. `finished` when the last one has. */
export function unitLanded(units: JobUnits, ok: boolean): { units: JobUnits; finished: boolean } {
  const next = { ...units, done: units.done + (ok ? 1 : 0), failed: units.failed + (ok ? 0 : 1) };
  return { units: next, finished: next.done + next.failed >= next.total };
}

/** The status a finished parent ends in: failed only when every unit failed; done otherwise (the log says which). */
export const parentStatus = (units: JobUnits): EngineJobStatus => (units.total > 0 && units.failed >= units.total ? "failed" : "done");

/** Whether a unit should still run — not cancelled, not already over. */
export const runnable = (job: Pick<EngineJob, "status" | "cancel">) => !job.cancel && !isTerminal(job.status);

/** A stored document read as a job; a document without the required fields is null. */
export function readJob(raw: Partial<EngineJob> | null | undefined, id: string): EngineJob | null {
  if (!raw || typeof raw.uid !== "string" || typeof raw.type !== "string") return null;
  return {
    id, uid: raw.uid, type: raw.type,
    status: raw.status ?? "queued",
    payload: raw.payload ?? {},
    createdAt: raw.createdAt ?? 0, createdBy: raw.createdBy ?? "",
    ...(raw.startedAt != null ? { startedAt: raw.startedAt } : {}),
    ...(raw.endedAt != null ? { endedAt: raw.endedAt } : {}),
    ...(raw.progress != null ? { progress: raw.progress } : {}),
    ...(raw.log != null ? { log: raw.log } : {}),
    ...(raw.result !== undefined ? { result: raw.result } : {}),
    ...(raw.error != null ? { error: raw.error } : {}),
    ...(raw.cancel ? { cancel: true } : {}),
    ...(raw.units ? { units: raw.units } : {}),
    ...(raw.usage ? { usage: raw.usage } : {}),
  };
}
