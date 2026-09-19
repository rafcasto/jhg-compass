import { NextRequest, NextResponse } from "next/server";
import { requireAgentsMember } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { fetchDriveFile } from "@/lib/server/google-drive";
import type { CareerOpsDoc } from "@/lib/careerops/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams a member's own generated PDF back to them, wherever the worker put it.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await requireAgentsMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  if (!/^[0-9T]{15}-[0-9a-z]{8}$/.test(params.id)) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  const snap = await adminDb().doc(`users/${m.user.uid}/careerOpsDocs/${params.id}`).get();
  if (!snap.exists) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const d = snap.data() as CareerOpsDoc & { pdfBase64?: string };
  const headers = { "content-type": "application/pdf", "content-disposition": `attachment; filename="${d.file.replace(/[^A-Za-z0-9._-]/g, "_")}"`, "cache-control": "private, max-age=0" };
  try {
    if (d.storage === "drive" && d.driveFileId) {
      const r = await fetchDriveFile(d.driveFileId);
      if (!r.ok) return NextResponse.json({ ok: false, error: `Drive returned ${r.status}` }, { status: 502 });
      return new NextResponse(r.body, { headers });
    }
    if (d.storage === "bucket" && d.url) return NextResponse.redirect(d.url, 302);
    if (d.storage === "inline" && d.pdfBase64) return new NextResponse(Buffer.from(d.pdfBase64, "base64"), { headers });
    return NextResponse.json({ ok: false, error: "file unavailable" }, { status: 410 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "download failed" }, { status: 500 });
  }
}
