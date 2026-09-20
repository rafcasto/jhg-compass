"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Evaluate from "@/components/agents/Evaluate";
import Reports from "@/components/agents/Reports";
import ReportView from "@/components/agents/ReportView";
import type { CareerOpsReport } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";

// Scoring → oferta: one JD → the report. Reports of every run live below it.
export default function Oferta({ ctx }: ToolProps) {
  const params = useSearchParams();
  const [open, setOpen] = useState<CareerOpsReport | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(params.get("job"));
  const externalJob = params.get("job");

  useEffect(() => {
    if (!waitingFor) return;
    const r = ctx.reports.find((x) => x.jobId === waitingFor);
    if (r) { setOpen(r); setWaitingFor(null); }
  }, [ctx.reports, waitingFor]);

  return (
    <div className="space-y-5">
      <Evaluate hasCv={ctx.hasCv} online={ctx.online} onDone={(id) => setWaitingFor(id)} externalJobId={externalJob} />
      {open ? <ReportView uid={ctx.uid} report={open} onClose={() => setOpen(null)} /> : (
        <section className="space-y-2">
          <h3 className="font-display font-bold text-jh-ink">Your reports ({ctx.reports.length})</h3>
          <Reports reports={ctx.reports} onOpen={setOpen} />
        </section>
      )}
    </div>
  );
}
