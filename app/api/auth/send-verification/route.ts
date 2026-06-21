import { NextRequest, NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/server/email";

export const runtime = "nodejs";

// Sends an email-verification link (via Resend) to the signed-in user's email.
// Auth: Bearer Firebase ID token. Returns 200 even when already verified.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!idToken) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    const decoded = await adminAuth().verifyIdToken(idToken);
    const email = decoded.email;
    if (!email) return NextResponse.json({ ok: false, error: "no_email" }, { status: 400 });
    if (decoded.email_verified) return NextResponse.json({ ok: true, alreadyVerified: true });

    await sendVerificationEmail(email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("send-verification:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
