import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { enqueueJob, listJobs, QueueNotConfigured } from "@/lib/careerops/queue";
import { isAdminJobType } from "@/lib/careerops/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recent runs (all members), newest first, without logs.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));
    return NextResponse.json({ ok: true, jobs: await listJobs(limit) });
  } catch (e: any) {
    const status = e instanceof QueueNotConfigured ? 503 : 500;
    return NextResponse.json({ ok: false, error: e?.message ?? "list failed" }, { status });
  }
}

// Body: { type: AdminJobType, payload?: object } — training / model jobs only.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!isAdminJobType(body.type)) return NextResponse.json({ ok: false, error: "unknown admin job type" }, { status: 400 });
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
  try {
    const job = await enqueueJob({ type: body.type, uid: admin.uid, payload, createdBy: admin.email ?? admin.uid });
    return NextResponse.json({ ok: true, job });
  } catch (e: any) {
    const status = e instanceof QueueNotConfigured ? 503 : 500;
    return NextResponse.json({ ok: false, error: e?.message ?? "enqueue failed" }, { status });
  }
}
