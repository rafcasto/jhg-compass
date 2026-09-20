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

// Body (member jobs — see lib/careerops/keys.ts MEMBER_JOB_TYPES):
//   { type: "evaluate", jd?, url?, pipelineId?, autoPipeline? }      { type: "scan" }
//   { type: "pdf" | "cover", reportJobId, template?, angle? }
//   { type: "deep", company, website?, reportJobId? }                 { type: "advise", kind: training|project, title, description, … }
//   { type: "contacto", reportJobId, target, personName?, personRole? }
//   { type: "apply", reportJobId, questions[] }                       { type: "interview_prep", reportJobId, audience, extra? }
//   { type: "followup", opportunityId, company, role, stage, daysSince, channel, lastNote?, reportJobId? }
//   { type: "patterns" }
// Every LLM job shares the daily quota (dailyEvalQuota); scan is zero-token and capped
// separately by dailyScanQuota — both are set in Admin → CareerOps → Models.
const JOB_ID = /^[0-9T]{15}-[0-9a-z]{8}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], dflt: T): T => (list as readonly string[]).includes(v as string) ? (v as T) : dflt;
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
    payload = { ...(jd ? { jd } : {}), ...(url ? { url } : {}), ...(pipelineId ? { pipelineId } : {}), ...(body.autoPipeline === true ? { autoPipeline: true } : {}) };
  } else if (type === "pdf" || type === "cover") {
    const reportJobId = typeof body.reportJobId === "string" ? body.reportJobId : "";
    if (!JOB_ID.test(reportJobId)) return NextResponse.json({ ok: false, error: "reportJobId missing" }, { status: 400 });
    payload = { reportJobId };
    if (type === "pdf" && typeof body.template === "string" && CV_TEMPLATES.includes(body.template)) payload.template = body.template;
    if (type === "cover" && typeof body.angle === "string" && body.angle.trim()) payload.angle = body.angle.trim().slice(0, 1500);
  } else if (type === "scan") {
    payload = {};
  } else if (type === "deep") {
    const company = str(body.company, 120);
    if (!company) return NextResponse.json({ ok: false, error: "company missing" }, { status: 400 });
    const website = str(body.website, 300);
    if (website) { try { const u = new URL(website); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { return NextResponse.json({ ok: false, error: "website must be an http(s) URL" }, { status: 400 }); } }
    const reportJobId = JOB_ID.test(String(body.reportJobId ?? "")) ? String(body.reportJobId) : "";
    payload = { company, ...(website ? { website } : {}), ...(reportJobId ? { reportJobId } : {}) };
  } else if (type === "advise") {
    const kind = oneOf(body.kind, ["training", "project"] as const, "training");
    const title = str(body.title, 160), description = str(body.description, 4000);
    if (!title || !description) return NextResponse.json({ ok: false, error: "title and description are required" }, { status: 400 });
    payload = { kind, title, description, provider: str(body.provider, 160), url: str(body.url, 300), cost: str(body.cost, 40), effort: str(body.effort, 60) };
  } else if (type === "contacto") {
    const reportJobId = str(body.reportJobId, 40);
    if (!JOB_ID.test(reportJobId)) return NextResponse.json({ ok: false, error: "reportJobId missing" }, { status: 400 });
    payload = { reportJobId, target: oneOf(body.target, ["hiring_manager", "recruiter", "peer", "interviewer"] as const, "hiring_manager"), personName: str(body.personName, 120), personRole: str(body.personRole, 120) };
  } else if (type === "apply") {
    const reportJobId = str(body.reportJobId, 40);
    if (!JOB_ID.test(reportJobId)) return NextResponse.json({ ok: false, error: "reportJobId missing" }, { status: 400 });
    const questions = Array.isArray(body.questions) ? body.questions.map((q: unknown) => str(q, 600)).filter(Boolean).slice(0, 25) : [];
    if (!questions.length) return NextResponse.json({ ok: false, error: "paste at least one question" }, { status: 400 });
    payload = { reportJobId, questions };
  } else if (type === "interview_prep") {
    const reportJobId = str(body.reportJobId, 40);
    if (!JOB_ID.test(reportJobId)) return NextResponse.json({ ok: false, error: "reportJobId missing" }, { status: 400 });
    payload = { reportJobId, audience: oneOf(body.audience, ["recruiter", "hiring_manager", "peer", "panel"] as const, "recruiter"), extra: str(body.extra, 2000) };
  } else if (type === "followup") {
    const company = str(body.company, 120);
    if (!company) return NextResponse.json({ ok: false, error: "company missing" }, { status: 400 });
    const reportJobId = JOB_ID.test(String(body.reportJobId ?? "")) ? String(body.reportJobId) : "";
    payload = {
      opportunityId: str(body.opportunityId, 40), company, role: str(body.role, 160), stage: str(body.stage, 60),
      daysSince: Math.max(0, Math.min(365, Math.round(Number(body.daysSince) || 0))), channel: oneOf(body.channel, ["email", "linkedin"] as const, "email"),
      lastNote: str(body.lastNote, 600), ...(reportJobId ? { reportJobId } : {}),
    };
  } else if (type === "patterns") {
    payload = {};
  } else {
    return NextResponse.json({ ok: false, error: "unknown job type" }, { status: 400 });
  }

  try {
    const cfg = await getAgentsConfig();
    let used = 0, quota = cfg.dailyEvalQuota;
    if (type === "scan") {
      quota = cfg.dailyScanQuota;
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
