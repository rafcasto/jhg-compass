"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { authed, SubTabs, TabHeader } from "@/components/admin/shared";
import { AGENTS_SUBTABS, type AgentsSub } from "@/components/admin/nav";
import type { AgentsStatus } from "@/lib/careerops/types";
import Overview from "./Overview";
import Models from "./Models";
import Prompts from "./Prompts";
import Training from "./Training";

// Admin → CareerOps (tab 5). career-ops agents run on the Raspberry Pi (n8n + Ollama);
// this tab only talks to the Upstash queue the Pi worker polls. Status is
// shared by every sub-tab so buttons can be disabled while the worker is offline.
export default function AgentsTab({ sub, onSub }: { sub: AgentsSub; onSub: (s: AgentsSub) => void }) {
  const [status, setStatus] = useState<AgentsStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await (await authed("/api/admin/agents/status")).json();
      if (d.ok) { setStatus(d); setErr(null); } else setErr(d.error ?? "Couldn't reach the queue.");
    } catch { setErr("Couldn't reach the queue."); }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <TabHeader icon={Bot} title="CareerOps"
        intro="The agents behind the CareerOps portal, running on the Raspberry Pi — Scout, Extractor, Evaluator, Tailor, Writer and Researcher. Pick the model each agent uses, edit its prompt, and train new models. The site never runs a model: it queues jobs into Upstash Redis and the Pi worker does the work." />
      <SubTabs items={AGENTS_SUBTABS} value={sub} onChange={onSub} ariaLabel="Agents sections" />
      {sub === "overview" && <Overview status={status} error={err} onRefresh={refresh} />}
      {sub === "models" && <Models status={status} />}
      {sub === "prompts" && <Prompts status={status} />}
      {sub === "training" && <Training status={status} />}
    </div>
  );
}
