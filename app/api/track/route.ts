import { NextRequest, NextResponse } from "next/server";
import { logEvent, type EventStage } from "@/lib/events";

export const runtime = "nodejs";

// Client posts events here; we write them to Supabase server-side.
// Optionally verifies a Firebase ID token to bind uid/email trustworthily.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const { tag, stage, source, props, idToken } = body ?? {};
  if (!tag || typeof tag !== "string") {
    return NextResponse.json({ ok: false, error: "tag required" }, { status: 400 });
  }

  let firebaseUid: string | null = body.uid ?? null;
  let email: string | null = body.email ?? null;

  // Trust the token over client-supplied identity when the Admin SDK is configured.
  if (idToken && process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
      const { adminAuth } = await import("@/lib/firebase/admin");
      const decoded = await adminAuth().verifyIdToken(idToken);
      firebaseUid = decoded.uid;
      email = decoded.email ?? email;
    } catch {
      /* fall back to client-supplied fields */
    }
  }

  await logEvent({
    firebaseUid,
    email,
    stage: (stage as EventStage) ?? "retention",
    tag,
    source: source ?? "tracker",
    props,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
