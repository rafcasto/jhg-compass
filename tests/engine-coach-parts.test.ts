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
