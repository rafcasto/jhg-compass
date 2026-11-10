import { NextRequest, NextResponse } from "next/server";
import { listGrants, setGrantFeatures } from "@/lib/server/grants";
import { requireAdmin } from "@/lib/server/auth";
import { logEvent, TAGS } from "@/lib/events";

export const runtime = "nodejs";

// Body: { uids: string[], careerOps?: boolean, jobHacking?: boolean, coach?: boolean } — switch a
// portal (or the coach) on/off for one or many members. At least one flag must be given.
const FLAGS = ["careerOps", "jobHacking", "coach"] as const;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const uids: string[] = Array.isArray(body.uids) ? body.uids.filter((u: unknown) => typeof u === "string") : [];
  if (!uids.length) return NextResponse.json({ ok: false, error: "no members selected" }, { status: 400 });
  const features: { careerOps?: boolean; jobHacking?: boolean; coach?: boolean } = {};
  for (const f of FLAGS) {
    if (body[f] === undefined) continue;
    if (typeof body[f] !== "boolean") return NextResponse.json({ ok: false, error: `${f} must be a boolean` }, { status: 400 });
    features[f] = body[f];
  }
  if (!Object.keys(features).length) return NextResponse.json({ ok: false, error: "careerOps, jobHacking or coach must be given" }, { status: 400 });

  const by = admin.email ?? admin.uid;
  const { updated, missing } = await setGrantFeatures(uids, features, by);
  await Promise.allSettled(updated.map((r) => logEvent({
    firebaseUid: r.uid, email: r.email, key: TAGS.AGENTS_TOGGLED, source: "admin",
    props: { ...features, by },
  })));
  return NextResponse.json({ ok: true, updated, missing, rows: await listGrants() });
}
