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

// Body: { type: "evaluate", jd?, url?, pipelineId? } | { type: "pdf" | "cover", reportJobId, template?, angle? } | { type: "scan" }
// evaluate / pdf / cover share the daily LLM quota; scan is zero-token but capped separately.
const SCANS_PER_DAY = 6;
const JOB_ID = /^[0-9T]{15}-[0-9a-z]{8}$/;
const CV_TEMPLATES = ["cv-template.html", "cv-template.modern.html", "cv-template.compact.html", "cv-template.executive.html", "cv-template.leadership.html", "cv-template.jake.html"];

export async function POST(req: NextRequest) {
  const m = await requireAgentsMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const type: unknown = body.type;
  let payload: Record<string, unknown> = {};

  if (type === "evaluate") {
    const jd = typeof body.jd === "string" ? body.jd.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!jd && !url) return NextResponse.json({ ok: false, error: "paste a job description or a URL" }, { status: 400 });
    if (jd.length > MAX_JD) return NextResponse.json({ ok: false, error: `job description too long (max ${MAX_JD} characters)` }, { status: 400 });
    if (url) { try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { return NextResponse.json({ ok: false, error: "that doesn't look like a valid http(s) URL" }, { status: 400 }); } }
    const pipelineId = typeof body.pipelineId === "string" && /^[a-f0-9]{20}$/.test(body.pipelineId) ? body.pipelineId : undefined;
    payload = { ...(jd ? { jd } : {}), ...(url ? { url } : {}), ...(pipelineId ? { pipelineId } : {}) };
  } else if (type === "pdf" || type === "cover") {
    const reportJobId = typeof body.reportJobId === "string" ? body.reportJobId : "";
    if (!JOB_ID.test(reportJobId)) return NextResponse.json({ ok: false, error: "reportJobId missing" }, { status: 400 });
    payload = { reportJobId };
    if (type === "pdf" && typeof body.template === "string" && CV_TEMPLATES.includes(body.template)) payload.template = body.template;
    if (type === "cover" && typeof body.angle === "string" && body.angle.trim()) payload.angle = body.angle.trim().slice(0, 1500);
  } else if (type === "scan") {
    payload = {};
  } else {
    return NextResponse.json({ ok: false, error: "unknown job type" }, { status: 400 });
  }

  try {
    const cfg = await getAgentsConfig();
    let used = 0, quota = cfg.dailyEvalQuota;
    if (type === "scan") {
      quota = SCANS_PER_DAY;
      used = await getQuotaUsed(m.user.uid, Date.now(), "scan");
      if (used >= quota) return NextResponse.json({ ok: false, error: `daily limit reached (${quota} scans) — try again tomorrow` }, { status: 429 });
      await bumpQuota(m.user.uid, Date.now(), "scan");
    } else {
      used = await getQuotaUsed(m.user.uid);
      if (used >= quota) return NextResponse.json({ ok: false, error: `daily limit reached (${quota} agent runs) — try again tomorrow` }, { status: 429 });
      await bumpQuota(m.user.uid);
    }
    const job = await enqueueJob({ type, uid: m.user.uid, payload, createdBy: m.user.email ?? m.user.uid });
    logEvent({ firebaseUid: m.user.uid, email: m.user.email, key: TAGS.AGENT_JOB_QUEUED, source: "agents", props: { type, jobId: job.id } }).catch(() => {});
    return NextResponse.json({ ok: true, job, quotaUsed: used + 1, quota });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "could not queue the job" }, { status: e instanceof QueueNotConfigured ? 503 : 500 });
  }
}
