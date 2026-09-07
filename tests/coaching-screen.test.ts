import { describe, it, expect } from "vitest";
import {
  COACHING_COLUMN_HEIGHT, COACHING_EMOJI, COACHING_LIMITS, COACHING_LIST_LIMITS, DEFAULT_COACHING_SCREEN,
  charCount, estimateCoachingScreenHeight, isHttpsUrl, mergeCoachingScreen, normalizeCoachingScreen, validateCoachingScreen,
  type CoachingScreenContent,
} from "@/lib/coaching-screen";

const seed = (): CoachingScreenContent => structuredClone(DEFAULT_COACHING_SCREEN);
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

describe("coaching screen — seed copy", () => {
  it("is valid with no warnings and every string inside its soft limit", () => {
    const v = validateCoachingScreen(seed());
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
  });

  it("only uses emoji from the brand set", () => {
    for (const it of [...DEFAULT_COACHING_SCREEN.benefits, ...DEFAULT_COACHING_SCREEN.entitlements]) {
      expect(COACHING_EMOJI).toContain(it.emoji);
    }
  });
});

describe("validateCoachingScreen — required fields", () => {
  it("flags every blank text field and trims whitespace-only values", () => {
    const c = seed();
    c.headline.line1 = "   ";
    c.subhead = "";
    c.cta.label = " ";
    c.ctaCaption = "";
    c.benefits[0].title = "";
    c.entitlements[0].body = "\n";
    const v = validateCoachingScreen(c);
    expect(v.ok).toBe(false);
    expect(paths(v.errors)).toEqual(expect.arrayContaining([
      "headline.line1", "subhead", "cta.label", "ctaCaption", "benefits.0.title", "entitlements.0.body",
    ]));
  });

  it("normalises by trimming strings", () => {
    const n = normalizeCoachingScreen({ ...seed(), subhead: "  hi  ", cta: { label: " Go ", url: " https://x.io " } });
    expect(n.subhead).toBe("hi");
    expect(n.cta).toEqual({ label: "Go", url: "https://x.io" });
  });
});

describe("validateCoachingScreen — CTA url", () => {
  it.each(["https://jobhackers.global", "https://jobhackers.global/book?x=1#y"])("accepts %s", (url) => {
    expect(isHttpsUrl(url)).toBe(true);
    const c = seed(); c.cta.url = url;
    expect(validateCoachingScreen(c).ok).toBe(true);
  });

  it.each(["http://jobhackers.global", "jobhackers.global", "/book", "javascript:alert(1)", "mailto:hi@x.io", "https://"])(
    "rejects %s", (url) => {
      expect(isHttpsUrl(url)).toBe(false);
      const c = seed(); c.cta.url = url;
      const v = validateCoachingScreen(c);
      expect(v.ok).toBe(false);
      expect(paths(v.errors)).toContain("cta.url");
    }
  );
});

describe("validateCoachingScreen — list limits", () => {
  it("requires 2–4 benefits", () => {
    const one = seed(); one.benefits = one.benefits.slice(0, 1);
    expect(paths(validateCoachingScreen(one).errors)).toContain("benefits");

    const five = seed(); five.benefits = [...five.benefits, five.benefits[0], five.benefits[1]];
    expect(five.benefits).toHaveLength(5);
    expect(paths(validateCoachingScreen(five).errors)).toContain("benefits");

    const four = seed(); four.benefits = [...four.benefits, four.benefits[0]];
    expect(validateCoachingScreen(four).ok).toBe(true);
    const two = seed(); two.benefits = two.benefits.slice(0, 2);
    expect(validateCoachingScreen(two).ok).toBe(true);
  });

  it("requires 1–6 entitlements", () => {
    const none = seed(); none.entitlements = [];
    expect(paths(validateCoachingScreen(none).errors)).toContain("entitlements");

    const seven = seed(); seven.entitlements = Array(7).fill(seven.entitlements[0]);
    expect(paths(validateCoachingScreen(seven).errors)).toContain("entitlements");

    const six = seed(); six.entitlements = Array(6).fill(six.entitlements[0]);
    expect(validateCoachingScreen(six).ok).toBe(true);
    expect(COACHING_LIST_LIMITS).toEqual({ benefits: { min: 2, max: 4 }, entitlements: { min: 1, max: 6 } });
  });

  it("rejects emoji outside the brand set (and accepts the variation-selector form)", () => {
    const bad = seed(); bad.benefits[0].emoji = "🚀";
    expect(paths(validateCoachingScreen(bad).errors)).toContain("benefits.0.emoji");
    const vs = seed(); vs.entitlements[0].emoji = "🗣"; // without U+FE0F
    expect(validateCoachingScreen(vs).ok).toBe(true);
  });
});

describe("validateCoachingScreen — soft character limits", () => {
  it("exposes the agreed limits", () => {
    expect(COACHING_LIMITS).toEqual({
      headlineLine1: 12, headlineLine2: 40, headlineLine3: 12, subhead: 120,
      benefitTitle: 24, benefitBody: 90, entitlementTitle: 24, entitlementBody: 130, ctaLabel: 28, ctaCaption: 60,
    });
  });

  it("warns (does not block) when a field passes its soft limit", () => {
    const c = seed();
    c.headline.line2 = "x".repeat(COACHING_LIMITS.headlineLine2 + 1);
    c.benefits[1].body = "y".repeat(COACHING_LIMITS.benefitBody + 5);
    c.entitlements[0].title = "z".repeat(COACHING_LIMITS.entitlementTitle + 1);
    const v = validateCoachingScreen(c);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(paths(v.warnings)).toEqual(["headline.line2", "benefits.1.body", "entitlements.0.title"]);
  });

  it("does not warn exactly at the limit, and counts emoji / dashes as one character", () => {
    const c = seed();
    c.headline.line1 = "a".repeat(COACHING_LIMITS.headlineLine1);
    expect(validateCoachingScreen(c).warnings).toEqual([]);
    expect(charCount("🗣️ — ok")).toBe(6);
  });
});

describe("mergeCoachingScreen — what the app renders", () => {
  it("falls back to the seed when nothing is published", () => {
    expect(mergeCoachingScreen(undefined)).toEqual(DEFAULT_COACHING_SCREEN);
    expect(mergeCoachingScreen(null)).toEqual(DEFAULT_COACHING_SCREEN);
  });

  it("back-fills blank pieces and unsafe URLs from the seed but keeps published values", () => {
    const m = mergeCoachingScreen({
      headline: { line1: "Win", line2: "", line3: "Now!" },
      subhead: "Custom subhead",
      benefits: [{ emoji: "🎯", title: "A", body: "a" }],   // below the minimum → seed rows
      entitlements: [{ emoji: "💡", title: "One", body: "one" }, { emoji: "🔥", title: "Two", body: "two" }],
      cta: { label: "Go", url: "http://insecure" },
      ctaCaption: "",
    });
    expect(m.headline).toEqual({ line1: "Win", line2: DEFAULT_COACHING_SCREEN.headline.line2, line3: "Now!" });
    expect(m.subhead).toBe("Custom subhead");
    expect(m.benefits).toEqual(DEFAULT_COACHING_SCREEN.benefits);
    expect(m.entitlements).toHaveLength(2);
    expect(m.cta).toEqual({ label: "Go", url: DEFAULT_COACHING_SCREEN.cta.url });
    expect(m.ctaCaption).toBe(DEFAULT_COACHING_SCREEN.ctaCaption);
  });
});

describe("390×844 layout model", () => {
  it("leaves ≈670px for the content column between header and tab bar", () => {
    expect(COACHING_COLUMN_HEIGHT).toBe(844 - 44 - 56 - 58);
    expect(COACHING_COLUMN_HEIGHT).toBeGreaterThanOrEqual(660);
    expect(COACHING_COLUMN_HEIGHT).toBeLessThanOrEqual(690);
  });

  it("the seed copy fits without scrolling, with headroom for the fourth benefit", () => {
    const e = estimateCoachingScreenHeight(seed());
    expect(e.fits).toBe(true);
    expect(e.height).toBeLessThanOrEqual(e.available);

    const four = seed();
    four.benefits.push({ emoji: "🎯", title: "Stay focused", body: "One clear next step every week, no more scattered effort." });
    expect(estimateCoachingScreenHeight(four).fits).toBe(true);
  });

  it("copy well past the soft limits overflows the column", () => {
    const c = seed();
    c.subhead = "s".repeat(COACHING_LIMITS.subhead * 2);
    c.benefits = c.benefits.map((b) => ({ ...b, body: "b".repeat(COACHING_LIMITS.benefitBody * 2) }));
    c.entitlements = [c.entitlements[0], { ...c.entitlements[0], body: "e".repeat(COACHING_LIMITS.entitlementBody * 2) }];
    const e = estimateCoachingScreenHeight(c);
    expect(e.fits).toBe(false);
    expect(e.height).toBeGreaterThan(e.available);
  });
});
