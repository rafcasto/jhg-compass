"use client";

import { Compass, Gauge, Columns3, GraduationCap } from "lucide-react";
import { COACHING_DESKTOP, COACHING_DESKTOP_COLUMN_HEIGHT, type CoachingScreenContent } from "@/lib/coaching-screen";
import { DesktopSidebar } from "@/components/shell/DesktopChrome";
import CoachingScreen from "@/components/coaching/CoachingScreen";

// A true-size 1280×800 desktop around the real Coaching screen and the real
// sidebar chrome, scaled down with a transform so it sits beside the form. Layout
// happens at full size, so the fit measurement is the real one.
const TABS = [
  { key: "compass", label: "Compass", icon: Compass, href: "/compass" },
  { key: "performance", label: "Performance", icon: Gauge, href: "/performance" },
  { key: "tracker", label: "Progress", icon: Columns3, href: "/tracker" },
  { key: "coaching", label: "Coaching", icon: GraduationCap, href: "/coaching", active: true },
];

export default function CoachingDesktopPreview({
  content, onFitChange, scale = 0.5,
}: { content: CoachingScreenContent; onFitChange?: (fits: boolean) => void; scale?: number }) {
  const { width, height, padX, padY, column } = COACHING_DESKTOP;
  return (
    <div style={{ width: width * scale, height: height * scale }} className="relative">
      <div
        className="coaching-preview absolute left-0 top-0 !flex-row"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
        role="img"
        aria-label={`Live preview at ${width}×${height}`}
      >
        <DesktopSidebar items={TABS} position="static" />
        {/* main area: #fafafa, 44px / 48px padding, one column centred horizontally */}
        <div className="flex-1 min-w-0 flex justify-center bg-jh-paper" style={{ padding: `${padY}px ${padX}px` }}>
          <CoachingScreen content={content} className="coaching-screen--preview"
            style={{ width: column, height: COACHING_DESKTOP_COLUMN_HEIGHT, padding: 0, background: "transparent" }}
            onFitChange={onFitChange} />
        </div>
      </div>
    </div>
  );
}
