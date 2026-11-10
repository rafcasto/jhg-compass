import { NextRequest, NextResponse } from "next/server";
import { parseRunMessage, verifyRun } from "@/lib/engine/queue";
import { runUnit } from "@/lib/engine/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One unit of work per call (docs/CAREER_OPS_CLAUDE.md §2): a Claude call and its
// writes, or a PDF render. Pro's plain limit is 300 s; nothing here needs more.
export const maxDuration = 120;

// QStash calls this with one RunMessage, signed. A 2xx acknowledges the message;
// anything else makes QStash retry, so a job that must not run twice answers 200
// and says why in the body.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!(await verifyRun(req.headers.get("upstash-signature"), raw))) return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "bad body" }, { status: 200 }); }
  const msg = parseRunMessage(parsed);
  if (!msg) return NextResponse.json({ ok: false, error: "bad message" }, { status: 200 });
  try {
    const r = await runUnit(msg);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: unknown) {
    // runUnit records the failure on the job; a throw here is infrastructure (Firestore down) — let QStash retry.
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "run failed" }, { status: 500 });
  }
}
