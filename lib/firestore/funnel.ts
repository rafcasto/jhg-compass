"use client";

import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_FUNNEL, mergeFunnel, type FunnelConfig } from "@/lib/funnel";

// Live-reads the admin-editable funnel doc (config/funnel). The public landing,
// quiz and thank-you pages all use this, so admin edits reflect instantly — and
// because config/funnel is public-read (see firestore.rules) it works signed-out.
export function useFunnel(): { loading: boolean; funnel: FunnelConfig } {
  const [funnel, setFunnel] = useState<FunnelConfig>(DEFAULT_FUNNEL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "config", "funnel"),
      (snap) => {
        setFunnel(mergeFunnel(snap.exists() ? (snap.data() as Partial<FunnelConfig>) : null));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  return { loading, funnel };
}
