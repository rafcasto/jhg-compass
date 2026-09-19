"use client";

import { Section, Empty } from "@/components/admin/shared";
import type { AgentsStatus } from "@/lib/careerops/types";
import WorkerBanner from "./WorkerBanner";

// Admin → Agents → Prompts. Ships in phase 2 (docs/CAREER_OPS_AGENTS.md); this
// panel already wires the shared worker status so the real controls drop in.
export default function Prompts({ status }: { status: AgentsStatus | null }) {
  return (
    <div className="space-y-6">
      <WorkerBanner status={status} error={null} />
      <Section title="Prompts" help="Edit each agent's system prompt (seeded from the career-ops mode files), with versions you can restore.">
        <Empty>Coming in phase 2.</Empty>
      </Section>
    </div>
  );
}
