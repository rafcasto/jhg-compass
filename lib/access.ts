// Access-grant helpers shared by the admin "Access renewals" screen (client) and
// the Admin-SDK writers (server). Pure: no Firebase imports.
//
// A grant's STORED status only flips to "expired" when the member next logs in
// (syncGrant). For the admin list we want the truth right now, so effectiveStatus()
// re-derives it from the timestamps.

import type { AccessGrant, GrantStatus } from "./types";

export const DAY = 86_400_000;
export const DEFAULT_RENEWAL_DAYS = 60;

// One member row on the admin screen — the grant plus what we know of the profile.
export interface MemberAccessRow {
  uid: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  plan?: string | null;
  source?: string | null;
  status: GrantStatus;        // effective (see below)
  storedStatus: GrantStatus;  // what Firestore holds
  durationDays: number;
  startsAt: number | null;
  expiresAt: number | null;
  redeemBy: number | null;
  updatedAt?: number | null;
  renewedAt?: number | null;
  renewedBy?: string | null;
  careerOps: boolean;         // CareerOps portal enabled for this member
}

type GrantLike = Pick<AccessGrant, "status" | "startsAt" | "expiresAt" | "redeemBy">;

export function effectiveStatus(g: GrantLike, now = Date.now()): GrantStatus {
  if (g.status === "pending" && g.redeemBy != null && now > g.redeemBy) return "expired";
  if (g.status === "active" && g.expiresAt != null && now >= g.expiresAt) return "expired";
  return g.status;
}

// The period a renewal of `days` should produce. Members who still have time left
// are extended from their current end date; everyone else starts again from now.
export function renewalPeriod(g: GrantLike | null, days: number, now = Date.now()): { startsAt: number; expiresAt: number } {
  const stillActive = !!g && effectiveStatus(g, now) === "active" && g.expiresAt != null && g.expiresAt > now;
  const startsAt = stillActive ? (g!.startsAt ?? now) : now;
  const base = stillActive ? g!.expiresAt! : now;
  return { startsAt, expiresAt: base + Math.max(1, Math.round(days)) * DAY };
}

// ---- list filtering (admin screen) ----
export const ACCESS_FILTERS = [
  { key: "expired", label: "Expired" },
  { key: "active",  label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "revoked", label: "Revoked" },
  { key: "all",     label: "All" },
] as const;
export type AccessFilter = (typeof ACCESS_FILTERS)[number]["key"];

export const memberName = (r: Pick<MemberAccessRow, "firstName" | "lastName">) =>
  [r.firstName, r.lastName].filter(Boolean).join(" ").trim();

export function filterRows(rows: MemberAccessRow[], filter: AccessFilter, query = ""): MemberAccessRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) =>
    (filter === "all" || r.status === filter) &&
    (!q || r.email.toLowerCase().includes(q) || memberName(r).toLowerCase().includes(q)));
}

export function countByStatus(rows: MemberAccessRow[]): Record<AccessFilter, number> {
  const c: Record<AccessFilter, number> = { expired: 0, active: 0, pending: 0, revoked: 0, all: rows.length };
  for (const r of rows) c[r.status]++;
  return c;
}
