"use client";

import { useEffect, useMemo, useState } from "react";
import { TEXT_FIELDS } from "@/lib/content";
import { DEFAULT_ARTICLES_CONFIG, STEP_COLORS, normalizeStepSlug, type Article, type ArticlesConfig } from "@/lib/ghost";
import type { Goal } from "@/lib/goal";
import type { ContentConfig } from "@/lib/types";
import CompassGoal from "@/components/compass/CompassGoal";
import ArticlesCarousel from "@/components/compass/ArticlesCarousel";
import ArticlesPicker, { type PostRow, type TagOpt } from "./ArticlesPicker";
import {
  authed, postJson, AuditLine, EditorLayout, Loading, PhoneFrame, PreviewAside, SaveBar, Section, TextFields, type Notice,
} from "@/components/admin/shared";

const COMPASS_FIELDS = TEXT_FIELDS.filter((f) => f.group === "Compass tab" && !f.key.startsWith("compass.articles"));
const RAIL_FIELDS = TEXT_FIELDS.filter((f) => f.key.startsWith("compass.articles"));
const NAV_FIELDS = TEXT_FIELDS.filter((f) => f.group === "Navigation");
const KEYS = new Set([...COMPASS_FIELDS, ...RAIL_FIELDS, ...NAV_FIELDS].map((f) => f.key));

// Sample objective so the preview's goal statement reads like a real member's.
const SAMPLE_GOAL: Goal = { role: "Senior Product Manager", subsector: "climate-tech SaaS", companyType: "Scaleup (established)", city: "Auckland, New Zealand", salary: "180,000 – 220,000" };

// Everything a member sees on the Compass tab: header + goal statement copy, the
// reading rail (which Ghost posts + its heading) and the four tab names. One save.
export default function CompassCms() {
  const [cfg, setCfg] = useState<ContentConfig | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: number | null; updatedBy: string | null } | null>(null);
  const [articles, setArticles] = useState<ArticlesConfig>(DEFAULT_ARTICLES_CONFIG);
  const [tags, setTags] = useState<TagOpt[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [ghostOk, setGhostOk] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    authed("/api/admin/content").then((r) => r.json()).then((d) => { if (d.ok) { setCfg(d.content); setMeta(d.meta ?? null); } });
    authed("/api/admin/articles").then((r) => r.json()).then((d) => {
      if (d.ok) { setArticles(d.config); setTags(d.tags); setPosts(d.posts); setGhostOk(d.ghostConfigured); }
    }).catch(() => setGhostOk(false));
  }, []);

  const t = (k: string) => cfg?.text[k] ?? "";
  const setText = (key: string, value: string) => { setCfg((c) => (c ? { ...c, text: { ...c.text, [key]: value } } : c)); setDirty(true); setNotice(null); };
  const setArticlesCfg = (c: ArticlesConfig) => { setArticles(c); setDirty(true); setNotice(null); };

  // What the rail will show for the current picker state — real Ghost posts.
  const previewArticles = useMemo<Article[]>(() => {
    const chosen = articles.mode === "manual"
      ? articles.postIds.map((id) => posts.find((p) => p.id === id)).filter((p): p is PostRow => !!p)
      : posts.filter((p) => p.tags.includes(articles.tag));
    return chosen.slice(0, articles.limit).map((p) => {
      const slug = p.tags.find((tg) => STEP_COLORS[normalizeStepSlug(tg)]);
      return {
        id: p.id, title: p.title, url: p.url, image: null, readingTime: null, publishedAt: p.published_at,
        step: slug ? { slug: normalizeStepSlug(slug), label: slug, color: STEP_COLORS[normalizeStepSlug(slug)] } : null,
      };
    });
  }, [articles, posts]);

  async function save() {
    if (!cfg) return;
    setBusy(true); setNotice(null);
    const text: Record<string, string> = {};
    for (const k of KEYS) text[k] = cfg.text[k] ?? "";
    try {
      const [rc, ra] = await Promise.all([postJson("/api/admin/content", { content: { text } }), postJson("/api/admin/articles", articles)]);
      const dc = await rc.json(); const da = await ra.json();
      if (dc.ok && da.ok) { setCfg(dc.content); setMeta(dc.meta ?? null); setArticles(da.config); setDirty(false); setNotice({ kind: "ok", text: "Saved — live for members now." }); }
      else setNotice({ kind: "err", text: "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(false); }
  }

  if (!cfg) return <Loading>Loading Compass tab…</Loading>;

  return (
    <div className="space-y-6">
      <EditorLayout
        form={
          <>
            <Section title="Header & goal statement" help="The member's objective. The statement itself is built from their answers — you edit the framing around it.">
              <TextFields fields={COMPASS_FIELDS} text={cfg.text} onChange={setText} idPrefix="cms-compass" />
            </Section>
            <Section title="Reading rail" help="Articles from jobhackers.global shown under the goal. Members see changes within a few minutes (10-minute Ghost cache).">
              <TextFields fields={RAIL_FIELDS} text={cfg.text} onChange={setText} idPrefix="cms-rail" />
              <ArticlesPicker cfg={articles} onChange={setArticlesCfg} tags={tags} posts={posts} ghostOk={ghostOk} />
            </Section>
            <Section title="Tab names" help="The four labels in the bottom bar (and the desktop sidebar).">
              <TextFields fields={NAV_FIELDS} text={cfg.text} onChange={setText} idPrefix="cms-nav" />
            </Section>
          </>
        }
        preview={
          <PreviewAside caption={<span className="text-xs text-jh-mute">Real components · sample member</span>}>
            <PhoneFrame active="compass" labels={{ compass: t("nav.compass"), performance: t("nav.performance"), tracker: t("nav.tracker"), coaching: t("nav.coaching") }}>
              <div className="space-y-8">
                <CompassGoal goal={SAMPLE_GOAL} onSave={() => {}}
                  labels={{ eyebrow: t("compass.eyebrow"), title: t("compass.title"), goalEyebrow: t("compass.goalEyebrow"), editTitle: t("compass.editTitle"), editIntro: t("compass.editIntro") }} />
                {previewArticles.length > 0
                  ? <ArticlesCarousel articles={previewArticles} eyebrow={t("compass.articlesEyebrow")} title={t("compass.articlesTitle")} />
                  : <p className="text-xs text-jh-mute text-center">No articles match — the rail is hidden on the real screen too.</p>}
              </div>
            </PhoneFrame>
          </PreviewAside>
        }
      />
      <SaveBar onSave={save} busy={busy} dirty={dirty} notice={notice} label="Save Compass tab"
        audit={<AuditLine updatedAt={meta?.updatedAt} updatedBy={meta?.updatedBy} />} />
    </div>
  );
}
