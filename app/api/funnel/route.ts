import { NextResponse } from "next/server";
import { getFunnel } from "@/lib/server/funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always return the latest saved config

// Public read of the funnel config (server-side via the Admin SDK) so the public
// landing / quiz / thank-you pages reflect admin edits even if the client-side
// Firestore read rule for config/funnel isn't deployed. No auth required — the
// funnel config is public marketing content only.
export async function GET() {
  try {
    return NextResponse.json({ ok: true, funnel: await getFunnel() });
  } catch (e) {
    console.error("[api/funnel] read failed:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
