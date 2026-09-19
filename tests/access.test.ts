import { describe, it, expect } from "vitest";
import { DAY, effectiveStatus, renewalPeriod, filterRows, countByStatus, memberName, ACCESS_FILTERS, type MemberAccessRow } from "@/lib/access";
import { EVENT_DEFAULTS } from "@/lib/tags";
import { TOFU_SUBTABS } from "@/components/admin/nav";

const NOW = 1_800_000_000_000;

describe("effectiveStatus", () => {
  it("re-derives expiry from timestamps, not just the stored status", () => {
    expect(effectiveStatus({ status: "active", startsAt: NOW - DAY, expiresAt: NOW + DAY }, NOW)).toBe("active");
    expect(effectiveStatus({ status: "active", startsAt: NOW - 10 * DAY, expiresAt: NOW - 1 }, NOW)).toBe("expired");
    expect(effectiveStatus({ status: "active", startsAt: NOW - DAY, expiresAt: NOW }, NOW)).toBe("expired");
    expect(effectiveStatus({ status: "pending", redeemBy: NOW - 1 }, NOW)).toBe("expired");
    expect(effectiveStatus({ status: "pending", redeemBy: NOW + 1 }, NOW)).toBe("pending");
    expect(effectiveStatus({ status: "revoked", expiresAt: NOW + DAY }, NOW)).toBe("revoked");
    expect(effectiveStatus({ status: "expired" }, NOW)).toBe("expired");
  });
});

describe("renewalPeriod", () => {
  it("starts a fresh period from now for expired / pending / revoked / missing grants", () => {
    for (const g of [
      { status: "expired" as const, startsAt: NOW - 90 * DAY, expiresAt: NOW - 30 * DAY },
      { status: "active" as const, startsAt: NOW - 90 * DAY, expiresAt: NOW - 1 }, // lapsed but not yet synced
      { status: "pending" as const, redeemBy: NOW - 1 },
      { status: "revoked" as const, expiresAt: NOW + 5 * DAY },
      null,
    ]) {
      expect(renewalPeriod(g, 60, NOW)).toEqual({ startsAt: NOW, expiresAt: NOW + 60 * DAY });
    }
  });
  it("extends still-active members from their current end date, keeping their start", () => {
    const g = { status: "active" as const, startsAt: NOW - 10 * DAY, expiresAt: NOW + 5 * DAY };
    expect(renewalPeriod(g, 30, NOW)).toEqual({ startsAt: NOW - 10 * DAY, expiresAt: NOW + 35 * DAY });
  });
  it("never grants less than a day", () => {
    expect(renewalPeriod(null, 0, NOW).expiresAt).toBe(NOW + DAY);
    expect(renewalPeriod(null, 0.4, NOW).expiresAt).toBe(NOW + DAY);
  });
});

const row = (p: Partial<MemberAccessRow> & { uid: string; status: MemberAccessRow["status"] }): MemberAccessRow => ({
  email: `${p.uid}@x.io`, storedStatus: p.status, durationDays: 60, startsAt: null, expiresAt: null, redeemBy: null, careerOps: false, ...p,
});
const rows = [
  row({ uid: "a", status: "expired", firstName: "Ada", lastName: "Lovelace" }),
  row({ uid: "b", status: "active", firstName: "Bob" }),
  row({ uid: "c", status: "expired", email: "carol@acme.com" }),
  row({ uid: "d", status: "pending" }),
  row({ uid: "e", status: "revoked" }),
];

describe("list helpers", () => {
  it("filters by effective status and searches name or email", () => {
    expect(filterRows(rows, "expired").map((r) => r.uid)).toEqual(["a", "c"]);
    expect(filterRows(rows, "all")).toHaveLength(5);
    expect(filterRows(rows, "all", "lovelace").map((r) => r.uid)).toEqual(["a"]);
    expect(filterRows(rows, "expired", "ACME").map((r) => r.uid)).toEqual(["c"]);
    expect(filterRows(rows, "active", "carol")).toEqual([]);
  });
  it("counts per chip", () => {
    expect(countByStatus(rows)).toEqual({ expired: 2, active: 1, pending: 1, revoked: 1, all: 5 });
    expect(ACCESS_FILTERS.map((f) => f.key)).toEqual(["expired", "active", "pending", "revoked", "all"]);
  });
  it("formats a member name", () => {
    expect(memberName(rows[0])).toBe("Ada Lovelace");
    expect(memberName(rows[1])).toBe("Bob");
    expect(memberName(rows[2])).toBe("");
  });
});

describe("wiring", () => {
  it("adds the Access renewals sub-tab under TOFU after Registration & access", () => {
    const keys = TOFU_SUBTABS.map((s) => s.key);
    expect(keys.indexOf("access")).toBe(keys.indexOf("registration") + 1);
    expect(TOFU_SUBTABS.find((s) => s.key === "access")?.label).toBe("Access renewals");
  });
  it("tracks renewals as an activation event", () => {
    expect(EVENT_DEFAULTS.GRANT_RENEWED.stage).toBe("activation");
  });
});
