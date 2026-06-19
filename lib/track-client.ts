"use client";

import { auth } from "./firebase/client";
import type { EventKey } from "./tags";

type Stage = "acquisition" | "activation" | "retention";

// Fire-and-forget client event → /api/track → Supabase (jobhackers_leads).
export async function track(
  event: EventKey,
  opts: { stage?: Stage; source?: string; props?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    const user = auth.currentUser;
    const idToken = user ? await user.getIdToken() : undefined;
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event,
        stage: opts.stage,
        source: opts.source ?? "tracker",
        props: opts.props,
        uid: user?.uid,
        email: user?.email,
        idToken,
      }),
    });
  } catch {
    /* analytics must never break the UI */
  }
}
