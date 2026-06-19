"use client";

import { useEffect } from "react";
import { Lock } from "lucide-react";
import { useAdminConfig } from "@/lib/firestore/access";
import { useAuth } from "@/components/AuthProvider";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

// Full-screen blocking modal shown when a user's access has expired (req 9).
// Copy + CTA are admin-editable (req 10).
export default function Paywall() {
  const cfg = useAdminConfig();
  const { signOut } = useAuth();

  useEffect(() => {
    track(TAGS.PAYWALL_HIT, { stage: "retention" });
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-jh-ink/70 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-jh-red-soft">
          <Lock className="h-7 w-7 text-jh-red" />
        </div>
        <h2 className="mb-3">{cfg.paywallTitle}</h2>
        <p className="text-jh-mute mb-7">{cfg.paywallBody}</p>
        <a
          href={cfg.paywallCtaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full"
          onClick={() => track(TAGS.PAYWALL_HIT, { stage: "retention", props: { action: "cta_click" } })}
        >
          {cfg.paywallCtaLabel}
        </a>
        <button onClick={() => signOut()} className="btn-ghost mt-3 w-full text-sm">
          Sign out
        </button>
      </div>
    </div>
  );
}
