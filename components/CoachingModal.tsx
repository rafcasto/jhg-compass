"use client";

import { useEffect } from "react";
import { X, GraduationCap } from "lucide-react";
import { useAdminConfig } from "@/lib/firestore/access";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

// Coaching upsell modal — mirrors the Paywall pattern but is dismissible and uses
// its own admin-editable copy (Q1).
export default function CoachingModal({ onClose }: { onClose: () => void }) {
  const cfg = useAdminConfig();

  useEffect(() => {
    track(TAGS.COACHING_OPEN, { stage: "retention" });
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-jh-ink/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card max-w-md w-full p-8 text-center relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-jh-mute hover:text-jh-ink">
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-jh-red-soft">
          <GraduationCap className="h-7 w-7 text-jh-red" />
        </div>
        <h2 className="mb-3">{cfg.coachingTitle}</h2>
        <p className="text-jh-mute mb-7">{cfg.coachingBody}</p>
        <a
          href={cfg.coachingCtaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full"
          onClick={() => track(TAGS.COACHING_OPEN, { stage: "retention", props: { action: "cta_click" } })}
        >
          {cfg.coachingCtaLabel}
        </a>
        <button onClick={onClose} className="btn-ghost mt-3 w-full text-sm">Maybe later</button>
      </div>
    </div>
  );
}
