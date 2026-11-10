import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { getEngineConfig, saveEngineAgent, saveEngineLimits } from "@/lib/engine/config-server";
import { isEngineAgent, validateAgentPatch, validateLimitsPatch } from "@/lib/engine/config";
import { isClaudeConfigured } from "@/lib/engine/claude";
import { isQueueConfigured } from "@/lib/engine/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin → Claude → Settings: the whole config plus whether the two secrets are present.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, config: await getEngineConfig(), claude: isClaudeConfigured(), queue: isQueueConfigured() });
}

// Body: { agent, patch: { model?, effort?, maxTokens?, enabled? } }
//    or { limits: { monthlyBudgetUsd?, monthlyTurnQuota?, searchUsd?, prices? } }
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const by = admin.email ?? admin.uid;
  try {
    if (body.limits && typeof body.limits === "object") {
      const v = validateLimitsPatch(body.limits);
      if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
      await saveEngineLimits(v.patch, by);
    } else {
      if (!isEngineAgent(body.agent)) return NextResponse.json({ ok: false, error: "unknown agent" }, { status: 400 });
      const v = validateAgentPatch(body.patch);
      if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
      await saveEngineAgent(body.agent, v.patch, by);
    }
    return NextResponse.json({ ok: true, config: await getEngineConfig() });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "save failed" }, { status: 500 });
  }
}
