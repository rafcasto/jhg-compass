"use client";

import { MessagesSquare } from "lucide-react";
import { SubTabs, TabHeader } from "@/components/admin/shared";
import { INTERACTIONS_SUBTABS, type InteractionsSub } from "@/components/admin/nav";
import FeedbackTab from "@/components/admin/FeedbackTab";
import TrackingTab from "./TrackingTab";

// What members tell us (feedback) and which of their interactions we track.
export default function InteractionsTab({ sub, onSub }: { sub: InteractionsSub; onSub: (s: InteractionsSub) => void }) {
  return (
    <div className="space-y-6">
      <TabHeader icon={MessagesSquare} title="User interactions"
        intro="What members tell us, and which of their interactions JHCompass records." />
      <SubTabs items={INTERACTIONS_SUBTABS} value={sub} onChange={onSub} ariaLabel="User interaction sections" />
      {sub === "feedback" && <FeedbackTab />}
      {sub === "tracking" && <TrackingTab />}
    </div>
  );
}
