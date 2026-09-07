"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { CoachingScreenContent } from "@/lib/coaching-screen";

interface Props {
  content: CoachingScreenContent;
  /** Extra class on the root — the page and the preview size the column differently. */
  className?: string;
  style?: CSSProperties;
  onCtaClick?: () => void;
  /**
   * Reports whether the stacked content fits inside the column without scrolling.
   * Measured from the real DOM (scrollHeight vs clientHeight) and re-checked when
   * the content, the column, or the fonts change.
   */
  onFitChange?: (fits: boolean) => void;
}

// The Coaching tab. Renders whatever content it's given — the page passes the
// published copy, the admin editor passes the draft — so the preview is exactly
// what ships. Layout is a fixed-height column: vertical slack is absorbed by the
// benefit rows (flex:1 + space-evenly), never dumped above the CTA.
export default function CoachingScreen({ content, className = "", style, onCtaClick, onFitChange }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!onFitChange) return;
    const el = ref.current;
    if (!el) return;
    const check = () => onFitChange(el.scrollHeight <= el.clientHeight + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    // Observe the children too: the root's box is fixed, only its content grows.
    const ro = new ResizeObserver(check);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [content, onFitChange]);

  const { headline, subhead, benefits, entitlements, cta, ctaCaption } = content;

  return (
    <section ref={ref} className={`coaching-screen ${className}`} style={style} aria-labelledby="coaching-headline">
      <h1 id="coaching-headline" className="coaching-headline">
        <span className="coaching-headline-1">{headline.line1}</span>
        <span className="coaching-headline-2">{headline.line2}</span>
        <span className="coaching-headline-3">{headline.line3}</span>
      </h1>
      <p className="coaching-subhead">{subhead}</p>

      <ul className="coaching-benefits" aria-label="What you get">
        {benefits.map((b, i) => (
          <li key={i} className="coaching-benefit">
            <span className="coaching-benefit-emoji" aria-hidden>{b.emoji}</span>
            <div className="min-w-0">
              <p className="coaching-benefit-title">{b.title}</p>
              <p className="coaching-benefit-body">{b.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <ul className="coaching-card" aria-label="Included with coaching">
        {entitlements.map((e, i) => (
          <li key={i} className="coaching-entitlement">
            <span className="coaching-entitlement-emoji" aria-hidden>{e.emoji}</span>
            <div className="min-w-0">
              <p className="coaching-entitlement-title">{e.title}</p>
              <p className="coaching-entitlement-body">{e.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="coaching-cta-wrap">
        <a className="coaching-cta" href={cta.url} target="_blank" rel="noopener noreferrer" onClick={onCtaClick}>
          {cta.label}
        </a>
        <p className="coaching-caption">{ctaCaption}</p>
      </div>
    </section>
  );
}
