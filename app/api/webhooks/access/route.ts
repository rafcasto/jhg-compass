import { NextRequest, NextResponse } from "next/server";
import { createGrant } from "@/lib/server/grants";
import { sendPasswordEmail } from "@/lib/server/email";
import { logEvent, TAGS } from "@/lib/events";

export const runtime = "nodejs";

// Grants platform access on signup via lead magnet / payment page (req 6,7,8).
// Auth: send header `x-compass-secret: <COMPASS_WEBHOOK_SECRET>`.
//
// Body:
// {
//   "email": "user@x.com",          // required
//   "firstName": "Ada",
//   "durationDays": 90,             // length of access (default 90 = 3 months) [req 7]
//   "redeemHours": 48,              // optional: must redeem within N hours [req 8]
//   "source": "payment" | "lead_magnet",
//   "sendEmail": true               // email a set-password link via Resend
// }
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-compass-secret");
  if (!secret || secret !== process.env.COMPASS_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!body?.email) {
    return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
  }

  try {
    const { uid, grant } = await createGrant({
      email: body.email,
      firstName: body.firstName,
      plan: body.plan,
      durationDays: body.durationDays,
      redeemHours: body.redeemHours ?? null,
      source: body.source,
      webhookPayload: body,
    });

    if (body.sendEmail !== false) {
      try { await sendPasswordEmail(body.email, "set"); }
      catch (e) { console.error("password email failed:", e); }
    }

    await logEvent({
      firebaseUid: uid, email: body.email, stage: "activation",
      tag: TAGS.GRANT_CREATED, source: body.source ?? "tracker",
      props: { plan: grant.plan, durationDays: grant.durationDays, redeemBy: grant.redeemBy },
    });

    return NextResponse.json({ ok: true, uid, status: grant.status });
  } catch (e: any) {
    console.error("webhook/access error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "server error" }, { status: 500 });
  }
}
