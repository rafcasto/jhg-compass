"use client";

import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { fmtDateTime } from "@/components/admin/shared";
import type { AgentsStatus } from "@/lib/careerops/types";

// One line every Agents sub-tab shows at the top: is the Pi worker there?
export default function WorkerBanner({ status, error }: { status: AgentsStatus | null; error: string | null }) {
  if (error) return <p role="status" className="flex items-center gap-2 text-sm text-jh-red"><AlertTriangle className="h-4 w-4" /> {error}</p>;
  if (!status) return <p className="text-sm text-jh-mute animate-pulse">Checking the Pi worker…</p>;
  if (!status.configured) return (
    <p role="status" className="flex items-center gap-2 text-sm text-jh-red"><AlertTriangle className="h-4 w-4" />
      Queue not configured — set <code className="font-mono">UPSTASH_REDIS_REST_URL</code> and <code className="font-mono">UPSTASH_REDIS_REST_TOKEN</code> on Vercel.</p>
  );
  const w = status.worker;
  return status.online && w ? (
    <p role="status" className="flex items-center gap-2 text-sm text-rb-green-dark">
      <Wifi className="h-4 w-4" /> Worker online on <span className="font-mono">{w.host}</span> · v{w.version}
      {w.current ? <> · working on <span className="font-mono">{w.current}</span></> : " · idle"}
      {!w.ollama && <span className="text-jh-red"> · Ollama unreachable</span>}
      {!w.n8n && <span className="text-jh-red"> · n8n unreachable</span>}
    </p>
  ) : (
    <p role="status" className="flex items-center gap-2 text-sm text-jh-red">
      <WifiOff className="h-4 w-4" /> Worker offline{w ? <> — last seen {fmtDateTime(w.at)}</> : " — it has never checked in"}. Jobs will wait in the queue.
    </p>
  );
}
