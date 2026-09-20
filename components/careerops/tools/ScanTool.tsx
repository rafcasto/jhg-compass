"use client";

import { useRouter } from "next/navigation";
import Scan from "@/components/agents/Scan";
import { toolHref } from "@/lib/careerops/portal-nav";
import type { ToolProps } from "../SectionScreen";

// Sourcing → scan: the Scout over the member's watchlist (portals.yml built from Setup).
export default function ScanTool({ ctx }: ToolProps) {
  const router = useRouter();
  return <Scan uid={ctx.uid} hasPortals={ctx.hasCv && ctx.hasPortals} online={ctx.online}
    onEvaluateQueued={(id) => router.push(`${toolHref("scoring", "oferta")}&job=${id}`)} />;
}
