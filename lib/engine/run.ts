import "server-only";
import { getEngineConfig } from "./config-server";
import type { EngineConfig } from "./config";
import { finishUnit, getJob, isCancelled, logLine, patchJob } from "./jobs-server";
import { runnable, type EngineJob } from "./jobs";
import { ENGINE_JOB_AGENT, isEngineJobType, type EngineAgent, type EngineJobType } from "./keys";
import type { TokenUsage } from "./pricing";
import { recordUsage } from "./usage-server";
import type { RunMessage } from "./queue";

// One unit of work, end to end (docs/CAREER_OPS_CLAUDE.md §2): load the job, mark it
// running, run the handler, land the result — on the job itself, or on its parent's
// unit counter. Called by /api/engine/run (QStash) and, without a queue, inline.

export interface RunContext {
  job: EngineJob;
  uid: string;
  unit: Record<string, unknown> | null;
  config: EngineConfig;
  /** The agent this job runs on, with its model and effort — undefined for a job with no model. */
  agent: EngineAgent | undefined;
  log: (line: string) => Promise<void>;
  progress: (text: string) => Promise<void>;
  cancelled: () => Promise<boolean>;
  /** Adds one Claude call to the member's month and the job's own counter. */
  meter: (model: string, usage: TokenUsage) => Promise<number>;
}

export type Handler = (ctx: RunContext) => Promise<unknown>;

// ping — the smoke test: queue → run → Firestore, no model.
const ping: Handler = async ({ log, progress, unit }) => {
  await progress("pong");
  await log(`pong${unit ? ` · unit ${JSON.stringify(unit)}` : ""}`);
  return { pong: true, at: Date.now() };
};

export const HANDLERS: Record<EngineJobType, Handler> = { ping };

export async function runUnit(msg: RunMessage): Promise<{ ran: boolean; status: string }> {
  const { uid, jobId } = msg;
  const job = await getJob(uid, jobId);
  if (!job) return { ran: false, status: "missing" };
  if (!runnable(job)) return { ran: false, status: job.status };
  if (!isEngineJobType(job.type)) { await patchJob(uid, jobId, { status: "failed", error: `unknown job type ${job.type}`, endedAt: Date.now() }); return { ran: false, status: "failed" }; }

  const config = await getEngineConfig();
  const agent = ENGINE_JOB_AGENT[job.type];
  if (agent && !config.agents[agent].enabled) { await patchJob(uid, jobId, { status: "failed", error: `The ${agent} agent is switched off by the admin`, endedAt: Date.now() }); return { ran: false, status: "failed" }; }

  const now = Date.now();
  if (job.status === "queued") await patchJob(uid, jobId, { status: "running", startedAt: now });
  let jobUsage = job.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0, estimatedUsd: 0 };

  const ctx: RunContext = {
    job, uid, unit: msg.unit ?? null, config, agent,
    log: (line) => logLine(uid, jobId, `${new Date().toISOString().slice(11, 19)} ${line}`),
    progress: (text) => patchJob(uid, jobId, { progress: text }),
    cancelled: () => isCancelled(uid, jobId),
    meter: async (model, usage) => {
      const { estimatedUsd } = await recordUsage(uid, { kind: "job", key: job.type, model, usage }, config);
      jobUsage = { input: jobUsage.input + usage.input, output: jobUsage.output + usage.output, cacheRead: jobUsage.cacheRead + usage.cacheRead, cacheWrite: jobUsage.cacheWrite + usage.cacheWrite, searches: jobUsage.searches + usage.searches, estimatedUsd: Math.round((jobUsage.estimatedUsd + estimatedUsd) * 1e6) / 1e6 };
      await patchJob(uid, jobId, { usage: jobUsage });
      return estimatedUsd;
    },
  };

  try {
    const result = await HANDLERS[job.type](ctx);
    if (await ctx.cancelled()) { await patchJob(uid, jobId, { status: "cancelled", endedAt: Date.now(), progress: "cancelled" }); return { ran: true, status: "cancelled" }; }
    if (job.units) { await finishUnit(uid, jobId, true); return { ran: true, status: "unit done" }; }
    await patchJob(uid, jobId, { status: "done", endedAt: Date.now(), progress: "done", result: result ?? null });
    return { ran: true, status: "done" };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await ctx.log(`ERROR ${message}`);
    if (job.units) { await finishUnit(uid, jobId, false); return { ran: true, status: "unit failed" }; }
    await patchJob(uid, jobId, { status: (await ctx.cancelled()) ? "cancelled" : "failed", endedAt: Date.now(), error: message });
    return { ran: true, status: "failed" };
  }
}
