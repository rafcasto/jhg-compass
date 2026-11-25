// A step's values, read the one way (docs/UX_SCRIPTED_COACH.md §3). Shared by the engine and the scripts — a separate
// module so a script never imports the engine that imports it. Pure.

import type { FieldValue } from "./types";

export const asString = (v: FieldValue | undefined): string => (typeof v === "string" ? v.trim() : "");
/** A typed list: commas or new lines. */
export const splitList = (s: string): string[] => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
export const asList = (v: FieldValue | undefined): string[] => (Array.isArray(v) ? v.map((x) => x.trim()).filter(Boolean) : typeof v === "string" ? splitList(v) : []);
export const asRecord = (v: FieldValue | undefined): Record<string, string> => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
/** The digits of a figure the member typed in their own formatting — "140,000" → 140000; null when there is none. */
export const figure = (s: string): number | null => { const d = s.replace(/[^\d.]/g, ""); return d ? Number(d) : null; };
