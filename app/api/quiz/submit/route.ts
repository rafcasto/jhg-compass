import { NextRequest, NextResponse } from "next/server";
import { getFunnel } from "@/lib/server/funnel";
import { computeScore } from "@/lib/funnel-scoring";
import { pgSelect, pgInsert, pgUpdate } from "@/lib/supabaseServer";
import { getEventConfig } from "@/lib/server/eventConfig";

export const runtime = "nodejs";

// Public endpoint — a completed quiz captures one lead into Supabase
// (public.jobhackers_leads). This row IS the "quiz completed" event, and it
// honours the admin Event-tracking config: the QUIZ_COMPLETE event can be toggled
// off, its tag renamed, and its stage changed from the admin portal.
//
// Body: {
//   firstName, lastName, email,
//   answers: { q1..q5: optionId },   // selected choice option ids
//   otherText: { q1?, q3? },          // free text when "Something else" picked
//   q6Text?: string                   // optional open-ended answer
// }
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const firstName = (body?.firstName ?? "").trim();
  const lastName = (body?.lastName ?? "").trim();
  const email = (body?.email ?? "").trim().toLowerCase();
  const answers: Record<string, string> = body?.answers ?? {};
  const otherText: Record<string, string> = body?.otherText ?? {};
  const q6Text: string = (body?.q6Text ?? "").trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "valid email required" }, { status: 400 });
  }

  const funnel = await getFunnel();

  // Validate: every scored (choice) question must be answered, and a free-text
  // answer is required whenever an "isOther" option was selected.
  for (const q of funnel.quiz.questions) {
    if (q.kind !== "choice") continue;
    const optId = answers[q.id];
    if (!optId) {
      return NextResponse.json({ ok: false, error: `missing answer for ${q.id}` }, { status: 400 });
    }
    const opt = q.options?.find((o) => o.id === optId);
    if (opt?.isOther && q.allowOther && !(otherText[q.id] ?? "").trim()) {
      return NextResponse.json({ ok: false, error: `free text required for ${q.id}` }, { status: 400 });
    }
  }

  const score = computeScore(funnel, answers);

  // Resolve the QUIZ_COMPLETE event from the admin Event-tracking config:
  // an admin can disable it (skip capture) or rename its tag / change its stage.
  const events = await getEventConfig().catch(() => null);
  const setting = events?.QUIZ_COMPLETE;
  if (setting && !setting.enabled) {
    // Event switched off — don't record, but let the user continue to the invite.
    return NextResponse.json({ ok: true, captured: false, inviteUrl: funnel.inviteUrl });
  }

  const tag = setting?.tag ?? "EVENT->QUIZ_COMPLETE->TRACKER";
  const stage = setting?.stage ?? "acquisition";
  const source = "compass-quiz";

  const quizAnswers = {
    answers,
    otherText,
    q6: q6Text || null,
    flags: score.flags,
    heat: score.heat,
    fit: score.fit,
    readiness: score.readiness,
  };

  const row = {
    first_name: firstName || email.split("@")[0],
    last_name: lastName || null,
    email,
    archetype: score.archetype,
    score: score.readiness, // readiness (0–6) lives in `score`
    grade: score.grade,
    obstacle: score.obstacle,
    stage,
    tag,
    source,
    quiz_answers: quizAnswers,
  };

  try {
    // Upsert on (email, tag, stage) — a re-take updates the existing lead row.
    const existing = await pgSelect<{ id: string }>(
      "jobhackers_leads",
      { email: `eq.${email}`, tag: `eq.${tag}`, stage: `eq.${stage}` },
      "id"
    );
    if (existing.length) {
      await pgUpdate("jobhackers_leads", { id: `eq.${existing[0].id}` }, row);
    } else {
      await pgInsert("jobhackers_leads", row);
    }
  } catch (err) {
    console.error("[quiz/submit] lead capture failed:", err);
    return NextResponse.json({ ok: false, error: "capture failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, captured: true, inviteUrl: funnel.inviteUrl });
}
