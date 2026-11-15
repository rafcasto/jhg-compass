import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { isResetScope } from "@/lib/member-data";
import { memberDataSummary, resetMemberData } from "@/lib/server/member-data";

export const runtime = "nodejs";

const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;

// POST: { scope: "coach" | "all" } — clear the member's data, keep the grant and the sign-in.
export async function POST(req: NextRequest, { params }: { params: { uid: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  if (!UID_RE.test(params.uid)) return NextResponse.json({ ok: false, error: "bad uid" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  if (!isResetScope(body?.scope)) return NextResponse.json({ ok: false, error: "scope must be coach or all" }, { status: 400 });
  const result = await resetMemberData(params.uid, body.scope, admin.email ?? admin.uid);
  return NextResponse.json({ ok: true, result, summary: await memberDataSummary(params.uid) });
}
