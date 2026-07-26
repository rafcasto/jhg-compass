"use client";

import { useState } from "react";
import { useFeedbackConfig, useFeedbackSubmission } from "@/lib/firestore/feedback";
import FeedbackModal from "@/components/FeedbackModal";
import type { Profile } from "@/lib/types";

// Decides whether to show the feedback survey. Rendered by the (app) layout ONLY
// when the user still has access, so the expired-access Paywall wins by construction.
//
//  • Global  — admin flips `enabled` on → shown to every user.
//  • Per-user link — any URL with `?feedback=1` → shown to that visitor even
//    while the global flag is off.
//
// Either way it's ONE-TIME per user: once someone has submitted feedback, neither
// the global modal nor the link will show it again.
export default function FeedbackGate({ uid, profile }: { uid: string; profile: Profile | null }) {
  const cfg = useFeedbackConfig();
  const { submitted, loading } = useFeedbackSubmission(uid);

  // Read the trigger param once on mount (avoids a Suspense boundary for useSearchParams).
  const [linkTrigger] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("feedback") === "1"
  );
  const [done, setDone] = useState(false);

  if (done || loading) return null;

  const requested = linkTrigger || cfg.enabled;
  const show = requested && !submitted;
  if (!show) return null;

  return (
    <FeedbackModal
      cfg={cfg}
      uid={uid}
      profile={profile}
      source={linkTrigger ? "link" : "global"}
      onDone={() => {
        setDone(true);
        // Strip ?feedback=1 so a refresh doesn't reopen the link survey.
        if (linkTrigger && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("feedback");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        }
      }}
    />
  );
}
