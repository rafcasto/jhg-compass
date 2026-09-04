import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { mapPosts, mergeArticlesConfig, type Article, type ArticlesConfig } from "@/lib/ghost";
import { bustGhostCache, fetchPostsByIds, fetchPostsByTag } from "./ghost";

// Admin curation for the Compass articles rail lives in config/articles:
//   { mode: "tag" | "manual", tag, postIds[], limit }
// Read: any signed-in member (via /api/articles). Write: admins only.

export async function getArticlesConfig(): Promise<ArticlesConfig> {
  try {
    const snap = await adminDb().doc("config/articles").get();
    return mergeArticlesConfig(snap.exists ? (snap.data() as Partial<ArticlesConfig>) : null);
  } catch {
    return mergeArticlesConfig(null);
  }
}

export async function saveArticlesConfig(patch: Partial<ArticlesConfig>, updatedBy?: string): Promise<ArticlesConfig> {
  const clean = mergeArticlesConfig(patch);
  await adminDb().doc("config/articles").set({ ...clean, updatedBy: updatedBy ?? null, updatedAt: Date.now() });
  bustGhostCache(); // admin wants to see the change now, not in 10 minutes
  return clean;
}

// Resolve the rail: curated ids in saved order, or newest posts for a tag.
// Any failure (missing env, Ghost down, bad JSON) resolves to [] — the tab
// renders nothing rather than an error card.
export async function getArticles(): Promise<Article[]> {
  const cfg = await getArticlesConfig();
  try {
    const posts =
      cfg.mode === "manual"
        ? await fetchPostsByIds(cfg.postIds.slice(0, cfg.limit))
        : await fetchPostsByTag(cfg.tag, cfg.limit);
    return mapPosts(posts).slice(0, cfg.limit);
  } catch {
    return [];
  }
}
