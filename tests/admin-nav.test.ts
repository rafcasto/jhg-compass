import { describe, it, expect } from "vitest";
import { TABS, adminHash, firstSub, parseAdminHash } from "@/components/admin/nav";

describe("admin navigation", () => {
  it("has exactly the four top-level tabs, in order", () => {
    expect(TABS.map((t) => t.label)).toEqual(["TOFU", "Lead magnet CMS", "User interactions", "Analytics"]);
  });
  it("the CMS mirrors the four member-facing tabs in the same order", () => {
    expect(TABS[1].subs.map((s) => s.key)).toEqual(["compass", "performance", "progress", "coaching"]);
  });
  it("parses a hash and round-trips it", () => {
    const loc = parseAdminHash("#cms/progress");
    expect(loc).toEqual({ tab: "cms", sub: "progress" });
    expect(adminHash(loc)).toBe("#cms/progress");
  });
  it("falls back to the first tab / first sub-tab for junk", () => {
    expect(parseAdminHash("")).toEqual({ tab: "tofu", sub: firstSub("tofu") });
    expect(parseAdminHash("#dashboard")).toEqual({ tab: "tofu", sub: "landing" });
    expect(parseAdminHash("#analytics/nope")).toEqual({ tab: "analytics", sub: "quiz" });
  });
});
