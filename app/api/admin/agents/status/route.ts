import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { getAgentsStatus } from "@/lib/careerops/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin → Agents → Overview: worker heartbeat, published state, queue length.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await getAgentsStatus()) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "status failed" }, { status: 500 });
  }
}
