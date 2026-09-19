import { NextRequest, NextResponse } from "next/server";
import { requireAgentsMember } from "@/lib/server/auth";
import { bumpQuota, enqueueJob, getQuotaUsed, listUserJobs, QueueNotConfigured } from "@/lib/careerops/queue";
import { getAgentsConfig } from "@/lib/server/agents-config";
import { logEvent, TAGS } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_JD = 40_000;

export async function GET(req: NextRequest) {
  const m = await requireAgentsMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  try { return NextResponse.json({ ok: true, jobs: await listUserJobs(m.user.uid) }); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e?.message ?? "list failed" }, { status: e instanceof QueueNotConfigured ? 503 : 500 }); }
}

// Body: { type: "evaluate", jd?: string, url?: string }  (phase 1: evaluate only)
export async function POST(req: NextRequest) {
  const m = await requireAgentsMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.type !== "evaluate") return NextResponse.json({ ok: false, error: "only evaluate is available right now" }, { status: 400 });

  const jd = typeof body.jd === "string" ? body.jd.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!jd && !url) return NextResponse.json({ ok: false, error: "paste a job description or a URL" }, { status: 400 });
  if (jd.length > MAX_JD) return NextResponse.json({ ok: false, error: `job description too long (max ${MAX_JD} characters)` }, { status: 400 });
  if (url) { try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { return NextResponse.json({ ok: false, error: "that doesn't look like a valid http(s) URL" }, { status: 400 }); } }

  try {
    const cfg = await getAgentsConfig();
    const used = await getQuotaUsed(m.user.uid);
    if (used >= cfg.dailyEvalQuota) return NextResponse.json({ ok: false, error: `daily limit reached (${cfg.dailyEvalQuota} evaluations) — try again tomorrow` }, { status: 429 });
    await bumpQuota(m.user.uid);
    const job = await enqueueJob({ type: "evaluate", uid: m.user.uid, payload: { ...(jd ? { jd } : {}), ...(url ? { url } : {}) }, createdBy: m.user.email ?? m.user.uid });
    logEvent({ firebaseUid: m.user.uid, email: m.user.email, key: TAGS.AGENT_JOB_QUEUED, source: "agents", props: { type: "evaluate", jobId: job.id, hasUrl: !!url } }).catch(() => {});
    return NextResponse.json({ ok: true, job, quotaUsed: used + 1, quota: cfg.dailyEvalQuota });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "could not queue the job" }, { status: e instanceof QueueNotConfigured ? 503 : 500 });
  }
}
