"use client";

import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_FUNNEL, mergeFunnel, type FunnelConfig } from "@/lib/funnel";

// Reads the admin-editable funnel doc (config/funnel) for the public landing,
// quiz and thank-you pages.
//
// Two sources, in order of reliability:
//   1) GET /api/funnel — a server-side read via the Admin SDK. This ALWAYS works
//      (no dependency on the client-side Firestore read rule being deployed), so
//      admin edits are guaranteed to reflect on the public pages.
//   2) onSnapshot(config/funnel) — best-effort live updates, used only when the
//      public read rule is in place. If it's denied, the error handler is a no-op
//      and the API value stands.
export function useFunnel(initial?: FunnelConfig): { loading: boolean; funnel: FunnelConfig } {
  const [funnel, setFunnel] = useState<FunnelConfig>(initial ?? DEFAULT_FUNNEL);
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    let active = true;

    // 1) guaranteed read via the server
    fetch("/api/funnel", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (active && d?.ok && d.funnel) { setFunnel(mergeFunnel(d.funnel)); } })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });

    // 2) best-effort live updates (only if client reads are permitted)
    const unsub = onSnapshot(
      doc(db, "config", "funnel"),
      (snap) => {
        if (!active) return;
        setFunnel(mergeFunnel(snap.exists() ? (snap.data() as Partial<FunnelConfig>) : null));
        setLoading(false);
      },
      () => { /* read denied / offline — keep the API value */ }
    );

    return () => { active = false; unsub(); };
  }, []);

  return { loading, funnel };
}
