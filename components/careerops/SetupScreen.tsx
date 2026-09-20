"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings2 } from "lucide-react";
import Setup from "@/components/agents/Setup";
import { PORTAL_HOME } from "@/lib/careerops/portal-nav";
import { useCareerOps } from "./shared";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const first = params.get("first") === "1";
  const { ctx, loading, allowed } = useCareerOps();
  if (loading || !ctx) return <p className="text-jh-mute animate-pulse">Loading…</p>;
  if (!allowed) return null;
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">CareerOps · Setup</p>
        <h1 className="flex items-center gap-2"><Settings2 className="h-6 w-6 text-jh-red" strokeWidth={1.5} /> Your CV, North Star and watchlist</h1>
        <p className="text-jh-mute mt-1 max-w-2xl">{first ? "First time here. " : ""}Every tool in this portal works from three things: your CV (the only source of truth about you), the North Star goal you set on the Compass tab, and the companies you want to be found by. Everything stays on our own hardware, and nothing is ever submitted on your behalf.</p>
      </header>
      <Setup onReady={() => { if (first) router.replace(PORTAL_HOME); }} />
    </div>
  );
}

export default function SetupScreen() {
  return <Suspense fallback={<p className="text-jh-mute animate-pulse">Loading…</p>}><Inner /></Suspense>;
}
