"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { paths } from "./db";
import {
  DEFAULT_CONTENT, DEFAULT_TEXT, mergeContent,
  hiddenActivities, visibleActivities, weeklyTargetsFrom,
} from "@/lib/content";
import type { Activity, ContentConfig, Stage } from "@/lib/types";

export interface UseContent {
  loading: boolean;
  config: ContentConfig;
  hidden: Activity[];
  visible: Activity[];
  weeklyTargets: Record<string, number>;
  effortSplit: { hidden: number; visible: number };
  /** Progress-board columns, in order (admin-editable). */
  stages: Stage[];
  /** Look up an editable string by key (falls back to the baked-in default). */
  t: (key: string) => string;
}

// Live-reads the admin-editable content doc (config/content). Every page that shows
// static copy or the activity lists uses this so admin edits reflect instantly,
// across both the app and onboarding.
export function useContent(): UseContent {
  const [config, setConfig] = useState<ContentConfig>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      paths.content(),
      (snap) => {
        setConfig(mergeContent(snap.exists() ? (snap.data() as Partial<ContentConfig>) : null));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  return useMemo(() => ({
    loading,
    config,
    hidden: hiddenActivities(config),
    visible: visibleActivities(config),
    weeklyTargets: weeklyTargetsFrom(config),
    effortSplit: config.effortSplit,
    stages: config.stages,
    t: (key: string) => config.text[key] ?? DEFAULT_TEXT[key] ?? "",
  }), [config, loading]);
}
