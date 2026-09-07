"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { paths } from "./db";
import { DEFAULT_COACHING_SCREEN, mergeCoachingScreen, type CoachingScreenContent } from "@/lib/coaching-screen";

export interface UseCoachingScreen {
  loading: boolean;
  /** The published copy (seed copy until something is published). */
  content: CoachingScreenContent;
  publishedAt: number | null;
}

// Live-reads the published Coaching-tab content (config/coachingScreen.published)
// so an admin "Publish" shows up on members' screens without a reload.
export function useCoachingScreen(): UseCoachingScreen {
  const [state, setState] = useState<UseCoachingScreen>({
    loading: true, content: DEFAULT_COACHING_SCREEN, publishedAt: null,
  });

  useEffect(() => {
    const unsub = onSnapshot(
      paths.coachingScreen(),
      (snap) => {
        const d = snap.exists() ? (snap.data() as { published?: unknown; publishedAt?: number }) : null;
        setState({ loading: false, content: mergeCoachingScreen(d?.published), publishedAt: d?.publishedAt ?? null });
      },
      () => setState((s) => ({ ...s, loading: false }))
    );
    return () => unsub();
  }, []);

  return state;
}
