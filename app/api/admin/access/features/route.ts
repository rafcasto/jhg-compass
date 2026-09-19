import { NextRequest, NextResponse } from "next/server";
import { listGrants, setGrantFeatures } from "@/lib/server/grants";
import { requireAdmin } from "@/lib/server/auth";
import { logEvent, TAGS } from "@/lib/events";

export const runtime = "nodejs";

// Body: { uids: string[], careerOps: boolean } — switch the Agents tab on/off for one or many members.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const uids: string[] = Array.isArray(body.uids) ? body.uids.filter((u: unknown) => typeof u === "string") : [];
  if (!uids.length) return NextResponse.json({ ok: false, error: "no members selected" }, { status: 400 });
  if (typeof body.careerOps !== "boolean") return NextResponse.json({ ok: false, error: "careerOps must be a boolean" }, { status: 400 });

  const by = admin.email ?? admin.uid;
  const { updated, missing } = await setGrantFeatures(uids, { careerOps: body.careerOps }, by);
  await Promise.allSettled(updated.map((r) => logEvent({
    firebaseUid: r.uid, email: r.email, key: TAGS.AGENTS_TOGGLED, source: "admin",
    props: { careerOps: body.careerOps, by },
  })));
  return NextResponse.json({ ok: true, updated, missing, rows: await listGrants() });
}
