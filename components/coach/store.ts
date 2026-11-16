"use client";

import { useSyncExternalStore } from "react";
import type { CoachKey } from "@/lib/engine/coach/keys";

// The launcher and the panel share one small piece of state across pages (the panel is
// mounted once in AppShell and stays open while the member moves between pages —
// docs/UX_COACH.md §3). No provider: a module store with useSyncExternalStore.

export interface CoachFlash {
  /** Section labels the coach just wrote, as the page shows them — the rows that light up (docs/UX_COACH_AGENTIC.md §6). */
  labels: string[];
  at: number;
}

export interface CoachUi {
  open: boolean;
  /** The coach in the panel; null until one is opened. */
  coach: CoachKey | null;
  /** The launcher's tail collapses after the first open of the session. */
  tailSeen: boolean;
  /** The last write that landed — the page highlights its rows for 600 ms. */
  flash: CoachFlash | null;
  /** The panel expanded to the whole viewport (docs/UX_COACH_AGENTIC.md §11) — a preference, remembered on this device. */
  wide: boolean;
}

const WIDE_KEY = "jh.coach.wide";
let state: CoachUi = { open: false, coach: null, tailSeen: false, flash: null, wide: false };
const subs = new Set<() => void>();
const set = (patch: Partial<CoachUi>) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };

export const openCoach = (coach: CoachKey) => set({ open: true, coach, tailSeen: true });
/** Expand or collapse the panel; the choice is kept on the device so the next session opens the way this one was left. */
export const setWide = (wide: boolean) => { set({ wide }); try { localStorage.setItem(WIDE_KEY, wide ? "1" : "0"); } catch { /* private mode */ } };
/** Read the remembered choice once the panel is on the client (the server snapshot is always docked). */
export const restoreWide = () => { try { if (localStorage.getItem(WIDE_KEY) === "1") set({ wide: true }); } catch { /* private mode */ } };
export const closeCoach = () => set({ open: false });
/** A write landed: the page beside the panel lights the rows it names. */
export const flashSections = (labels: string[]) => set({ flash: labels.length ? { labels, at: Date.now() } : null });

export function useCoachUi(): CoachUi {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state, () => state);
}

/**
 * The rows a write lights: the sections of this page whose label the note names. Null when the write is
 * older than two seconds — a page opened after the fact does not replay it.
 */
export function flashKeysFor<K extends string>(flash: CoachFlash | null, sections: readonly { key: K; label: string }[], now = Date.now()): { keys: K[]; key: number } | null {
  if (!flash || now - flash.at > 2000) return null;
  const keys = sections.filter((s) => flash.labels.includes(s.label)).map((s) => s.key);
  return keys.length ? { keys, key: flash.at } : null;
}

/** Tests only. */
export const resetCoachUi = () => { set({ open: false, coach: null, tailSeen: false, flash: null, wide: false }); try { localStorage.removeItem(WIDE_KEY); } catch { /* private mode */ } };
