"use client";

import { MessagesSquare } from "lucide-react";
import { SubTabs, TabHeader } from "@/components/admin/shared";
import { INTERACTIONS_SUBTABS, type InteractionsSub } from "@/components/admin/nav";
import FeedbackTab from "@/components/admin/FeedbackTab";
import UsageTab from "./UsageTab";

// What members tell us (feedback) and what they do (usage).
export default function InteractionsTab({ sub, onSub }: { sub: InteractionsSub; onSub: (s: InteractionsSub) => void }) {
  return (
    <div className="space-y-6">
      <TabHeader icon={MessagesSquare} title="User interactions"
        intro="What members tell us and what they actually do in JHCompass." />
      <SubTabs items={INTERACTIONS_SUBTABS} value={sub} onChange={onSub} ariaLabel="User interaction sections" />
      {sub === "feedback" && <FeedbackTab />}
      {sub === "usage" && <UsageTab />}
    </div>
  );
}
