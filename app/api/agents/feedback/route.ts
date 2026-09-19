import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireAgentsMember } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { getAgentsConfig } from "@/lib/server/agents-config";
import { pseudonymise } from "@/lib/careerops/pseudonymise";
import type { CareerOpsReport, CareerOpsSetup } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Body: { reportJobId, verdict: "up" | "down", note? }
// Records the member's verdict on a report. When the admin has switched on
// "Collect training data from live users", a 👍 report is copied — pseudonymised —
// into trainingExamples (unapproved; the admin reviews it before it can be used).
export async function POST(req: NextRequest) {
  const m = await requireAgentsMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const reportJobId = typeof body.reportJobId === "string" ? body.reportJobId : "";
  if (!/^[0-9T]{15}-[0-9a-z]{8}$/.test(reportJobId)) return NextResponse.json({ ok: false, error: "reportJobId missing" }, { status: 400 });
  if (body.verdict !== "up" && body.verdict !== "down") return NextResponse.json({ ok: false, error: "verdict must be up or down" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";
  const db = adminDb();
  const uid = m.user.uid;
  const ref = db.doc(`users/${uid}/careerOpsReports/${reportJobId}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ ok: false, error: "report not found" }, { status: 404 });
  const report = snap.data() as CareerOpsReport & { jd?: string; feedback?: unknown };
  await ref.set({ feedback: { verdict: body.verdict, note, at: Date.now() } }, { merge: true });

  let collected = false;
  if (body.verdict === "up" && report.jd && report.summaryFound) {
    const cfg = await getAgentsConfig();
    if (cfg.collectLiveData) {
      const [setupSnap, profSnap] = await Promise.all([db.doc(`users/${uid}/careerOps/setup`).get(), db.doc(`users/${uid}`).get()]);
      const setup = setupSnap.data() as CareerOpsSetup | undefined;
      const prof = profSnap.data() as Profile | undefined;
      if (setup?.cvMarkdown) {
        const ident = { name: [prof?.firstName, prof?.lastName].filter(Boolean).join(" "), email: prof?.email ?? m.user.email ?? "" };
        const cv = pseudonymise(setup.cvMarkdown, ident);
        const jd = report.jd;
        const id = createHash("sha1").update(jd.trim() + "\n---\n" + cv.trim()).digest("hex").slice(0, 20);
        await db.doc(`trainingExamples/${id}`).set({
          id, agent: "evaluator", source: "live", split: "train", approved: false,
          company: report.company, role: report.role, notes: note,
          cv, profileYaml: pseudonymise(setup.profileYaml ?? "", ident), jd, report: pseudonymise(report.markdown, ident),
          summary: { company: report.company, role: report.role, score: report.score, archetype: report.archetype, legitimacy: report.legitimacy },
          teacherModel: report.model, studentPromptVersion: report.promptVersion, memberUid: uid, createdAt: Date.now(), createdBy: "member-feedback", jobId: reportJobId,
        }, { merge: true });
        collected = true;
      }
    }
  }
  return NextResponse.json({ ok: true, collected });
}
