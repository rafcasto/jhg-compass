"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { DEFAULT_ARTICLES_CONFIG, type ArticlesConfig } from "@/lib/ghost";

interface TagOpt { slug: string; name: string }
interface PostRow { id: string; title: string; url: string; published_at: string | null; tags: string[] }

async function authed(url: string, init: RequestInit = {}) {
  const token = await auth.currentUser!.getIdToken();
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
}

// Admin: choose what the Compass "Reading for this step" rail shows —
// either every post carrying a Ghost tag (newest first) or a hand-picked,
// ordered list of posts.
export default function ArticlesTab() {
  const [cfg, setCfg] = useState<ArticlesConfig>(DEFAULT_ARTICLES_CONFIG);
  const [tags, setTags] = useState<TagOpt[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [ghostOk, setGhostOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    authed("/api/admin/articles").then((r) => r.json()).then((d) => {
      if (d.ok) { setCfg(d.config); setTags(d.tags); setPosts(d.posts); setGhostOk(d.ghostConfigured); }
    }).finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const picked = cfg.postIds.map((id) => byId.get(id)).filter((p): p is PostRow => !!p);
  const pickedSet = new Set(cfg.postIds);
  const filtered = posts.filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase()) || p.tags.some((t) => t.includes(q.trim().toLowerCase())));
  const tagCount = posts.filter((p) => p.tags.includes(cfg.tag)).length;

  function patch(p: Partial<ArticlesConfig>) { setCfg((c) => ({ ...c, ...p })); setSaved(false); }
  function toggle(id: string) {
    patch({ postIds: pickedSet.has(id) ? cfg.postIds.filter((x) => x !== id) : [...cfg.postIds, id] });
  }
  function move(id: string, dir: -1 | 1) {
    const i = cfg.postIds.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= cfg.postIds.length) return;
    const next = [...cfg.postIds]; [next[i], next[j]] = [next[j], next[i]];
    patch({ postIds: next });
  }
  async function save() {
    setBusy(true);
    const r = await authed("/api/admin/articles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cfg) });
    const d = await r.json();
    if (d.ok) { setCfg(d.config); setSaved(true); }
    setBusy(false);
  }

  if (loading) return <p className="text-jh-mute animate-pulse">Loading Ghost posts…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2>Compass articles</h2>
        <p className="text-sm text-jh-mute mt-1">Controls the “Reading for this step” carousel on the Compass tab. Members see the change within a few minutes.</p>
        {!ghostOk && <p className="mt-2 text-sm text-jh-red">Ghost isn’t configured — set GHOST_CONTENT_API_URL and GHOST_CONTENT_API_KEY.</p>}
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-display font-semibold">
            <input type="radio" name="mode" checked={cfg.mode === "tag"} onChange={() => patch({ mode: "tag" })} className="accent-jh-red" /> Filter by tag
          </label>
          <label className="flex items-center gap-2 text-sm font-display font-semibold">
            <input type="radio" name="mode" checked={cfg.mode === "manual"} onChange={() => patch({ mode: "manual" })} className="accent-jh-red" /> Hand-pick posts
          </label>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-jh-mute">Max cards</span>
            <input type="number" min={1} max={50} value={cfg.limit} onChange={(e) => patch({ limit: Number(e.target.value) || 12 })} className="field w-20 py-1.5" />
          </label>
        </div>

        {cfg.mode === "tag" ? (
          <div>
            <label className="label">Ghost tag</label>
            <select className="field" value={cfg.tag} onChange={(e) => patch({ tag: e.target.value })}>
              {!tags.some((t) => t.slug === cfg.tag) && <option value={cfg.tag}>{cfg.tag} (no posts / unknown tag)</option>}
              {tags.map((t) => <option key={t.slug} value={t.slug}>{t.name} — {t.slug}</option>)}
            </select>
            <p className="text-xs text-jh-mute mt-1">{tagCount} post{tagCount === 1 ? "" : "s"} carry this tag · newest first.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="label">All posts</label>
              <input className="field mb-2" placeholder="Search title or tag…" value={q} onChange={(e) => setQ(e.target.value)} />
              <ul className="max-h-80 overflow-y-auto divide-y divide-jh-line border border-jh-line rounded-md">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-jh-mist">
                      <input type="checkbox" checked={pickedSet.has(p.id)} onChange={() => toggle(p.id)} className="mt-0.5 accent-jh-red" />
                      <span>
                        <span className="font-medium text-jh-ink">{p.title}</span>
                        {p.tags.length > 0 && <span className="block text-[11px] text-jh-mute-2">{p.tags.join(" · ")}</span>}
                      </span>
                    </label>
                  </li>
                ))}
                {!filtered.length && <li className="px-3 py-3 text-sm text-jh-mute">No posts match.</li>}
              </ul>
            </div>
            <div>
              <label className="label">Selected · in display order ({picked.length})</label>
              {picked.length ? (
                <ol className="divide-y divide-jh-line border border-jh-line rounded-md">
                  {picked.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="w-5 text-jh-mute-2 tabular-nums">{i + 1}.</span>
                      <span className="flex-1 font-medium text-jh-ink">{p.title}</span>
                      <button type="button" aria-label="Move up" onClick={() => move(p.id, -1)} disabled={i === 0} className="p-1 text-jh-mute hover:text-jh-ink disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label="Move down" onClick={() => move(p.id, 1)} disabled={i === picked.length - 1} className="p-1 text-jh-mute hover:text-jh-ink disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" aria-label="Remove" onClick={() => toggle(p.id)} className="p-1 text-jh-mute hover:text-jh-red"><X className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-jh-mute border border-dashed border-jh-line rounded-md px-3 py-6 text-center">Tick posts on the left to build the rail.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "Saving…" : "Save articles"}</button>
        {saved && <span className="text-sm text-rb-green-dark font-semibold">Saved ✓</span>}
      </div>
    </div>
  );
}
