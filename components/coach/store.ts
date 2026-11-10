"use client";

import { useSyncExternalStore } from "react";
import type { CoachKey } from "@/lib/engine/coach/keys";

// The launcher and the panel share one small piece of state across pages (the panel is
// mounted once in AppShell and stays open while the member moves between pages —
// docs/UX_COACH.md §3). No provider: a module store with useSyncExternalStore.

export interface CoachUi {
  open: boolean;
  /** The coach in the panel; null until one is opened. */
  coach: CoachKey | null;
  /** The launcher's tail collapses after the first open of the session. */
  tailSeen: boolean;
}

let state: CoachUi = { open: false, coach: null, tailSeen: false };
const subs = new Set<() => void>();
const set = (patch: Partial<CoachUi>) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };

export const openCoach = (coach: CoachKey) => set({ open: true, coach, tailSeen: true });
export const closeCoach = () => set({ open: false });

export function useCoachUi(): CoachUi {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state, () => state);
}

/** Tests only. */
export const resetCoachUi = () => set({ open: false, coach: null, tailSeen: false });
