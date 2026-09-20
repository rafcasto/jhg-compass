import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { getAgentsConfig, saveAgentSettings, saveGlobalSettings, type GlobalSettingsPatch } from "@/lib/server/agents-config";
import { isAgentKey, validateAgentPatch, validateQuota, LIMITS } from "@/lib/careerops/config-validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin → Agents → Models: the whole config (prompts included — the Prompts tab reuses it).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, config: await getAgentsConfig() });
}

// Body: { agent, patch: { model?, numCtx?, numPredict?, temperature?, enabled? } }
//    or { global: { dailyEvalQuota?, dailyScanQuota?, collectLiveData? } }
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const by = admin.email ?? admin.uid;
  try {
    if (body.global && typeof body.global === "object") {
      const g: GlobalSettingsPatch = {};
      for (const key of ["dailyEvalQuota", "dailyScanQuota"] as const) {
        if (!(key in body.global)) continue;
        const q = validateQuota(body.global[key], key);
        if (q === null) return NextResponse.json({ ok: false, error: `${key} must be ${LIMITS[key].min}–${LIMITS[key].max}` }, { status: 400 });
        g[key] = q;
      }
      if ("collectLiveData" in body.global) {
        if (typeof body.global.collectLiveData !== "boolean") return NextResponse.json({ ok: false, error: "collectLiveData must be a boolean" }, { status: 400 });
        g.collectLiveData = body.global.collectLiveData;
      }
      if (!Object.keys(g).length) return NextResponse.json({ ok: false, error: "nothing to change" }, { status: 400 });
      await saveGlobalSettings(g, by);
    } else {
      const agent: unknown = body.agent;
      if (!isAgentKey(agent)) return NextResponse.json({ ok: false, error: "unknown agent" }, { status: 400 });
      const v = validateAgentPatch(body.patch);
      if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
      await saveAgentSettings(agent, v.patch, by);
    }
    return NextResponse.json({ ok: true, config: await getAgentsConfig() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "save failed" }, { status: 500 });
  }
}
