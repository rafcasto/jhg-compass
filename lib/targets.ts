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
 * Split the values a member leaves in the Targets sheet into what to write:
 *   set   — rows whose value differs from the admin default (the member's override)
 *   unset — rows the member had overridden but has now put back on the default,
 *           so the override is removed and later admin changes reach them again.
 * Rows equal to the default with no existing override are untouched (not written).
 */
export function targetEdits(userTargets: WeeklyTargets, defaults: WeeklyTargets, values: WeeklyTargets): { set: WeeklyTargets; unset: string[] } {
  const set: WeeklyTargets = {};
  const unset: string[] = [];
  for (const [id, v] of Object.entries(values)) {
    const def = defaults[id] ?? 0;
    const current = resolveWeeklyTarget(id, userTargets, defaults);
    if (v === def) { if (id in userTargets) unset.push(id); continue; }
    if (v !== current || !(id in userTargets)) set[id] = v;
  }
  return { set, unset };
}
