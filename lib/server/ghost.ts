import "server-only";
import type { GhostPost, GhostTag } from "@/lib/ghost";

// Ghost Content API client. The key is read-only but still stays server-side:
// the browser only ever talks to /api/articles.
//
// Caching: every Ghost URL is memoised in-process for 10 minutes AND fetched
// through Next's data cache with revalidate=600, so a member hitting the
// Compass tab never fans out to Ghost more than once per 10 minutes per URL.

const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 8_000;

// `html` is required: Ghost only computes `reading_time` when the body is part
// of the selected fields. It is stripped before the post leaves this module.
const POST_FIELDS = "id,title,slug,url,excerpt,feature_image,reading_time,published_at,html";
const SUMMARY_FIELDS = "id,title,slug,url,published_at";

const memo = new Map<string, { at: number; data: unknown }>();

function env(): { url: string; key: string } | null {
  const url = process.env.GHOST_CONTENT_API_URL?.trim().replace(/\/+$/, "");
  const key = process.env.GHOST_CONTENT_API_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

function buildUrl(resource: "posts" | "tags", params: Record<string, string>): string | null {
  const e = env();
  if (!e) return null;
  const u = new URL(`${e.url}/ghost/api/content/${resource}/`);
  u.searchParams.set("key", e.key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function ghostGet<T>(url: string | null): Promise<T | null> {
  if (!url) return null;
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as T & { errors?: unknown[] };
    if (json && Array.isArray(json.errors) && json.errors.length) return null;
    memo.set(url, { at: Date.now(), data: json });
    return json;
  } catch {
    return null;
  }
}

export function bustGhostCache() {
  memo.clear();
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;
const ID_RE = /^[a-f0-9]{24}$/i;

function stripHtml(p: GhostPost & { html?: unknown }): GhostPost {
  const { html: _html, ...rest } = p;
  return rest;
}

// Posts carrying a tag, newest first.
export async function fetchPostsByTag(tag: string, limit = 12): Promise<GhostPost[]> {
  if (!SLUG_RE.test(tag)) return [];
  const json = await ghostGet<{ posts: (GhostPost & { html?: string })[] }>(
    buildUrl("posts", {
      limit: String(Math.min(50, Math.max(1, limit))),
      fields: POST_FIELDS,
      include: "tags",
      filter: `tag:${tag}`,
      order: "published_at desc",
    })
  );
  return (json?.posts ?? []).map(stripHtml);
}

// Hand-picked posts, returned in the order the ids were given.
export async function fetchPostsByIds(ids: string[]): Promise<GhostPost[]> {
  const clean = ids.filter((id) => ID_RE.test(id));
  if (!clean.length) return [];
  const json = await ghostGet<{ posts: (GhostPost & { html?: string })[] }>(
    buildUrl("posts", {
      limit: String(clean.length),
      fields: POST_FIELDS,
      include: "tags",
      filter: `id:[${clean.join(",")}]`,
    })
  );
  const byId = new Map((json?.posts ?? []).map((p) => [p.id, stripHtml(p)]));
  return clean.map((id) => byId.get(id)).filter((p): p is GhostPost => !!p);
}

// Public tags (Ghost's "#internal" tags are layout hints, not content).
export async function fetchPublicTags(): Promise<GhostTag[]> {
  const json = await ghostGet<{ tags: GhostTag[] }>(
    buildUrl("tags", { limit: "all", fields: "id,name,slug,visibility", order: "slug asc" })
  );
  return (json?.tags ?? []).filter((t) => t.visibility !== "internal" && !t.name.startsWith("#"));
}

export interface PostSummary {
  id: string;
  title: string;
  url: string;
  published_at: string | null;
  tags: string[]; // public tag slugs
}

// Lightweight list of every post — used by the admin picker.
export async function fetchAllPostSummaries(): Promise<PostSummary[]> {
  const json = await ghostGet<{ posts: (GhostPost & { tags?: GhostTag[] })[] }>(
    buildUrl("posts", { limit: "all", fields: SUMMARY_FIELDS, include: "tags", order: "published_at desc" })
  );
  return (json?.posts ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    url: p.url,
    published_at: p.published_at ?? null,
    tags: (p.tags ?? []).filter((t) => t.visibility !== "internal").map((t) => t.slug),
  }));
}
