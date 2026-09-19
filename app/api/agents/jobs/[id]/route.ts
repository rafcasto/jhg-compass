import { NextRequest, NextResponse } from "next/server";
import { requireAgentsMember } from "@/lib/server/auth";
import { cancelJob, getJob, queuePosition } from "@/lib/careerops/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[0-9T]{15}-[0-9a-f]{8}$/;

// The member's own job: status, progress, queue position. Logs stay admin-only.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await requireAgentsMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ID.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  try {
    const job = await getJob(params.id);
    if (!job || job.uid !== m.user.uid) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    const position = job.status === "queued" ? await queuePosition(job.id) : null;
    return NextResponse.json({ ok: true, job: { ...job, log: undefined, payload: undefined }, position });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "get failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await requireAgentsMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ID.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  try {
    const job = await getJob(params.id);
    if (!job || job.uid !== m.user.uid) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    const next = await cancelJob(job.id);
    return NextResponse.json({ ok: true, job: next ? { ...next, log: undefined, payload: undefined } : null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "cancel failed" }, { status: 500 });
  }
}
