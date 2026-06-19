import { NextRequest, NextResponse } from "next/server";
import { sendPasswordEmail } from "@/lib/server/email";
import { logEvent, TAGS } from "@/lib/events";

export const runtime = "nodejs";

// Sends a password reset email via Resend with admin-editable copy (req 10.1).
// Returns 200 regardless of whether the email exists (no account enumeration).
export async function POST(req: NextRequest) {
  let email: string | undefined;
  try { email = (await req.json())?.email; } catch { /* */ }
  if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });

  try {
    await sendPasswordEmail(email, "reset");
    await logEvent({ email, stage: "retention", tag: TAGS.PASSWORD_RESET });
  } catch (e) {
    console.error("request-reset:", e);
    // Surface a 500 so the client can fall back to Firebase's built-in email.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
