import { NextRequest, NextResponse } from "next/server";
import { requireEngineMember } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { profileFromSetup } from "@/lib/careerops/profile-file";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import { applyCoachPatch, CoachWriteError } from "@/lib/engine/coach/write";
import { isCoachKey } from "@/lib/engine/coach/keys";
import { findStep, scriptFor, validateStep, type StepValues } from "@/lib/engine/coach/script";
import type { ProfilePortal } from "@/lib/jobhacking/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The scripted coach's write (docs/UX_SCRIPTED_COACH.md §2; decision C). One step's answer — or its skip — goes down the
// exact path the model's update_profile takes: the step builds the patch from the member's values and the stored profile,
// `applyCoachPatch` validates, merges key by key, derives and checks. The route never writes a key a step does not name.
//   { coach, step, values, portal }        — the answer
//   { coach, step, skip: true, portal }    — *I don't know yet*, the step's own skip values
export async function POST(req: NextRequest) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  const uid = m.user.uid;
  const body = await req.json().catch(() => ({}));
  const portal: ProfilePortal = body?.portal === "compass" ? "compass" : "jobhacking";
  const script = isCoachKey(body?.coach) ? scriptFor(body.coach) : null;
  if (!script) return NextResponse.json({ ok: false, error: "no script for that coach" }, { status: 400 });
  const step = typeof body?.step === "string" ? findStep(script, body.step) : undefined;
  if (!step) return NextResponse.json({ ok: false, error: "unknown step" }, { status: 400 });
  if (step.kind === "job") return NextResponse.json({ ok: false, error: "a job step is started through /api/engine/jobs" }, { status: 400 });

  const db = adminDb();
  const [profileSnap, setupSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/careerOps/setup`).get()]);
  const profile = profileFromSetup({ profile: profileSnap.exists ? (profileSnap.data() as Profile) : null, setup: setupSnap.exists ? (setupSnap.data() as CareerOpsSetupV2) : null });

  const skip = body?.skip === true;
  if (skip && !step.skipValues) return NextResponse.json({ ok: false, error: "this step needs an answer" }, { status: 400 });
  const values: StepValues = skip ? step.skipValues! : (body?.values && typeof body.values === "object" && !Array.isArray(body.values) ? body.values : {});
  if (!skip && step.kind !== "review") {
    const problems = validateStep(step, values, profile);
    if (Object.keys(problems).length) return NextResponse.json({ ok: false, error: Object.values(problems)[0], problems }, { status: 400 });
  }

  const patch = step.patch(values, profile);
  // A skip with nothing to write (the schema prunes empty answers) still counts: the next step's answer marks it.
  if (!Object.keys(patch).length && !step.progress) return NextResponse.json({ ok: true, skipped: true });
  try {
    const r = await applyCoachPatch({ uid, coach: script.coach, patch, ...(step.progress ? { progress: step.progress } : {}), portal });
    return NextResponse.json({ ok: true, note: r.note, warnings: r.warnings, progress: r.progress });
  } catch (e: unknown) {
    const message = e instanceof CoachWriteError ? e.message : e instanceof Error ? e.message : "write failed";
    return NextResponse.json({ ok: false, error: message, details: e instanceof CoachWriteError ? e.details : [] }, { status: 500 });
  }
}
