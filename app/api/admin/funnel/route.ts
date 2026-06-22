import { NextRequest, NextResponse } from "next/server";
import { getFunnel, saveFunnel } from "@/lib/server/funnel";

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
  return NextResponse.json({ ok: true, funnel: await getFunnel() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body?.funnel) return NextResponse.json({ ok: false, error: "funnel required" }, { status: 400 });
  await saveFunnel(body.funnel, admin.uid);
  return NextResponse.json({ ok: true, funnel: await getFunnel() });
}
