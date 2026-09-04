import { describe, it, expect } from "vitest";
import { mapPost, mapPosts, mergeArticlesConfig, readingTimeLabel, stepFromTags, normalizeStepSlug, STEP_COLORS, type GhostPost } from "@/lib/ghost";

const base: GhostPost = {
  id: "6a814763cf8ed83859b7f381",
  title: "How Job Hunters Become JobHackers",
  slug: "how",
  url: "https://jobhackers.global/how/",
  feature_image: "https://jobhackers.global/content/images/x.png",
  reading_time: 4,
  published_at: "2026-08-01T00:00:00.000Z",
  tags: [{ name: "1. Focus 🧭", slug: "1-focus", visibility: "public" }, { name: "#docs", slug: "hash-docs", visibility: "internal" }],
};

describe("Ghost mapping", () => {
  it("maps a full post", () => {
    expect(mapPost(base)).toEqual({
      id: base.id, title: base.title, url: base.url, image: base.feature_image, readingTime: 4,
      step: { slug: "focus", label: "1. Focus 🧭", color: "#c2001f" }, publishedAt: base.published_at,
    });
  });

  it("missing feature_image -> image null (renders the neutral block, never a broken img)", () => {
    expect(mapPost({ ...base, feature_image: null }).image).toBeNull();
    expect(mapPost({ ...base, feature_image: undefined }).image).toBeNull();
    expect(mapPost({ ...base, feature_image: "" }).image).toBeNull();
  });

  it("missing reading_time -> null and the label is hidden", () => {
    expect(mapPost({ ...base, reading_time: null }).readingTime).toBeNull();
    expect(mapPost({ ...base, reading_time: undefined }).readingTime).toBeNull();
    expect(readingTimeLabel(null)).toBeNull();
    expect(readingTimeLabel(4)).toBe("4 min read");
    expect(mapPost({ ...base, reading_time: 0 }).readingTime).toBe(1); // never "0 min read"
  });

  it("missing / unknown tag -> step null (dot + label row hidden)", () => {
    expect(mapPost({ ...base, tags: [] }).step).toBeNull();
    expect(mapPost({ ...base, tags: null }).step).toBeNull();
    expect(mapPost({ ...base, tags: [{ name: "News", slug: "news" }] }).step).toBeNull();
    // only internal tags -> still hidden
    expect(mapPost({ ...base, tags: [{ name: "#docs", slug: "hash-docs", visibility: "internal" }] }).step).toBeNull();
  });

  it("uses the first public tag and skips internal ones", () => {
    const step = stepFromTags([
      { name: "#landing", slug: "hash-landing", visibility: "internal" },
      { name: "6. Interviews ✅", slug: "6-interviews", visibility: "public" },
      { name: "1. Focus 🧭", slug: "1-focus", visibility: "public" },
    ]);
    expect(step).toEqual({ slug: "interviews", label: "6. Interviews ✅", color: "#7a1ec2" });
  });

  it("maps every design step colour, including numbered and aliased live slugs", () => {
    expect(STEP_COLORS).toEqual({
      focus: "#c2001f", value: "#f08a1c", profile: "#f5d000", applications: "#6bbf6b",
      network: "#0033cc", interviews: "#7a1ec2", deal: "#f08a1c",
    });
    expect(normalizeStepSlug("2-value")).toBe("value");
    expect(normalizeStepSlug("4-outreach")).toBe("network");
    expect(normalizeStepSlug("5-hidden-offers")).toBe("applications");
    expect(normalizeStepSlug("7-deal")).toBe("deal");
    expect(normalizeStepSlug("profile")).toBe("profile");
    expect(stepFromTags([{ name: "8. AI 🦾", slug: "8-ai" }])).toBeNull();
  });

  it("drops malformed posts", () => {
    expect(mapPosts([base, { ...base, id: "" }, null as unknown as GhostPost, { ...base, url: "" }])).toHaveLength(1);
    expect(mapPosts(undefined)).toEqual([]);
  });
});

describe("articles config", () => {
  it("falls back to tag:compass / 12 cards", () => {
    expect(mergeArticlesConfig(null)).toEqual({ mode: "tag", tag: "compass", postIds: [], limit: 12 });
  });
  it("sanitises stored values", () => {
    expect(mergeArticlesConfig({ mode: "manual", postIds: ["a", 3 as unknown as string, ""], limit: 999, tag: " " }))
      .toEqual({ mode: "manual", tag: "compass", postIds: ["a"], limit: 50 });
    expect(mergeArticlesConfig({ mode: "weird" as never, limit: -1 }).mode).toBe("tag");
  });
});
