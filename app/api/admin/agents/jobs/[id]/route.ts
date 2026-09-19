import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { cancelJob, getJob } from "@/lib/careerops/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[0-9T]{15}-[0-9a-f]{8}$/;

// One job with its log tail and result.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ID.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  try {
    const job = await getJob(params.id);
    return job ? NextResponse.json({ ok: true, job }) : NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "get failed" }, { status: 500 });
  }
}

// Cancel: queued → removed now; running → flag the worker honours between steps.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ID.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  try {
    const job = await cancelJob(params.id);
    return job ? NextResponse.json({ ok: true, job }) : NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "cancel failed" }, { status: 500 });
  }
}
