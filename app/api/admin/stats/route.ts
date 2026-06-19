import { NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req).catch(() => null);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const { adminAuth } = await import("@/lib/firebase/admin");
  const { adminDb } = await import("@/lib/firebase/admin");
  const { url, headers } = sb();

  // ---- Supabase: total events + recent rows ----
  let eventsTotal = 0;
  let recent: any[] = [];
  try {
    const countRes = await fetch(`${url}/jobhackers_leads?select=id`, {
      headers: { ...headers, Prefer: "count=exact", Range: "0-0" }, cache: "no-store",
    });
    const cr = countRes.headers.get("content-range"); // "0-0/123"
    eventsTotal = cr ? Number(cr.split("/")[1]) || 0 : 0;
    recent = await (await fetch(
      `${url}/jobhackers_leads?select=first_name,email,stage,tag,source,score,created_at&order=created_at.desc&limit=12`,
      { headers, cache: "no-store" }
    )).json();
  } catch { /* leave defaults */ }

  // ---- Firebase: users count ----
  let users = 0;
  try {
    let next: string | undefined;
    do {
      const page = await adminAuth().listUsers(1000, next);
      users += page.users.length;
      next = page.pageToken;
    } while (next);
  } catch { /* */ }

  // ---- Firestore: active grants + active registration links ----
  let activeGrants = 0, activeLinks = 0;
  try { activeGrants = (await adminDb().collection("accessGrants").where("status", "==", "active").get()).size; } catch { /* */ }
  try { activeLinks = (await adminDb().collection("registrationLinks").where("status", "==", "active").get()).size; } catch { /* */ }

  return NextResponse.json({ ok: true, users, eventsTotal, activeGrants, activeLinks, recent });
}
