"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { readingTimeLabel, type Article } from "@/lib/ghost";

export const CARD_WIDTH = 268;
export const CARD_GAP = 16;
export const SCROLL_STEP = CARD_WIDTH + CARD_GAP; // one card + gap

interface ScrollMetrics { scrollLeft: number; scrollWidth: number; clientWidth: number }

// Pure helpers (unit-tested): where the rail is, and where an arrow press lands.
export function scrollBounds(m: ScrollMetrics) {
  const max = Math.max(0, m.scrollWidth - m.clientWidth);
  return { atStart: m.scrollLeft <= 1, atEnd: m.scrollLeft >= max - 1, max };
}
export function nextScrollLeft(current: number, dir: -1 | 1, max: number) {
  return Math.min(Math.max(0, current + dir * SCROLL_STEP), Math.max(0, max));
}

interface Props {
  articles: Article[];
  eyebrow?: string;
  title?: string;
}

export default function ArticlesCarousel({ articles, eyebrow = "Sharpen your lane", title = "Reading for this step" }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ atStart: true, atEnd: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const b = scrollBounds(el);
    setBounds({ atStart: b.atStart, atEnd: b.atEnd });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, articles.length]);

  function step(dir: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const { max } = scrollBounds(el);
    const left = nextScrollLeft(el.scrollLeft, dir, max);
    if (typeof el.scrollTo === "function") el.scrollTo({ left, behavior: "smooth" });
    else el.scrollLeft = left;
  }

  if (!articles.length) return null;

  return (
    <section aria-labelledby="articles-title" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 id="articles-title" className="mt-1 text-2xl md:text-[26px]">{title}</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => step(-1)} disabled={bounds.atStart} aria-label="Previous articles" className="cbtn-icon">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </button>
          <button type="button" onClick={() => step(1)} disabled={bounds.atEnd} aria-label="Next articles" className="cbtn-icon">
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={track}
        data-testid="articles-track"
        className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2 pt-1"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
      </div>
    </section>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const [broken, setBroken] = useState(false);
  const showImage = !!article.image && !broken;
  const rt = readingTimeLabel(article.readingTime);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="article-card"
      className="group flex shrink-0 flex-col overflow-hidden rounded-lg border border-jh-line bg-white shadow-jh-1 transition-shadow duration-200 ease-out hover:shadow-jh-3"
      style={{ width: CARD_WIDTH, scrollSnapAlign: "start" }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Ghost images, arbitrary hosts
        <img src={article.image!} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)}
          className="h-[150px] w-full object-cover" />
      ) : (
        <div aria-hidden className="h-[150px] w-full bg-jh-mist" />
      )}
      <div className="flex flex-1 flex-col gap-2 px-[18px] py-4">
        {article.step && (
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: article.step.color }} />
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-jh-mute-2">{article.step.label}</span>
          </div>
        )}
        <h3 className="font-display text-[16px] font-semibold leading-[1.35] text-jh-ink group-hover:text-jh-red transition-colors duration-200 ease-out"
          style={{ textWrap: "pretty" } as React.CSSProperties}>
          {article.title}
        </h3>
        <div className="flex-1" />
        {rt && <p className="font-body text-[13px] text-jh-mute">{rt}</p>}
      </div>
    </a>
  );
}
