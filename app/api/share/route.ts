import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { createShare, revokeShare } from "@/lib/server/shares";
import { isSharePage, type SharePageKey } from "@/lib/jobhacking/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Share links — docs/UX_SHARE.md. The signed-in member switches one of their
// own pages on (POST) or off (DELETE); the token itself is minted here, never
// in the browser. Body: { page: "narrative" | "true-north" | "companies" | "artefacts" }.

async function pageOf(req: NextRequest): Promise<SharePageKey | null> {
  const body = await req.json().catch(() => ({}));
  return isSharePage(body?.page) ? body.page : null;
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const page = await pageOf(req);
  if (!page) return NextResponse.json({ ok: false, error: "page must be one of the four JobHacking pages" }, { status: 400 });
  const record = await createShare(user.uid, page);
  return NextResponse.json({ ok: true, ...record });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const page = await pageOf(req);
  if (!page) return NextResponse.json({ ok: false, error: "page must be one of the four JobHacking pages" }, { status: 400 });
  await revokeShare(user.uid, page);
  return NextResponse.json({ ok: true });
}
