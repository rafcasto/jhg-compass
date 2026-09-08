"use client";

import { LayoutTemplate } from "lucide-react";
import { SubTabs, TabHeader } from "@/components/admin/shared";
import { CMS_SUBTABS, type CmsSub } from "@/components/admin/nav";
import CompassCms from "./CompassCms";
import PerformanceCms from "./PerformanceCms";
import ProgressCms from "./ProgressCms";
import CoachingScreenTab from "@/components/admin/CoachingScreenTab";

// The lead-magnet CMS: one sub-tab per member-facing tab, in the order members
// see them. Every editor follows the Coaching layout — form beside a true-size
// preview, sticky save bar with an audit line.
export default function CmsTab({ sub, onSub }: { sub: CmsSub; onSub: (s: CmsSub) => void }) {
  return (
    <div className="space-y-6">
      <TabHeader icon={LayoutTemplate} title="JHCompass lead magnet — CMS"
        intro="Every word members see in the app, organised by the tab it appears on. The preview beside each form is the real screen, so front office and back office can't drift apart." />
      <SubTabs items={CMS_SUBTABS} value={sub} onChange={onSub} ariaLabel="CMS sections" />
      {sub === "compass" && <CompassCms />}
      {sub === "performance" && <PerformanceCms />}
      {sub === "progress" && <ProgressCms />}
      {sub === "coaching" && <CoachingScreenTab />}
    </div>
  );
}
