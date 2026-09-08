import { describe, it, expect } from "vitest";
import { DEFAULT_SEGMENTS, QUADRANTS, bucketRespondents, mergeSegments, quadrantFor } from "@/lib/segments";

describe("4-quadrant segmentation", () => {
  it("crosses ICP fit with the propensity threshold", () => {
    expect(quadrantFor("qualified", 6)).toBe("fit-high");
    expect(quadrantFor("qualified", 3)).toBe("fit-high");   // threshold is inclusive
    expect(quadrantFor("qualified", 2)).toBe("fit-low");
    expect(quadrantFor("below-icp", 5)).toBe("nofit-high");
    expect(quadrantFor("below-icp", 0)).toBe("nofit-low");
  });
  it("treats unknown fit / missing score as the coldest bucket", () => {
    expect(quadrantFor("—", null)).toBe("nofit-low");
    expect(quadrantFor(undefined, undefined)).toBe("nofit-low");
  });
  it("honours a custom threshold", () => {
    expect(quadrantFor("qualified", 4, 5)).toBe("fit-low");
    expect(quadrantFor("qualified", 5, 5)).toBe("fit-high");
  });
  it("has one follow-up action per quadrant by default", () => {
    for (const q of QUADRANTS) expect(DEFAULT_SEGMENTS.actions[q.key].title).toBeTruthy();
  });
  it("merges stored config over defaults and clamps the threshold", () => {
    const m = mergeSegments({ propensityThreshold: 42, actions: { "fit-high": { title: "Call now" } } as never });
    expect(m.propensityThreshold).toBe(6);
    expect(m.actions["fit-high"].title).toBe("Call now");
    expect(m.actions["fit-high"].owner).toBe(DEFAULT_SEGMENTS.actions["fit-high"].owner);
    expect(m.actions["nofit-low"]).toEqual(DEFAULT_SEGMENTS.actions["nofit-low"]);
    expect(mergeSegments(null)).toEqual(DEFAULT_SEGMENTS);
  });
  it("buckets respondents", () => {
    const r = (fit: string, score: number | null) => ({ name: "", email: "", archetype: "", score, grade: "", fit, created_at: null, answers: {}, q6: "", other: {} });
    const b = bucketRespondents([r("qualified", 5), r("qualified", 1), r("below-icp", 4), r("below-icp", 0), r("—", null)], 3);
    expect(b["fit-high"]).toHaveLength(1);
    expect(b["fit-low"]).toHaveLength(1);
    expect(b["nofit-high"]).toHaveLength(1);
    expect(b["nofit-low"]).toHaveLength(2);
  });
});
