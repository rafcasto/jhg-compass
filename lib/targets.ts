// Activity-target resolution — the ONE rule for "what is this user's target?".
//
// Targets are stored as a canonical WEEKLY number per activity id. Two layers:
//   1) users/{uid}/settings/targets.targets  — the user's own overrides (only the
//      rows they have actually set; untouched rows are absent)
//   2) config/content.activities[].defaultWeekly — the admin-set default
//
// The Performance tab is the source of truth for this rule; onboarding's
// "set your daily targets" step must resolve and persist targets identically
// so the two screens never disagree.

export type WeeklyTargets = Record<string, number>;

/** User override wins; otherwise the admin default; otherwise no target (0). */
export function resolveWeeklyTarget(id: string, userTargets: WeeklyTargets, defaults: WeeklyTargets): number {
  return userTargets[id] ?? defaults[id] ?? 0;
}

/**
 * The document payload to write after the user edits some rows: existing
 * overrides plus the edited ones. Untouched rows are deliberately NOT copied
 * from the admin defaults, so later admin changes keep flowing through.
 */
export function withTargetEdits(userTargets: WeeklyTargets, edits: WeeklyTargets): WeeklyTargets {
  return { ...userTargets, ...edits };
}
