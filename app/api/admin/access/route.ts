import { NextRequest, NextResponse } from "next/server";
import { listGrants, renewGrants } from "@/lib/server/grants";
import { logEvent, TAGS } from "@/lib/events";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!idToken) return null;
  const { adminAuth } = await import("@/lib/firebase/admin");
  const decoded = await adminAuth().verifyIdToken(idToken);
  return decoded.admin === true ? decoded : null;
}

// Admin → TOFU → Access renewals: every member's grant with its effective status.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, rows: await listGrants() });
}

// Body: { uids: string[], durationDays: number } — re-grant access to one or many.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const uids: string[] = Array.isArray(body.uids) ? body.uids.filter((u: unknown) => typeof u === "string") : [];
  const days = Math.round(Number(body.durationDays));
  if (!uids.length) return NextResponse.json({ ok: false, error: "no members selected" }, { status: 400 });
  if (!Number.isFinite(days) || days < 1 || days > 3650) return NextResponse.json({ ok: false, error: "durationDays must be 1–3650" }, { status: 400 });

  const { renewed, missing } = await renewGrants(uids, days, admin.email ?? admin.uid);
  await Promise.allSettled(renewed.map((r) => logEvent({
    firebaseUid: r.uid, email: r.email, stage: "activation", key: TAGS.GRANT_RENEWED, source: "admin",
    props: { durationDays: days, expiresAt: r.expiresAt, by: admin.email ?? admin.uid },
  })));
  return NextResponse.json({ ok: true, renewed, missing, rows: await listGrants() });
}
