import { NextRequest, NextResponse } from "next/server";
import { pgSelect, pgInsert, pgUpdate } from "@/lib/supabaseServer";
import { getEventConfig } from "@/lib/server/eventConfig";

export const runtime = "nodejs";

// Public endpoint — fired when someone submits their personal details, BEFORE the
// quiz questions. It (1) gates anyone who already completed the quiz or is already
// registered in Compass, and (2) records a QUIZ_START event into Supabase
// (separate from QUIZ_COMPLETE). Both honour the admin Event-tracking config.
//
// Body: { firstName, lastName, email }
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const firstName = (body?.firstName ?? "").trim();
  const lastName = (body?.lastName ?? "").trim();
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "valid email required" }, { status: 400 });
  }

  const events = await getEventConfig().catch(() => null);
  const completeTag = events?.QUIZ_COMPLETE?.tag ?? "EVENT->QUIZ_COMPLETE->TRACKER";
  const startSetting = events?.QUIZ_START;

  // ---- gate 1: already registered in Compass? ----
  let blocked: "registered" | "completed" | null = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
      const { adminAuth } = await import("@/lib/firebase/admin");
      await adminAuth().getUserByEmail(email); // throws if not found
      blocked = "registered";
    } catch { /* not found → not registered */ }
  }

  // ---- gate 2: already completed the quiz? ----
  if (!blocked) {
    try {
      const done = await pgSelect<{ id: string }>(
        "jobhackers_leads",
        { email: `eq.${email}`, tag: `eq.${completeTag}`, stage: "eq.acquisition" },
        "id"
      );
      if (done.length) blocked = "completed";
    } catch { /* on error, don't block */ }
  }

  if (blocked) return NextResponse.json({ ok: true, blocked: true, reason: blocked });

  // ---- record QUIZ_START (honours the toggle / renamable tag / stage) ----
  if (!startSetting || startSetting.enabled) {
    const tag = startSetting?.tag ?? "EVENT->QUIZ_START->TRACKER";
    const stage = startSetting?.stage ?? "acquisition";
    const row = {
      first_name: firstName || email.split("@")[0],
      last_name: lastName || null,
      email, stage, tag, source: "compass-quiz", score: 0,
    };
    try {
      const existing = await pgSelect<{ id: string }>(
        "jobhackers_leads",
        { email: `eq.${email}`, tag: `eq.${tag}`, stage: `eq.${stage}` },
        "id"
      );
      if (existing.length) await pgUpdate("jobhackers_leads", { id: `eq.${existing[0].id}` }, row);
      else await pgInsert("jobhackers_leads", row);
    } catch (err) {
      console.error("[quiz/start] event upsert failed:", err);
    }
  }

  return NextResponse.json({ ok: true, blocked: false });
}
