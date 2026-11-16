import { describe, it, expect } from "vitest";
import { ACCOUNT_FIELDS, MEMBER_COLLECTIONS, actLine, collectionsForScope, isResetScope, summaryLine, unknownCollections, type MemberDataSummary } from "@/lib/member-data";

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
    // Exactly what registration writes (lib/server/registration.ts) — nothing onboarding adds survives, so onboarding shows again.
    expect(ACCOUNT_FIELDS).toEqual(["email", "firstName", "lastName", "createdAt"]);
    for (const f of ["onboardedAt", "goal", "country", "archetype", "compass", "goalUpdatedAt"]) expect(ACCOUNT_FIELDS as readonly string[]).not.toContain(f);
    expect(isResetScope("coach")).toBe(true);
    expect(isResetScope("profile")).toBe(false);
  });

  it("quotes the real counts in the confirm line, scoped", () => {
    const s: MemberDataSummary = { uid: "u1", email: "m@x.io", counts: { coachSessions: 3, opportunities: 12 }, hasAccount: true, hasGrant: true, hasAuthUser: true, accountExtras: [], acts: [], present: ["coachSessions", "opportunities"] };
    expect(summaryLine(s)).toBe("3 coach conversations · 12 opportunities");
    expect(summaryLine(s, "coach")).toBe("3 coach conversations");
    expect(summaryLine({ ...s, counts: {} })).toBe("nothing stored");
  });

  it("tells one act in one line — what it removed, and what it STILL HOLDS when it did not do what it said", () => {
    expect(actLine({ action: "reset", scope: "all", at: 1, by: "a@x.io", removed: ["careerOps", "coachSessions"], remaining: [] })).toBe("Reset to new member · removed careerOps, coachSessions");
    expect(actLine({ action: "reset", scope: "coach", at: 1, by: "a@x.io", removed: [] })).toBe("Reset coach · nothing to remove");
    expect(actLine({ action: "reset", scope: "all", at: 1, by: "a@x.io", removed: [], remaining: ["careerOps"] })).toBe("Reset to new member · nothing to remove · STILL HOLDS careerOps");
    expect(actLine({ action: "delete", at: 1, by: "a@x.io" })).toBe("Deleted");
  });
});

describe("unknownCollections", () => {
  it("names only the subcollections the reset's list lacks", () => {
    expect(unknownCollections(["careerOps", "profileFiles", "contacts", "scratch"])).toEqual(["profileFiles", "scratch"]);
    expect(unknownCollections([])).toEqual([]);
  });
});
