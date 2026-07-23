import { NextRequest, NextResponse } from "next/server";
import { completeRegistration } from "@/lib/server/registration";
import { enrollInCompassSequence } from "@/lib/server/kit";
import { logEvent, TAGS } from "@/lib/events";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, email, password, firstName, lastName } = body ?? {};
  if (!token || !email || !password) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
  }

  const result = await completeRegistration(token, email, password, firstName, lastName);
  if (!result.ok) {
    const status = result.error === "expired" || result.error === "used" ? 410 : 400;
    return NextResponse.json(result, { status });
  }

  await logEvent({
    firebaseUid: result.uid, email, firstName, lastName, stage: "activation",
    key: TAGS.REGISTRATION, source: "registration_link",
  });
  await logEvent({
    firebaseUid: result.uid, email, stage: "activation",
    key: TAGS.GRANT_CREATED, source: "registration_link",
  });

  // Enroll the new registrant into the Compass onboarding email sequence.
  // Best-effort side effect: a Kit failure must never fail the registration
  // (the user already has an account + access at this point).
  const kit = await enrollInCompassSequence(email, firstName);
  if (!kit.ok && !kit.skipped) {
    console.error(`[register] Kit enrollment failed for ${email}: ${kit.error}`);
  }

  return NextResponse.json({ ok: true });
}
