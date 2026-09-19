"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, Columns3, Check } from "lucide-react";
import { updateDoc, doc } from "firebase/firestore";
import { createDoc, paths } from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";
import { scoreTone, scoreVerdict, type CareerOpsReport } from "@/lib/careerops/types";

const TONE: Record<ReturnType<typeof scoreTone>, string> = {
  strong: "bg-rb-green-light/30 text-rb-green-dark", good: "bg-rb-green-light/30 text-rb-green-dark",
  maybe: "bg-rb-yellow/30 text-jh-ink", skip: "bg-jh-red-soft text-jh-red", unknown: "bg-jh-mist text-jh-mute",
};

export function ScoreBadge({ score, big = false }: { score: number | null; big?: boolean }) {
  return <span className={`pill tabular-nums ${TONE[scoreTone(score)]} ${big ? "text-base px-3 py-1" : ""}`}>{score == null ? "?/5" : `${score.toFixed(1)}/5`}</span>;
}

// One A–G report, rendered from the worker's markdown, with the actions that
// connect it to the rest of Compass.
export default function ReportView({ uid, report, onClose }: { uid: string; report: CareerOpsReport; onClose?: () => void }) {
  const { stages } = useContent();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string | null>(report.addedOpportunityId ?? null);

  async function addToTracker() {
    if (added) return;
    setBusy(true);
    try {
      const ref = await createDoc(paths.opportunities(uid), {
        company: report.company, role: report.role, market: "visible", stage: stages[0].id, contactIds: [], log: [],
        source: "Agents · Evaluator", url: report.url ?? "",
        notes: `Evaluator score ${report.score ?? "?"}/5 · ${report.archetype} · ${report.legitimacy}`,
      });
      await updateDoc(doc(paths.careerOpsReports(uid), report.id), { addedOpportunityId: ref.id });
      setAdded(ref.id);
      track(TAGS.ADD_OPPORTUNITY, { source: "agents", props: { from: "evaluator", score: report.score } });
    } finally { setBusy(false); }
  }

  return (
    <article className="card p-5 space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="eyebrow">{report.archetype} · {report.legitimacy}</p>
          <h2 className="text-xl">{report.company} — {report.role}</h2>
          <p className="text-sm text-jh-mute mt-1">{scoreVerdict(report.score)} · {report.model} · {new Date(report.createdAt).toLocaleString()}</p>
        </div>
        <ScoreBadge score={report.score} big />
      </header>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={addToTracker} disabled={busy || !!added} className="btn-primary text-sm disabled:opacity-60">
          {added ? <><Check className="h-4 w-4" /> On your Progress board</> : <><Columns3 className="h-4 w-4" /> {busy ? "Adding…" : "Add to Progress board"}</>}
        </button>
        {report.url && <a href={report.url} target="_blank" rel="noreferrer" className="btn-secondary text-sm"><ExternalLink className="h-4 w-4" /> Open posting</a>}
        {onClose && <button type="button" onClick={onClose} className="btn-ghost text-sm">Back</button>}
      </div>
      {!report.summaryFound && <p className="text-xs text-jh-red">The model didn&apos;t produce a clean score block for this one — read the verdict below and treat the score as unknown.</p>}
      <div className="prose prose-sm max-w-none prose-table:text-xs prose-headings:font-display">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.markdown}</ReactMarkdown>
      </div>
    </article>
  );
}
