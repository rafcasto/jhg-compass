// The North Star, derived by code (CLAUDE.md "code checks, the model converses"; docs/UX_JOURNEY_SCRIPTED_COACH.md §3).
// Coach 2's prompt used to ask the model to write goal · policy · personalization · watchlist · notes "exactly by these
// rules" at hand-over — the part of the conversation a small model gets wrong and T1 · T2 · T4 · T5 · T6 then fail. The rules
// are formulas over jhg.trueNorth and the Narrative's identity, so `applyCoachPatch` runs them on every True North write
// (the script's steps and the conversation alike) and the statement fills in as the working material lands. The model
// never writes these keys; the checks pass by construction. Pure — tested.

import type { JhgBoundaries, JhgIdentity, JhgTrueNorth } from "../../careerops/types";

const CAPS = { archetype: 80, axes: 200, buys: 200, targetRoles: 8, locationPolicy: 8, negotiationScripts: 6 } as const;
const clip = (s: string | undefined, n: number) => (s ?? "").trim().slice(0, n);
const semi = (xs: readonly string[] | undefined) => (xs ?? []).join("; ");
const def = (v: unknown) => v !== undefined && v !== null;

export interface DerivedTrueNorth {
  goal?: Record<string, string>;
  policy?: Record<string, unknown>;
  personalization?: Record<string, unknown>;
  watchlist?: { positive: string[]; negative: string[] };
  notes?: string;
}

/** goal.salary · policy.minimumSalary · personalization.compTargets — the pay rule. */
export function derivePay(b: JhgBoundaries): DerivedTrueNorth {
  if (!b.currency || !b.salaryLower || !b.salaryUpper || !b.salaryFloor) return {};
  return {
    goal: { salary: `${b.currency} ${b.salaryLower}–${b.salaryUpper}` },
    policy: { minimumSalary: `${b.currency} ${b.salaryFloor}` },
    personalization: { compTargets: `Target ${b.currency} ${b.salaryLower}–${b.salaryUpper}; floor ${b.currency} ${b.salaryFloor}.` },
  };
}

/** policy.locationFlexibility · personalization.locationPolicy — the place rule, empty parts left out. */
export function derivePlace(b: JhgBoundaries): DerivedTrueNorth {
  const flex = [b.remote && `Remote: ${b.remote}`, b.localHybrid && `Local hybrid: ${b.localHybrid}`, b.relocate && `Relocate: ${b.relocate}`].filter(Boolean).join("; ");
  const policy = [
    b.willWorkIn && `Will work in: ${b.willWorkIn}`, b.exclude && `Exclude: ${b.exclude}`, b.remote && `Remote: ${b.remote}`,
    b.localHybrid && `Local hybrid: ${b.localHybrid}`, b.relocate && `Relocate: ${b.relocate}`, b.remoteTravel && `Travel for a remote role elsewhere: ${b.remoteTravel}`,
  ].filter((x): x is string => !!x).slice(0, CAPS.locationPolicy);
  return { ...(flex ? { policy: { locationFlexibility: flex } } : {}), ...(policy.length ? { personalization: { locationPolicy: policy } } : {}) };
}

/** The §6 notes block — lines in the prompt's order, each left out when its source is empty. */
export function notesBlock(b: JhgBoundaries): string {
  return [
    b.hardNos?.length && `Hard no's (do not apply): ${semi(b.hardNos)}`,
    b.cultureMustHaves?.length && `Culture must-haves: ${semi(b.cultureMustHaves)}; deprioritise when absent: ${b.deprioritizeIfAbsent || "N"}`,
    b.softDislikes?.length && `Soft dislikes (lower, not a no): ${semi(b.softDislikes)}`,
    def(b.noticePeriodDays) && `Notice period: ${b.noticePeriodDays} days`,
    b.neverApply?.length && `Never apply: ${semi(b.neverApply)}`,
  ].filter((x): x is string => typeof x === "string").join("\n");
}

function merge(a: DerivedTrueNorth, c: DerivedTrueNorth): DerivedTrueNorth {
  return {
    ...(a.goal || c.goal ? { goal: { ...a.goal, ...c.goal } } : {}),
    ...(a.policy || c.policy ? { policy: { ...a.policy, ...c.policy } } : {}),
    ...(a.personalization || c.personalization ? { personalization: { ...a.personalization, ...c.personalization } } : {}),
    ...(c.watchlist ?? a.watchlist ? { watchlist: c.watchlist ?? a.watchlist } : {}),
    ...(c.notes ?? a.notes ? { notes: c.notes ?? a.notes } : {}),
  };
}

/**
 * Everything the True North prompt's "Derived" section named, from the working material as it stands. A key whose
 * inputs are not there yet is left out — never emptied — so a partial True North derives a partial North Star and the
 * statement fills in blank by blank.
 */
export function deriveTrueNorth(tn: JhgTrueNorth | null | undefined, identity: JhgIdentity | null | undefined): DerivedTrueNorth {
  if (!tn) return {};
  const b = tn.boundaries ?? {};
  let out = merge(derivePay(b), derivePlace(b));

  // Work rights, as the policy reads them.
  const rights: Record<string, unknown> = {};
  if (b.visaStatus) rights.visaStatus = b.visaStatus;
  if (b.authorizedIn?.length) rights.authorizedIn = b.authorizedIn;
  if (b.needsSponsorship === "Y" || b.needsSponsorship === "N") rights.needsSponsorship = b.needsSponsorship === "Y";
  if (Object.keys(rights).length) out = merge(out, { policy: rights });
  if (b.negotiationLines?.length) out = merge(out, { personalization: { negotiationScripts: b.negotiationLines.slice(0, CAPS.negotiationScripts) } });

  // The North Star: the primary cluster's level and first title; the first industry's first sub-sector; the company type; the city.
  const goal: Record<string, string> = {};
  const primary = (tn.clusters ?? []).find((c) => c.fit === "primary");
  if (primary) {
    const role = `${primary.level ?? ""} ${primary.titles?.[0] ?? ""}`.trim();
    if (role) goal.role = role;
    if (primary.level?.trim()) goal.seniority = primary.level.trim();
  }
  const sub = tn.industries?.[0]?.subSectors?.[0]?.name?.trim();
  if (sub) goal.subsector = sub;
  if (tn.companyType?.trim()) goal.companyType = tn.companyType.trim();
  if (identity?.location?.trim()) goal.city = identity.location.trim();
  if (Object.keys(goal).length) out = merge(out, { goal });

  // One target role per cluster, within the caps.
  const clusters = tn.clusters ?? [];
  if (clusters.length) {
    const targetRoles = clusters.slice(0, CAPS.targetRoles).map((c) => ({
      archetype: clip(c.titles?.[0] ?? c.name, CAPS.archetype),
      axes: clip(`${(c.axes ?? []).join(", ")}; ${c.name}`.replace(/^; /, ""), CAPS.axes),
      buys: clip(c.buys, CAPS.buys),
    }));
    out = merge(out, { personalization: { targetRoles } });
  }

  // The Scout's keywords.
  if (tn.titles?.target?.length) out = merge(out, { watchlist: { positive: tn.titles.target, negative: [...(tn.titles.exclude ?? []), ...(b.excludeLevels ?? [])] } });

  const notes = notesBlock(b);
  if (notes) out = merge(out, { notes });
  return out;
}
