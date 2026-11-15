import { describe, it, expect } from "vitest";
import { ACCOUNT_FIELDS, MEMBER_COLLECTIONS, collectionsForScope, isResetScope, summaryLine, type MemberDataSummary } from "@/lib/member-data";

// Admin → Member data: the one list of a member's collections, the two reset scopes, the line the confirm quotes.

describe("a member's data", () => {
  it("names every per-member subcollection the app writes, once", () => {
    const keys = MEMBER_COLLECTIONS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ["careerOps", "coachSessions", "engineJobs", "claudeUsage", "shares", "opportunities", "contacts", "careerOpsVault", "feedback"]) expect(keys).toContain(k);
  });

  it("resets the coach alone, or everything; the account's identity survives a full reset", () => {
    expect(collectionsForScope("coach")).toEqual(["coachSessions", "engineJobs", "claudeUsage"]);
    expect(collectionsForScope("all")).toEqual(MEMBER_COLLECTIONS.map((c) => c.key));
    expect(ACCOUNT_FIELDS).toEqual(["email", "firstName", "lastName", "createdAt"]);
    expect(isResetScope("coach")).toBe(true);
    expect(isResetScope("profile")).toBe(false);
  });

  it("quotes the real counts in the confirm line, scoped", () => {
    const s: MemberDataSummary = { uid: "u1", email: "m@x.io", counts: { coachSessions: 3, opportunities: 12 }, hasAccount: true, hasGrant: true, hasAuthUser: true };
    expect(summaryLine(s)).toBe("3 coach conversations · 12 opportunities");
    expect(summaryLine(s, "coach")).toBe("3 coach conversations");
    expect(summaryLine({ ...s, counts: {} })).toBe("nothing stored");
  });
});
