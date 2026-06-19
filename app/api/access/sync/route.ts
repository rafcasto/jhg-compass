import { NextRequest, NextResponse } from "next/server";
import { syncGrant } from "@/lib/server/grants";
import { logEvent, TAGS } from "@/lib/events";

export const runtime = "nodejs";

// Called by the app after login. Redeems pending grants within their window (req 8)
// and expires elapsed ones (req 9). Trusted writer — verifies the Firebase ID token.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!idToken) return NextResponse.json({ ok: false, error: "no token" }, { status: 401 });

  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    const decoded = await adminAuth().verifyIdToken(idToken);
    const before = decoded;
    const grant = await syncGrant(decoded.uid);

    if (grant?.status === "active" && grant.startsAt && Date.now() - grant.startsAt < 5000) {
      await logEvent({ firebaseUid: decoded.uid, email: before.email, stage: "activation", key: TAGS.GRANT_REDEEMED });
    }
    return NextResponse.json({ ok: true, status: grant?.status ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "server error" }, { status: 500 });
  }
}
