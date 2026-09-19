"use client";

import { Section, Empty } from "@/components/admin/shared";
import type { AgentsStatus } from "@/lib/careerops/types";
import WorkerBanner from "./WorkerBanner";

// Admin → Agents → Models. Ships in phase 2 (docs/CAREER_OPS_AGENTS.md); this
// panel already wires the shared worker status so the real controls drop in.
export default function Models({ status }: { status: AgentsStatus | null }) {
  return (
    <div className="space-y-6">
      <WorkerBanner status={status} error={null} />
      <Section title="Models" help="Choose the Ollama model, context window and temperature for each agent from the models the Pi reports; import a GGUF trained elsewhere.">
        <Empty>Coming in phase 2.</Empty>
      </Section>
    </div>
  );
}
