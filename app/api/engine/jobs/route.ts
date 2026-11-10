import { NextRequest, NextResponse } from "next/server";
import { requireEngineMember } from "@/lib/server/auth";
import { createJob, listUserJobs, patchJob } from "@/lib/engine/jobs-server";
import { jobView } from "@/lib/engine/jobs";
import { isEngineJobType } from "@/lib/engine/keys";
import { isQueueConfigured, publishRun } from "@/lib/engine/queue";
import { runUnit } from "@/lib/engine/run";
import { getEngineConfig } from "@/lib/engine/config-server";
import { getUsageMonth } from "@/lib/engine/usage-server";
import { quotaCheck, quotaLine } from "@/lib/engine/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Without a queue (local dev) a job runs inline here; with one, this route only publishes.
export const maxDuration = 120;

// The member's recent engine jobs.
export async function GET(req: NextRequest) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  try { return NextResponse.json({ ok: true, jobs: (await listUserJobs(m.user.uid)).map(jobView) }); }
  catch (e: unknown) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "list failed" }, { status: 500 }); }
}

// Body: { type: EngineJobType, ...payload }. Creates the job document and hands it to
// QStash (docs/CAREER_OPS_CLAUDE.md §2). Units of a fan-out job are published by the
// job's own handler; this route publishes the job itself.
export async function POST(req: NextRequest) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const type: unknown = body?.type;
  if (!isEngineJobType(type)) return NextResponse.json({ ok: false, error: "unknown job type" }, { status: 400 });
  const uid = m.user.uid;

  // The monthly limit (admins are never limited).
  if (m.user.admin !== true) {
    const [cfg, usage] = await Promise.all([getEngineConfig(), getUsageMonth(uid)]);
    const q = quotaCheck(usage, cfg);
    if (q.over) return NextResponse.json({ ok: false, error: quotaLine(q), quota: q.reason }, { status: 429 });
  }

  const { type: _t, ...payload } = body as Record<string, unknown>;
  try {
    const job = await createJob({ uid, type, payload, createdBy: m.user.email ?? uid });
    if (isQueueConfigured()) {
      try { await publishRun({ uid, jobId: job.id, type }); }
      catch (e: unknown) {
        const message = e instanceof Error ? e.message : "publish failed";
        await patchJob(uid, job.id, { status: "failed", error: `could not queue: ${message}`, endedAt: Date.now() });
        return NextResponse.json({ ok: false, error: message }, { status: 503 });
      }
    } else {
      await runUnit({ uid, jobId: job.id, type });
    }
    return NextResponse.json({ ok: true, job: jobView(job), inline: !isQueueConfigured() });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "create failed" }, { status: 500 });
  }
}
