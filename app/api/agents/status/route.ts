import { NextRequest, NextResponse } from "next/server";
import { requireAgentsMember } from "@/lib/server/auth";
import { getQueueLength, getHeartbeat, getQuotaUsed, getWorkerState, isQueueConfigured, listUserJobs } from "@/lib/careerops/queue";
import { workerOnline } from "@/lib/careerops/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Member → Agents: is the Pi there, how long is the line, what have I run.
// requireAgentsMember enforces the per-member flag on every call.
export async function GET(req: NextRequest) {
  const m = await requireAgentsMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  if (!isQueueConfigured()) return NextResponse.json({ ok: true, configured: false, online: false, queueLength: 0, quotaUsed: 0, jobs: [], vaultPublicKey: null });
  try {
    const [hb, queueLength, quotaUsed, jobs, state] = await Promise.all([getHeartbeat(), getQueueLength(), getQuotaUsed(m.user.uid), listUserJobs(m.user.uid), getWorkerState()]);
    // vaultPublicKey: the Pi's RSA public key so the browser can encrypt portal passwords for it (never a secret).
    return NextResponse.json({ ok: true, configured: true, online: workerOnline(hb?.at), queueLength, quotaUsed, jobs, vaultPublicKey: state?.vaultPublicKey ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "status failed" }, { status: 500 });
  }
}
