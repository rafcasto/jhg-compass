import { NextRequest, NextResponse } from "next/server";
import { getFunnel } from "@/lib/server/funnel";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!idToken) return null;
  const { adminAuth } = await import("@/lib/firebase/admin");
  const decoded = await adminAuth().verifyIdToken(idToken);
  return decoded.admin === true ? decoded : null;
}

function sb() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  return { url: `${url}/rest/v1`, headers: { apikey: key!, Authorization: `Bearer ${key}` } as Record<string, string> };
}

// Scope to Compass quiz leads only (same convention as /api/admin/stats).
const COMPASS_TAG = `tag=like.${encodeURIComponent("EVENT->*")}`;

type Lead = {
  first_name: string | null;
  last_name: string | null;
  email: string;
  archetype: string | null;
  score: number | null; // readiness 0–6
  grade: string | null;
  obstacle: string | null;
  created_at: string | null;
  quiz_answers: any;
};

function inc(map: Record<string, number>, key: string, by = 1) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + by;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const { url, headers } = sb();

  // Pull every Compass lead with its raw quiz payload.
  let leads: Lead[] = [];
  try {
    leads = await (await fetch(
      `${url}/jobhackers_leads?select=first_name,last_name,email,archetype,score,grade,obstacle,created_at,quiz_answers&${COMPASS_TAG}&order=created_at.desc&limit=5000`,
      { headers, cache: "no-store" }
    )).json();
    if (!Array.isArray(leads)) leads = [];
  } catch {
    leads = [];
  }

  const funnel = await getFunnel().catch(() => null);

  // Build id → label lookups for every choice question, so answers render as
  // human text rather than raw option ids.
  const questions = (funnel?.quiz?.questions ?? []).filter((q) => q.kind === "choice");
  const labelFor = (qid: string, oid: string) => {
    const q = questions.find((x) => x.id === qid);
    return q?.options?.find((o) => o.id === oid)?.label ?? oid;
  };

  // ---- Per-question answer distributions (preserves option order) ----
  const questionBreakdowns = questions.map((q) => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      const oid = lead.quiz_answers?.answers?.[q.id];
      if (oid) inc(counts, labelFor(q.id, oid));
    }
    // keep the funnel's option order; append any unknown answers at the end
    const ordered = (q.options ?? []).map((o) => ({ label: o.label, count: counts[o.label] ?? 0 }));
    for (const [label, count] of Object.entries(counts)) {
      if (!ordered.some((r) => r.label === label)) ordered.push({ label, count });
    }
    return { id: q.id, prompt: q.prompt, options: ordered };
  });

  // ---- Single-dimension distributions ----
  const archetype: Record<string, number> = {};
  const grade: Record<string, number> = {};
  const fit: Record<string, number> = {};
  const readiness: Record<string, number> = {};
  const flags: Record<string, number> = {};
  const obstacle: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const openResponses: { name: string; email: string; q6: string; other: Record<string, string>; created_at: string | null }[] = [];

  for (const lead of leads) {
    inc(archetype, lead.archetype ?? "Unclassified");
    inc(grade, lead.grade ?? "—");
    inc(obstacle, lead.obstacle ?? "—");

    const qa = lead.quiz_answers ?? {};
    inc(fit, qa.fit ?? "—");
    if (typeof lead.score === "number") inc(readiness, String(lead.score));
    for (const fl of qa.flags ?? []) inc(flags, fl);

    if (lead.created_at) {
      const day = lead.created_at.slice(0, 10);
      inc(byDay, day);
    }

    const q6 = (qa.q6 ?? "").trim();
    const other = qa.otherText ?? {};
    const hasOther = Object.values(other).some((v) => (v as string)?.trim());
    if (q6 || hasOther) {
      openResponses.push({
        name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—",
        email: lead.email,
        q6,
        other,
        created_at: lead.created_at,
      });
    }
  }

  const timeseries = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));

  const toRows = (m: Record<string, number>) =>
    Object.entries(m).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  // readiness sorted numerically 0..6
  const readinessRows = Object.entries(readiness)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => Number(a.label) - Number(b.label));

  return NextResponse.json({
    ok: true,
    total: leads.length,
    questionBreakdowns,
    archetype: toRows(archetype),
    grade: toRows(grade),
    fit: toRows(fit),
    readiness: readinessRows,
    flags: toRows(flags),
    obstacle: toRows(obstacle),
    timeseries,
    openResponses: openResponses.slice(0, 200),
  });
}
