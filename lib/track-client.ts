"use client";

import { auth } from "./firebase/client";

type Stage = "acquisition" | "activation" | "retention";

// Fire-and-forget client event → /api/track → Supabase compass_events.
export async function track(
  tag: string,
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
        tag,
        stage: opts.stage ?? "retention",
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
