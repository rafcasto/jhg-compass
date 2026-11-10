import { NextRequest, NextResponse } from "next/server";
import { requireEngineMember } from "@/lib/server/auth";
import { cancelJob, getJob } from "@/lib/engine/jobs-server";
import { jobView } from "@/lib/engine/jobs";
import { JOB_ID_RE } from "@/lib/engine/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The member's own job — status, progress, result. The portal normally reads the
// document live; this is for a client without a Firestore listener. Logs stay admin-only.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  if (!JOB_ID_RE.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  const job = await getJob(m.user.uid, params.id);
  if (!job) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, job: jobView(job) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  if (!JOB_ID_RE.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  const job = await cancelJob(m.user.uid, params.id);
  if (!job) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, job: jobView(job) });
}
