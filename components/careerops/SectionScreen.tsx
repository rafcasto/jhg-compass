"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Wifi, WifiOff, Settings2 } from "lucide-react";
import { findSection, parseTool, SETUP_HREF, type SectionKey } from "@/lib/careerops/portal-nav";
import { useCareerOps, type CareerOpsCtx } from "./shared";
import ScanTool from "./tools/ScanTool";
import MultiEvaluate from "./tools/MultiEvaluate";
import Deep from "./tools/Deep";
import Oferta from "./tools/Oferta";
import Advise from "./tools/Advise";
import Contacto from "./tools/Contacto";
import Pdf from "./tools/Pdf";
import Apply from "./tools/Apply";
import Tracker from "./tools/Tracker";
import InterviewPrep from "./tools/InterviewPrep";
import Followup from "./tools/Followup";
import Patterns from "./tools/Patterns";

export interface ToolProps { ctx: CareerOpsCtx; tool: string }

const TOOLS: Record<string, ComponentType<ToolProps>> = {
  scan: ScanTool, pipeline: MultiEvaluate, deep: Deep,
  oferta: Oferta, ofertas: MultiEvaluate, batch: MultiEvaluate, training: Advise, project: Advise,
  contacto: Contacto, pdf: Pdf, apply: Apply,
  tracker: Tracker, "interview-prep": InterviewPrep, followup: Followup, patterns: Patterns,
};

// One CareerOps section: header with worker status, the tool tabs, the tool.
export default function SectionScreen({ section }: { section: SectionKey }) {
  const sec = findSection(section)!;
  const params = useSearchParams();
  const router = useRouter();
  const tool = parseTool(section, params.get("tool"));
  const { ctx, loading, allowed } = useCareerOps();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // No CV yet → the tools have nothing to work with; send first-timers to Setup once.
  useEffect(() => {
    if (ctx && !ctx.setupLoading && ctx.setup === null) router.replace(`${SETUP_HREF}?first=1`);
  }, [ctx, router]);

  if (loading || !ctx || !hydrated) return <p className="text-jh-mute animate-pulse">Loading…</p>;
  if (!allowed) return null; // the layout shows the "not switched on" card
  const Tool = TOOLS[tool];
  const meta = sec.tools.find((t) => t.key === tool)!;
  const s = ctx.status;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">CareerOps · {sec.label} ({sec.tools.length})</p>
          <h1>{sec.tagline}</h1>
        </div>
        <div className="text-sm text-right space-y-1">
          {ctx.statusError ? <span className="text-jh-red">Can&apos;t reach the agents</span>
          : !s ? <span className="text-jh-mute animate-pulse">Checking…</span>
          : s.online ? <span className="inline-flex items-center gap-1.5 text-rb-green-dark font-semibold"><Wifi className="h-4 w-4" /> Agents awake</span>
          : <span className="inline-flex items-center gap-1.5 text-jh-mute font-semibold"><WifiOff className="h-4 w-4" /> Agents asleep — jobs wait in the queue</span>}
          {s && <p className="text-xs text-jh-mute">{s.queueLength} in queue · {s.quotaUsed} agent runs today</p>}
          <Link href={SETUP_HREF} className="inline-flex items-center gap-1 text-xs text-jh-mute hover:text-jh-red underline underline-offset-2"><Settings2 className="h-3.5 w-3.5" /> {ctx.hasCv ? "CV, North Star & watchlist" : "Add your CV to start"}</Link>
        </div>
      </header>

      <div role="tablist" aria-label={`${sec.label} tools`} className="inline-flex flex-wrap gap-1 rounded-pill bg-jh-mist p-1">
        {sec.tools.map((t) => (
          <Link key={t.key} role="tab" aria-selected={tool === t.key} href={`${sec.href}?tool=${t.key}`} scroll={false}
            className={`px-4 py-2 rounded-pill text-sm font-mono font-semibold transition-colors ${tool === t.key ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute hover:text-jh-ink"}`}>{t.label}</Link>
        ))}
      </div>

      <section className="space-y-1">
        <h2 className="text-lg">{meta.title}</h2>
        <p className="text-jh-mute text-sm max-w-3xl">{meta.blurb}</p>
      </section>

      {Tool ? <Tool ctx={ctx} tool={tool} /> : null}
    </div>
  );
}
