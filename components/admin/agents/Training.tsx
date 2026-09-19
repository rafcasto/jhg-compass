"use client";

import { Section, Empty } from "@/components/admin/shared";
import type { AgentsStatus } from "@/lib/careerops/types";
import WorkerBanner from "./WorkerBanner";

// Admin → Agents → Training. Ships in phase 4 (docs/CAREER_OPS_AGENTS.md); this
// panel already wires the shared worker status so the real controls drop in.
export default function Training({ status }: { status: AgentsStatus | null }) {
  return (
    <div className="space-y-6">
      <WorkerBanner status={status} error={null} />
      <Section title="Training" help="Build datasets from Claude-generated gold and (when switched on) approved live reports; fine-tune on the GPU box; exam against the golden set; promote.">
        <Empty>Coming in phase 4.</Empty>
      </Section>
    </div>
  );
}
