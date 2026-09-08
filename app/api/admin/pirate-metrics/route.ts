import { NextRequest, NextResponse } from "next/server";
import { getEventConfig } from "@/lib/server/eventConfig";
import { PIRATE_STAGES, isEventStage, type EventStage } from "@/lib/tags";
import { gaServiceAccountEmail, gaUsesFirebaseAccount, getAwarenessReport, type AwarenessResult } from "@/lib/server/ga4";

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

// Same scoping rule as /api/admin/stats — Compass events only.
const COMPASS_TAG = `tag=like.${encodeURIComponent("EVENT->*")}`;

type Row = { email: string; tag: string; stage: string | null; source: string | null; score: number | null; created_at: string | null };

export interface PirateStageRollup {
  stage: EventStage;
  label: string;
  /** Distinct people who fired at least one event in this stage. */
  people: number;
  /** Total event rows (repeats bump `score`, so this is the sum of scores). */
  events: number;
  byEvent: { key: string; label: string; tag: string; people: number; events: number; enabled: boolean }[];
}

// The three layers the dashboard stitches together:
//   FO — Google Analytics (awareness: sessions / sources / countries) — needs GA4 creds
//   MO — the event configurator (which tag lands in which AAARRR stage)
//   BO — Supabase jobhackers_leads (the actual event rows)
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 28));
  const { url, headers } = sb();

  // BO (Supabase) and FO (Google Analytics) are independent — fetch both at once.
  const [rowsRaw, gaResult] = await Promise.all([
    fetch(`${url}/jobhackers_leads?select=email,tag,stage,source,score,created_at&${COMPASS_TAG}&order=created_at.desc&limit=10000`, { headers, cache: "no-store" })
      .then((r) => r.json()).catch(() => []),
    getAwarenessReport(days),
  ]);
  const rows: Row[] = Array.isArray(rowsRaw) ? rowsRaw : [];

  const config = await getEventConfig(true);

  // Resolve each row to the event key it belongs to (by current tag) and the
  // stage the CONFIGURATOR says it belongs to. Falls back to the stage stamped on
  // the row for tags that are no longer configured.
  const byTag = new Map<string, { key: string; stage: EventStage; label: string; enabled: boolean }>();
  for (const [key, s] of Object.entries(config)) byTag.set(s.tag, { key, stage: s.stage, label: s.label, enabled: s.enabled });

  const stagePeople = new Map<EventStage, Set<string>>();
  const stageEvents = new Map<EventStage, number>();
  const eventPeople = new Map<string, Set<string>>();
  const eventCount = new Map<string, number>();
  const sources = new Map<string, number>();
  const byDay = new Map<string, Record<string, number>>();

  for (const r of rows) {
    const meta = byTag.get(r.tag);
    const stage: EventStage = meta?.stage ?? (isEventStage(r.stage) ? r.stage : "retention");
    const eventKey = meta?.key ?? r.tag;
    const n = Math.max(1, r.score ?? 1);

    if (!stagePeople.has(stage)) stagePeople.set(stage, new Set());
    stagePeople.get(stage)!.add(r.email);
    stageEvents.set(stage, (stageEvents.get(stage) ?? 0) + n);

    if (!eventPeople.has(eventKey)) eventPeople.set(eventKey, new Set());
    eventPeople.get(eventKey)!.add(r.email);
    eventCount.set(eventKey, (eventCount.get(eventKey) ?? 0) + n);

    sources.set(r.source ?? "—", (sources.get(r.source ?? "—") ?? 0) + n);

    if (r.created_at) {
      const day = r.created_at.slice(0, 10);
      const d = byDay.get(day) ?? {};
      d[stage] = (d[stage] ?? 0) + n;
      byDay.set(day, d);
    }
  }

  const stages: PirateStageRollup[] = PIRATE_STAGES.map((s) => {
    const byEvent = Object.entries(config)
      .filter(([, cfg]) => cfg.stage === s.key)
      .map(([key, cfg]) => ({
        key, label: cfg.label, tag: cfg.tag, enabled: cfg.enabled,
        people: eventPeople.get(key)?.size ?? 0,
        events: eventCount.get(key) ?? 0,
      }))
      .sort((a, b) => b.people - a.people);
    return {
      stage: s.key, label: s.label,
      people: stagePeople.get(s.key)?.size ?? 0,
      events: stageEvents.get(s.key) ?? 0,
      byEvent,
    };
  });

  const timeseries = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));

  // FO layer — Google Analytics (awareness). Awareness "people" = GA users.
  const ga: AwarenessResult & { usesFirebaseAccount: boolean; serviceAccountEmail: string | null; measurementId: string | null } = {
    ...(gaResult as AwarenessResult),
    usesFirebaseAccount: gaUsesFirebaseAccount(),
    serviceAccountEmail: gaServiceAccountEmail(),
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? null,
  };
  const awareness = stages.find((s) => s.stage === "awareness");
  if (awareness && ga.configured && ga.ok) { awareness.people = ga.report.totals.users; awareness.events = ga.report.totals.sessions; }

  return NextResponse.json({
    ok: true,
    days,
    totalPeople: new Set(rows.map((r) => r.email)).size,
    totalEvents: rows.reduce((s, r) => s + Math.max(1, r.score ?? 1), 0),
    stages,
    sources: [...sources.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    timeseries,
    ga,
    supabase: { table: "jobhackers_leads", scope: "tag LIKE 'EVENT->%'", rows: rows.length },
  });
}
