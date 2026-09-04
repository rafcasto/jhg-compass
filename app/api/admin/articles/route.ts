import { NextRequest, NextResponse } from "next/server";
import { getArticlesConfig, saveArticlesConfig } from "@/lib/server/articles";
import { fetchAllPostSummaries, fetchPublicTags } from "@/lib/server/ghost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!idToken) return null;
  const { adminAuth } = await import("@/lib/firebase/admin");
  const decoded = await adminAuth().verifyIdToken(idToken);
  return decoded.admin === true ? decoded : null;
}

// GET: current curation config + everything the picker needs (tags, posts).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const [config, tags, posts] = await Promise.all([getArticlesConfig(), fetchPublicTags(), fetchAllPostSummaries()]);
  return NextResponse.json({
    ok: true,
    config,
    ghostConfigured: !!(process.env.GHOST_CONTENT_API_URL && process.env.GHOST_CONTENT_API_KEY),
    tags: tags.map((t) => ({ slug: t.slug, name: t.name })),
    posts,
  });
}

// POST: save { mode, tag, postIds, limit }.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const config = await saveArticlesConfig(body, admin.uid);
  return NextResponse.json({ ok: true, config });
}
