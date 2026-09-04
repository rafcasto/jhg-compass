import { NextRequest, NextResponse } from "next/server";
import { getArticles } from "@/lib/server/articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Member-facing: the curated Compass reading rail. Requires a signed-in user;
// the Ghost key never leaves the server.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!idToken) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const articles = await getArticles();
  return NextResponse.json(
    { ok: true, articles },
    { headers: { "cache-control": "private, max-age=300" } }
  );
}
