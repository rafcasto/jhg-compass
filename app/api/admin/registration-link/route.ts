import { NextRequest, NextResponse } from "next/server";
import { createRegistrationLink, listRegistrationLinks } from "@/lib/server/registration";

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
  return NextResponse.json({ ok: true, links: await listRegistrationLinks() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const link = await createRegistrationLink(admin.uid, {
    expiryHours: Number(body.expiryHours) || 48,
    accessDurationDays: Number(body.accessDurationDays) || 90,
    maxUses: Number(body.maxUses) || 1,
    email: body.email || null,
  });
  return NextResponse.json({ ok: true, link });
}
