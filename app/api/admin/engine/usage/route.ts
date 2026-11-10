import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { listGrants } from "@/lib/server/grants";
import { getUsageMonths } from "@/lib/engine/usage-server";
import { monthKey } from "@/lib/engine/keys";
import { memberName } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH = /^\d{4}-\d{2}$/;

// Admin → Claude → Usage: every member's meter for one month (?month=2026-11, default this one).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  const q = req.nextUrl.searchParams.get("month");
  const month = q && MONTH.test(q) ? q : monthKey();
  const grants = await listGrants();
  const months = await getUsageMonths(grants.map((g) => g.uid), month);
  const rows = grants
    .filter((g) => months[g.uid])
    .map((g) => ({ uid: g.uid, email: g.email, name: memberName(g), coach: g.coach === true, ...months[g.uid] }))
    .sort((a, b) => b.estimatedUsd - a.estimatedUsd);
  const total = rows.reduce((acc, r) => ({ turns: acc.turns + r.turns, estimatedUsd: acc.estimatedUsd + r.estimatedUsd, input: acc.input + r.input, cacheRead: acc.cacheRead + r.cacheRead, output: acc.output + r.output, searches: acc.searches + r.searches }), { turns: 0, estimatedUsd: 0, input: 0, cacheRead: 0, output: 0, searches: 0 });
  return NextResponse.json({ ok: true, month, rows, total, members: grants.length, enabled: grants.filter((g) => g.coach).length });
}
