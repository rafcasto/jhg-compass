"use client";

import { Sparkles } from "lucide-react";
import { SubTabs, TabHeader } from "@/components/admin/shared";
import { ENGINE_SUBTABS, type EngineSub } from "@/components/admin/nav";
import Usage from "./Usage";
import Settings from "./Settings";

// Admin → Claude (tab 6). The engine behind the AI coach and, later, the CareerOps
// modules reused inside JobHacking and Compass (docs/CAREER_OPS_CLAUDE.md §1,
// docs/UX_COACH.md §8). Runs on Vercel against the Claude API; the Pi and its
// CareerOps tab are a different engine and untouched.
export default function EngineTab({ sub, onSub }: { sub: EngineSub; onSub: (s: EngineSub) => void }) {
  return (
    <div className="space-y-6">
      <TabHeader icon={Sparkles} title="Claude"
        intro="The engine behind the AI coach on JobHacking and Compass → Settings — and, as they are reused there, the CareerOps agents. Every call is metered per member per month; limits start at none (measure first), and the price table is yours to correct." />
      <SubTabs items={ENGINE_SUBTABS} value={sub} onChange={onSub} ariaLabel="Claude sections" />
      {sub === "usage" && <Usage />}
      {sub === "settings" && <Settings />}
    </div>
  );
}
