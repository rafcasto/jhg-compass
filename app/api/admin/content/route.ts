import { NextRequest, NextResponse } from "next/server";
import { getContent, saveContent } from "@/lib/server/content";
import { normalizeStages } from "@/lib/stages";

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
  return NextResponse.json({ ok: true, content: await getContent() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const content = { ...(body.content ?? {}) };
  // Stages are sent on their own by the Stages tab; sanitise before persisting.
  if ("stages" in content) content.stages = normalizeStages(content.stages);
  await saveContent(content, admin.uid);
  return NextResponse.json({ ok: true, content: await getContent() });
}
