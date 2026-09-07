"use client";

import { Compass, Gauge, Columns3, GraduationCap } from "lucide-react";
import { COACHING_COLUMN_HEIGHT, COACHING_VIEWPORT, type CoachingScreenContent } from "@/lib/coaching-screen";
import { BottomTabBar, MobileHeader, PreviewStatusBar } from "@/components/shell/MobileChrome";
import CoachingScreen from "@/components/coaching/CoachingScreen";

// A true-size 390×844 phone frame around the real Coaching screen and the real
// shell chrome. Used by Admin → Coaching so an editor sees exactly what ships.
// Tab labels are the defaults; they don't affect the column height.
const TABS = [
  { key: "compass", label: "Compass", icon: Compass, href: "/compass" },
  { key: "performance", label: "Performance", icon: Gauge, href: "/performance" },
  { key: "tracker", label: "Progress", icon: Columns3, href: "/tracker" },
  { key: "coaching", label: "Coaching", icon: GraduationCap, href: "/coaching", active: true },
];

export default function CoachingPreview({
  content, onFitChange,
}: { content: CoachingScreenContent; onFitChange?: (fits: boolean) => void }) {
  return (
    <div
      className="coaching-preview"
      style={{ width: COACHING_VIEWPORT.width, height: COACHING_VIEWPORT.height }}
      role="img"
      aria-label={`Live preview at ${COACHING_VIEWPORT.width}×${COACHING_VIEWPORT.height}`}
    >
      <PreviewStatusBar />
      <MobileHeader position="static" />
      <div style={{ height: COACHING_COLUMN_HEIGHT }}>
        <CoachingScreen content={content} className="coaching-screen--preview" onFitChange={onFitChange} />
      </div>
      <BottomTabBar items={TABS} position="static" />
    </div>
  );
}
