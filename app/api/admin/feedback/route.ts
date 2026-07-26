import { NextRequest, NextResponse } from "next/server";
import { getFeedbackConfig, saveFeedbackConfig, listFeedbackResponses } from "@/lib/server/feedback";

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
  const [config, responses] = await Promise.all([getFeedbackConfig(), listFeedbackResponses()]);
  return NextResponse.json({ ok: true, config, responses });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const patch = await req.json();
  await saveFeedbackConfig(patch, admin.uid);
  return NextResponse.json({ ok: true, config: await getFeedbackConfig() });
}
