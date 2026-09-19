import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { getAgentDefaults, getAgentsConfig, listPromptVersions, savePrompt } from "@/lib/server/agents-config";
import { isAgentKey, validatePrompt } from "@/lib/careerops/config-validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ?agent=evaluator → current prompt, its versions, and the worker default.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  const agent = req.nextUrl.searchParams.get("agent");
  if (!isAgentKey(agent)) return NextResponse.json({ ok: false, error: "unknown agent" }, { status: 400 });
  const [cfg, versions, defaults] = await Promise.all([getAgentsConfig(), listPromptVersions(agent), getAgentDefaults()]);
  return NextResponse.json({ ok: true, current: cfg.agents[agent], versions, defaultPrompt: defaults[agent]?.systemPrompt ?? null });
}

// Body: { agent, systemPrompt, note? } — saves a new version (restore = save an old text again).
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const agent: unknown = body.agent;
  if (!isAgentKey(agent)) return NextResponse.json({ ok: false, error: "unknown agent" }, { status: 400 });
  const v = validatePrompt(body.systemPrompt);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : "";
  try {
    const { version } = await savePrompt(agent, v.prompt, admin.email ?? admin.uid, note);
    const [cfg, versions] = await Promise.all([getAgentsConfig(), listPromptVersions(agent)]);
    return NextResponse.json({ ok: true, version, current: cfg.agents[agent], versions });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "save failed" }, { status: 500 });
  }
}
