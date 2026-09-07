import { NextRequest, NextResponse } from "next/server";
import { getCoachingScreenDoc, saveCoachingScreen } from "@/lib/server/coaching-screen";
import { normalizeCoachingScreen, validateCoachingScreen } from "@/lib/coaching-screen";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!idToken) return null;
  const { adminAuth } = await import("@/lib/firebase/admin");
  const decoded = await adminAuth().verifyIdToken(idToken);
  return decoded.admin === true ? decoded : null;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, doc: await getCoachingScreenDoc() });
}

// POST { action: "draft" | "publish", content }
// Drafts always save (so half-finished work isn't lost) but come back with their
// issues; publishing is refused with 400 while any blocking error remains.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = body.action === "publish" ? "publish" : "draft";
  const content = normalizeCoachingScreen(body.content);
  const { ok, errors, warnings } = validateCoachingScreen(content);
  if (action === "publish" && !ok) {
    return NextResponse.json({ ok: false, errors, warnings }, { status: 400 });
  }
  const doc = await saveCoachingScreen(action, content, admin.email ?? admin.uid);
  return NextResponse.json({ ok: true, doc, errors, warnings });
}
