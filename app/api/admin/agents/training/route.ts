import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import type { TrainingDataset, TrainingExampleRow, TrainingModel } from "@/lib/careerops/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin → Agents → Training: examples (without the big text fields), datasets, models.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ ok: false }, { status: 403 });
  const db = adminDb();
  const [ex, ds, md] = await Promise.all([
    db.collection("trainingExamples").select("id", "agent", "source", "split", "approved", "company", "role", "market", "intendedFit", "notes", "summary", "teacherModel", "studentPromptVersion", "memberUid", "createdAt", "createdBy", "jobId").get(),
    db.collection("trainingDatasets").get(),
    db.collection("trainingModels").get(),
  ]);
  const examples = ex.docs.map((d) => d.data() as TrainingExampleRow).sort((a, b) => b.createdAt - a.createdAt);
  const datasets = ds.docs.map((d) => d.data() as TrainingDataset).sort((a, b) => b.builtAt - a.builtAt);
  const models = md.docs.map((d) => { const m = d.data() as TrainingModel & { exam?: { cases?: unknown } }; if (m.exam) m.exam = { ...m.exam, cases: undefined }; return m; }).sort((a, b) => (b.endedAt ?? b.startedAt ?? 0) - (a.endedAt ?? a.startedAt ?? 0));
  return NextResponse.json({ ok: true, examples, datasets, models });
}
