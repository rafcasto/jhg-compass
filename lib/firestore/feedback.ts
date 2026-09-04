"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { paths } from "./db";
import type { FeedbackConfig } from "@/lib/types";
import { DEFAULT_FEEDBACK_CONFIG } from "@/lib/feedback-defaults";

// Live admin-editable survey config (config/feedback). Falls back to defaults so
// nothing shows until an admin explicitly enables it.
export function useFeedbackConfig(): FeedbackConfig {
  const [cfg, setCfg] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  useEffect(() => {
    const unsub = onSnapshot(paths.feedbackConfig(), (snap) => {
      if (snap.exists()) setCfg({ ...DEFAULT_FEEDBACK_CONFIG, ...(snap.data() as FeedbackConfig) });
    });
    return () => unsub();
  }, []);
  return cfg;
}

// Whether this user has already submitted feedback — the GLOBAL modal hides once
// they have. (The per-user link ignores this and always shows.)
export function useFeedbackSubmission(uid: string | undefined) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      paths.feedbackResponses(uid),
      (snap) => { setSubmitted(!snap.empty); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [uid]);
  return { submitted, loading };
}
