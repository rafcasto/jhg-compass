import { describe, it, expect } from "vitest";
import { COACH_PARTS, coachPart } from "@/lib/engine/coach/parts";
import { COACHES } from "@/lib/engine/coach/keys";
import type { ProfileFile } from "@/lib/careerops/profile-file";

// The Part line (docs/UX_COACH_AGENTIC.md §1): where the conversation is, from the stored keys, zero tokens.

describe("the Part line", () => {
  it("has the prompt's own headings for every coach, in order", () => {
    for (const c of COACHES) expect(COACH_PARTS[c.key].length).toBeGreaterThan(1);
    expect(COACH_PARTS.trueNorth.map((p) => p.label)).toEqual(["Part A · Boundaries", "Part B · What the market posts", "Part C · Industries and the North Star"]);
    expect(COACH_PARTS.targetCompanies.map((p) => p.label)[3]).toBe("Part D · Top 3");
  });

  it("names the first part not yet stored, then Hand over, then nothing once complete", () => {
    const empty: ProfileFile = { version: 1 };
    expect(coachPart("trueNorth", empty)).toBe("Part A · Boundaries");
    expect(coachPart("trueNorth", { version: 1, jhg: { trueNorth: { boundaries: { currency: "NZD" } } } })).toBe("Part B · What the market posts");
    expect(coachPart("trueNorth", { version: 1, jhg: { trueNorth: { boundaries: { currency: "NZD" }, postings: [{ title: "PM" }] } } })).toBe("Part B · What the market posts");
    expect(coachPart("trueNorth", { version: 1, jhg: { trueNorth: { boundaries: { currency: "NZD" }, clusters: [{ name: "Builder" }] } } })).toBe("Part C · Industries and the North Star");
    expect(coachPart("trueNorth", { version: 1, goal: { role: "PM" }, jhg: { trueNorth: { boundaries: { currency: "NZD" }, clusters: [{ name: "Builder" }], industries: [{ name: "Climate" }] } } })).toBe("Hand over");
    expect(coachPart("trueNorth", empty, true)).toBeNull();
    expect(coachPart("narrative", { version: 1, contact: { phone: "1" }, narrative: { superpowers: ["a"] } })).toBe("3 · Your headline");
    expect(coachPart("masterCv", { version: 1, cv: "# CV\n## Work Experience\nx" })).toBe("Write it, section by section");
    expect(coachPart("masterCv", { version: 1, contact: { title: "PM" }, cv: "# CV\n## Work Experience\nx\n## Skills\ny" })).toBe("Hand over");
    expect(coachPart("linkedin", { version: 1, linkedin: { headline: "h", about: "a" } })).toBe("Experience");
    const forty = Array.from({ length: 40 }, (_, i) => ({ name: `C${i}` }));
    expect(coachPart("targetCompanies", { version: 1, jhg: { targetCompanies: { companies: forty } } })).toBe("Part B · Fit scores");
    expect(coachPart("targetCompanies", { version: 1, jhg: { targetCompanies: { companies: forty.map((c) => ({ ...c, scores: { total: 12 } })) } } })).toBe("Part C · Top 10 and careers pages");
  });
});

// The page reads result-first (Top 3 · Top 10 · Top 40); the conversation keeps the work's order. A member who opens the
// coach from an empty Top 3 is told where it comes from and kept on Part A.
import { SECTION_PARTS, currentPartIndex, steerNote } from "@/lib/engine/coach/parts";
import { contextNote } from "@/lib/engine/coach/turn";

describe("steerNote", () => {
  const fresh = { version: 1 } as const;
  const scored = { version: 1, jhg: { targetCompanies: { companies: Array.from({ length: 40 }, (_, i) => ({ name: `Co ${i}`, scores: { total: 12 } })) } } } as const;
  it("maps the Target companies sections to the parts that produce them", () => {
    expect(SECTION_PARTS.targetCompanies).toEqual({ top40: 0, companies: 2, top10: 2, top3: 3 });
    expect(currentPartIndex("targetCompanies", fresh)).toBe(0);
    expect(currentPartIndex("targetCompanies", scored)).toBe(2);
  });
  it("steers a coach opened from an empty Top 3 back to Part A, in the operator's words", () => {
    const line = steerNote("targetCompanies", "top3", fresh);
    expect(line).toContain("opened you from the empty Top 3 section — that is Part D · Top 3");
    expect(line).toContain("You are on Part A · The 40");
    expect(line).toContain("Do not start on Top 3.");
    expect(contextNote({ page: "companies", section: "top3", steer: line })).toBe(`The member is looking at Target companies · Top 3.\n\n${line}`);
  });
  it("says nothing for the current part, an earlier part, an unknown section, or no section", () => {
    expect(steerNote("targetCompanies", "top40", fresh)).toBeNull();
    expect(steerNote("targetCompanies", "top10", scored)).toBeNull();
    expect(steerNote("targetCompanies", "top40", scored)).toBeNull();
    expect(steerNote("targetCompanies", "top3", scored)).toContain("Part D · Top 3");
    expect(steerNote("narrative", "headline", fresh)).toBeNull();
    expect(steerNote("targetCompanies", null, fresh)).toBeNull();
    expect(steerNote("trueNorth", "industry", fresh)).toContain("Part C · Industries and the North Star");
    expect(steerNote("trueNorth", "salary", fresh)).toBeNull();
  });
});
