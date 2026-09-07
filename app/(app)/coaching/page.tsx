"use client";

import { useEffect } from "react";
import { useCoachingScreen } from "@/lib/firestore/coaching-screen";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";
import CoachingScreen from "@/components/coaching/CoachingScreen";

// Coaching tab — renders the published copy from Admin → Coaching (seed copy
// until something is published). Sized to fit a 390×844 phone without scrolling.
export default function CoachingPage() {
  const { content } = useCoachingScreen();

  useEffect(() => {
    track(TAGS.COACHING_OPEN, { stage: "retention", source: "compass" });
  }, []);

  return (
    <CoachingScreen
      content={content}
      className="coaching-screen--page"
      onCtaClick={() => track(TAGS.COACHING_OPEN, { stage: "retention", source: "compass", props: { action: "cta_click" } })}
    />
  );
}
