import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ID = /^[a-f0-9]{20}$/;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ID.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  const snap = await adminDb().doc(`trainingExamples/${params.id}`).get();
  return snap.exists ? NextResponse.json({ ok: true, example: snap.data() }) : NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
}

// Body: { approved: boolean } — approve / reject an example for datasets.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ID.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.approved !== "boolean") return NextResponse.json({ ok: false, error: "approved must be a boolean" }, { status: 400 });
  await adminDb().doc(`trainingExamples/${params.id}`).set({ approved: body.approved, reviewedBy: admin.email ?? admin.uid, reviewedAt: Date.now() }, { merge: true });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  if (!ID.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  await adminDb().doc(`trainingExamples/${params.id}`).delete();
  return NextResponse.json({ ok: true });
}
