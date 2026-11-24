import { NextRequest, NextResponse } from "next/server";
import { requireEngineMember } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { applyCoachPatch, CoachWriteError } from "@/lib/engine/coach/write";
import { createJob, listUserJobs, patchJob } from "@/lib/engine/jobs-server";
import { ENGINE_JOB_LABELS } from "@/lib/engine/keys";
import { isQueueConfigured, publishRun } from "@/lib/engine/queue";
import { runUnit } from "@/lib/engine/run";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { ProfilePortal } from "@/lib/jobhacking/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Target companies, page-first (docs/UX_JOBHACKING.md §3b, decision 2026-11-17): the member sources and prunes the 40 on the
// page; the coach converses about the result. Two actions, both through the coach's own write path and job:
//   { action: "source", names?: string[] } — the companies job (the boards' APIs), once per ten minutes unless it names companies
//   { action: "remove", name }            — the company leaves jhg.targetCompanies.companies; the lists re-derive (lib/engine/coach/lists.ts)
const COOLDOWN_MS = 10 * 60_000;
const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 80)).slice(0, max) : []);

export async function POST(req: NextRequest) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  const uid = m.user.uid;
  const body = await req.json().catch(() => ({}));
  const portal: ProfilePortal = body?.portal === "compass" ? "compass" : "jobhacking";

  if (body?.action === "source") {
    const names = strings(body.names, 10);
    const jobs = (await listUserJobs(uid, 10)).filter((j) => j.type === "companies");
    const running = jobs.find((j) => j.status === "queued" || j.status === "running");
    if (running) return NextResponse.json({ ok: false, error: "Already sourcing — give it a minute.", jobId: running.id }, { status: 409 });
    const recent = jobs.find((j) => j.status === "done" && Date.now() - (j.endedAt ?? 0) < COOLDOWN_MS);
    if (recent && !names.length) return NextResponse.json({ ok: false, error: `Sourced ${Math.max(1, Math.round((Date.now() - (recent.endedAt ?? 0)) / 60_000))} minutes ago — the result is on the page. Add a company by name, or run it again in ${Math.max(1, Math.ceil((COOLDOWN_MS - (Date.now() - (recent.endedAt ?? 0))) / 60_000))} min.` }, { status: 429 });
    try {
      const job = await createJob({ uid, type: "companies", payload: { portal, coach: "targetCompanies", ...(names.length ? { names } : {}) }, createdBy: `page:${m.user.email ?? uid}` });
      if (isQueueConfigured()) {
        try { await publishRun({ uid, jobId: job.id, type: "companies" }); }
        catch (e: unknown) { const message = e instanceof Error ? e.message : "publish failed"; await patchJob(uid, job.id, { status: "failed", error: `could not queue: ${message}`, endedAt: Date.now() }); return NextResponse.json({ ok: false, error: message }, { status: 503 }); }
      } else void runUnit({ uid, jobId: job.id, type: "companies" }).catch(() => patchJob(uid, job.id, { status: "failed", error: "inline run failed", endedAt: Date.now() }));
      return NextResponse.json({ ok: true, job: { id: job.id, type: job.type, label: ENGINE_JOB_LABELS.companies } });
    } catch (e: unknown) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "could not start" }, { status: 500 });
    }
  }

  if (body?.action === "remove") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "which company?" }, { status: 400 });
    const setup = (await adminDb().doc(`users/${uid}/careerOps/setup`).get()).data() as CareerOpsSetupV2 | undefined;
    const companies = setup?.jhg?.targetCompanies?.companies ?? [];
    const left = companies.filter((c) => c.name?.trim().toLowerCase() !== name.toLowerCase());
    if (left.length === companies.length) return NextResponse.json({ ok: false, error: `${name} is not on the list.` }, { status: 404 });
    try {
      // The list is taken whole on a write; ranks are the portal's (rankCompanies) and the page's lists re-derive.
      await applyCoachPatch({ uid, coach: "targetCompanies", patch: { jhg: { targetCompanies: { companies: left.map(({ rank: _r, ...c }) => c) } } }, portal });
      return NextResponse.json({ ok: true, removed: name, count: left.length });
    } catch (e: unknown) {
      return NextResponse.json({ ok: false, error: e instanceof CoachWriteError ? e.message : e instanceof Error ? e.message : "write failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
