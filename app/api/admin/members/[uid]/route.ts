import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { deleteMember, memberDataSummary } from "@/lib/server/member-data";

export const runtime = "nodejs";

const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;

// GET: what this member has stored — the counts the confirm dialog quotes.
export async function GET(req: NextRequest, { params }: { params: { uid: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  if (!UID_RE.test(params.uid)) return NextResponse.json({ ok: false, error: "bad uid" }, { status: 400 });
  return NextResponse.json({ ok: true, summary: await memberDataSummary(params.uid) });
}

// DELETE: the member, whole — data, grant, share links and the sign-in. Body: { email } must match the account's.
export async function DELETE(req: NextRequest, { params }: { params: { uid: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  if (!UID_RE.test(params.uid)) return NextResponse.json({ ok: false, error: "bad uid" }, { status: 400 });
  if (params.uid === admin.uid) return NextResponse.json({ ok: false, error: "you can't delete your own account from here" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const summary = await memberDataSummary(params.uid);
  if (!summary.hasAccount && !summary.hasGrant && !summary.hasAuthUser) return NextResponse.json({ ok: false, error: "no such member" }, { status: 404 });
  const typed = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!summary.email || typed !== summary.email.toLowerCase()) return NextResponse.json({ ok: false, error: "the email typed does not match the member's" }, { status: 400 });
  const result = await deleteMember(params.uid, admin.email ?? admin.uid);
  return NextResponse.json({ ok: true, result });
}
