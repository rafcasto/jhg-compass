// Ghost Content API — pure mapping helpers. No secrets, safe to import in the
// browser and in tests. Fetching lives in lib/server/ghost.ts.

export interface GhostTag {
  id?: string;
  name: string;
  slug: string;
  visibility?: "public" | "internal";
}

export interface GhostPost {
  id: string;
  title: string;
  slug: string;
  url: string;
  excerpt?: string | null;
  feature_image?: string | null;
  reading_time?: number | null;
  published_at?: string | null;
  tags?: GhostTag[] | null;
}

export interface ArticleStep {
  slug: string;   // normalised step key, e.g. "focus"
  label: string;  // tag name as written in Ghost, e.g. "1. Focus 🧭"
  color: string;  // dot colour
}

export interface Article {
  id: string;
  title: string;
  url: string;
  image: string | null;          // null -> neutral #f3f5fa block (never a broken <img>)
  readingTime: number | null;    // minutes; null -> line hidden
  step: ArticleStep | null;      // null -> dot + label row hidden
  publishedAt: string | null;
}

// Step slug -> dot colour. Ghost tags on jobhackers.global are numbered
// ("1-focus", "4-outreach"…), so slugs are normalised by stripping a leading
// "<n>-" before lookup. Aliases map the live tag names onto the design's steps.
export const STEP_COLORS: Record<string, string> = {
  focus: "#c2001f",
  value: "#f08a1c",
  profile: "#f5d000",
  applications: "#6bbf6b",
  network: "#0033cc",
  interviews: "#7a1ec2",
  deal: "#f08a1c",
};

const STEP_ALIASES: Record<string, string> = {
  outreach: "network",
  "hidden-offers": "applications",
};

export function normalizeStepSlug(slug: string): string {
  const bare = slug.toLowerCase().replace(/^\d+-/, "");
  return STEP_ALIASES[bare] ?? bare;
}

export function stepFromTags(tags?: GhostTag[] | null): ArticleStep | null {
  if (!tags?.length) return null;
  // First *public* tag — Ghost's internal "#tags" are layout hints, not steps.
  const tag = tags.find((t) => t.visibility !== "internal" && !t.name?.startsWith("#") && !t.slug?.startsWith("hash-"));
  if (!tag) return null;
  const slug = normalizeStepSlug(tag.slug);
  const color = STEP_COLORS[slug];
  if (!color) return null;
  return { slug, label: tag.name, color };
}

export function mapPost(p: GhostPost): Article {
  const rt = typeof p.reading_time === "number" && isFinite(p.reading_time) ? Math.max(1, Math.round(p.reading_time)) : null;
  return {
    id: p.id,
    title: p.title,
    url: p.url,
    image: p.feature_image ? p.feature_image : null,
    readingTime: rt,
    step: stepFromTags(p.tags),
    publishedAt: p.published_at ?? null,
  };
}

export function mapPosts(posts: GhostPost[] | null | undefined): Article[] {
  return (posts ?? []).filter((p) => p && p.id && p.title && p.url).map(mapPost);
}

export function readingTimeLabel(minutes: number | null): string | null {
  return minutes == null ? null : `${minutes} min read`;
}

// ---- Admin curation (config/articles) ----
export type ArticlesMode = "tag" | "manual";

export interface ArticlesConfig {
  mode: ArticlesMode;
  tag: string;         // tag slug used when mode === "tag"
  postIds: string[];   // ordered post ids used when mode === "manual"
  limit: number;       // max cards on the rail
}

export const DEFAULT_ARTICLES_CONFIG: ArticlesConfig = {
  mode: "tag",
  tag: "compass",
  postIds: [],
  limit: 12,
};

export function mergeArticlesConfig(stored?: Partial<ArticlesConfig> | null): ArticlesConfig {
  const limit = Number(stored?.limit);
  return {
    mode: stored?.mode === "manual" ? "manual" : "tag",
    tag: (stored?.tag ?? DEFAULT_ARTICLES_CONFIG.tag).trim() || DEFAULT_ARTICLES_CONFIG.tag,
    postIds: Array.isArray(stored?.postIds) ? stored!.postIds.filter((s): s is string => typeof s === "string" && !!s) : [],
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(50, Math.floor(limit)) : DEFAULT_ARTICLES_CONFIG.limit,
  };
}
