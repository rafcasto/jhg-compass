// Kanban pipeline stages for the Progress (Tracker) board.
//
// Stages are admin-editable from the "Stages" admin tab (add / rename / recolour /
// reorder / remove) and stored on config/content.stages. This module is pure so it
// can be shared by the client hook, the server helpers and the admin editor.

import type { Stage } from "./types";

// Colour palette for the column dot. Tailwind needs static class strings, so the
// admin picks a named colour and we map it to a brand token here.
export const STAGE_COLORS = [
  { key: "grey",       label: "Grey",       dot: "bg-jh-mute" },
  { key: "blue",       label: "Blue",       dot: "bg-rb-blue" },
  { key: "violet",     label: "Violet",     dot: "bg-rb-violet" },
  { key: "ink",        label: "Ink",        dot: "bg-jh-ink" },
  { key: "orange",     label: "Orange",     dot: "bg-rb-orange" },
  { key: "yellow",     label: "Yellow",     dot: "bg-rb-yellow" },
  { key: "green",      label: "Green",      dot: "bg-rb-green-light" },
  { key: "green-dark", label: "Dark green", dot: "bg-rb-green-dark" },
  { key: "red",        label: "Red",        dot: "bg-jh-red" },
] as const;

export type StageColor = (typeof STAGE_COLORS)[number]["key"];
const COLOR_KEYS = new Set<string>(STAGE_COLORS.map((c) => c.key));
const DEFAULT_COLOR: StageColor = "grey";

export function stageDotClass(color: string | undefined): string {
  return STAGE_COLORS.find((c) => c.key === color)?.dot ?? "bg-jh-mute";
}

// Default pipeline, in board order.
export const DEFAULT_STAGES: Stage[] = [
  { id: "wishlist",       label: "Wishlist",              color: "grey" },
  { id: "outreach",       label: "Outreach",              color: "blue" },
  { id: "info_interview", label: "Information interview", color: "violet" },
  { id: "application",    label: "Application",           color: "ink" },
  { id: "job_interview",  label: "Job interview",         color: "orange" },
  { id: "offer",          label: "Offer",                 color: "yellow" },
  { id: "negotiation",    label: "Negotiation",           color: "green" },
  { id: "accepted",       label: "✅ Accepted",           color: "green-dark" },
  { id: "rejected",       label: "❌ Rejected",           color: "red" },
];

// Ids used by earlier versions of the board. Cards still carrying one of these
// are shown in the closest current column (if it still exists).
const LEGACY_STAGE_IDS: Record<string, string> = {
  applied: "application",
  interview: "job_interview",
  interviewing: "job_interview",
  researching: "wishlist",
  contacted: "outreach",
  closed: "rejected",
};

// Sanitise whatever is stored: drop malformed rows, trim, dedupe ids, coerce
// unknown colours. An empty / missing list falls back to the defaults.
export function normalizeStages(stored: unknown): Stage[] {
  if (!Array.isArray(stored)) return DEFAULT_STAGES;
  const seen = new Set<string>();
  const out: Stage[] = [];
  for (const raw of stored) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    const color = typeof r.color === "string" && COLOR_KEYS.has(r.color) ? (r.color as StageColor) : DEFAULT_COLOR;
    out.push({ id, label, color });
  }
  return out.length ? out : DEFAULT_STAGES;
}

// Map a card's stored stage to a column that exists on the current board.
export function resolveStage(stageId: string | undefined, stages: Stage[]): string {
  const ids = new Set(stages.map((s) => s.id));
  if (stageId && ids.has(stageId)) return stageId;
  const legacy = stageId ? LEGACY_STAGE_IDS[stageId] : undefined;
  if (legacy && ids.has(legacy)) return legacy;
  return stages[0]?.id ?? DEFAULT_STAGES[0].id;
}

// Stable id for a brand-new stage. Never regenerated when the label is edited,
// otherwise cards already in that column would be orphaned.
export function newStageId(label: string, existing: Stage[] = []): string {
  const taken = new Set(existing.map((s) => s.id));
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "stage";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}
