import { NextRequest, NextResponse } from "next/server";
import { logEvent, type EventStage } from "@/lib/events";
import { EVENT_KEYS, type EventKey } from "@/lib/tags";

export const runtime = "nodejs";

// Client posts an event KEY here; server resolves config + writes to Supabase.
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const event = body?.event as EventKey;
  if (!event || !EVENT_KEYS.includes(event)) {
    return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
  }

  let firebaseUid: string | null = body.uid ?? null;
  let email: string | null = body.email ?? null;
  if (body.idToken && process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
      const { adminAuth } = await import("@/lib/firebase/admin");
      const decoded = await adminAuth().verifyIdToken(body.idToken);
      firebaseUid = decoded.uid;
      email = decoded.email ?? email;
    } catch { /* fall back to client-supplied identity */ }
  }

  await logEvent({
    key: event,
    firebaseUid,
    email,
    stage: body.stage as EventStage | undefined,
    source: body.source ?? "tracker",
    props: body.props,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
