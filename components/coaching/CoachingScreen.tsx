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
// what ships. Two groups: the pitch (headline, subhead, CTA) and the offer
// (benefits, entitlements). On a phone they are one fixed-height column (the
// wrappers are display:contents): vertical slack is absorbed by the benefit rows
// (flex:1 + space-evenly), never dumped above the CTA. From 720px of screen width
// (desktop; a container query on the screen's own width, so the admin's 1280×800
// preview gets it too) the pitch sits left and the offer right, the CTA beside the
// headline — see .coaching-* in app/globals.css.
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
    // The group wrappers are display:contents on a phone (no box to observe), so watch their children too.
    el.querySelectorAll(".coaching-stack, .coaching-pitch > *, .coaching-offer > *").forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [content, onFitChange]);

  const { headline, subhead, benefits, entitlements, cta, ctaCaption } = content;

  return (
    <section ref={ref} className={`coaching-screen ${className}`} style={style} aria-labelledby="coaching-headline">
      {/* The screen is the container the queries key on, so the stack — not the screen — switches column → row. */}
      <div className="coaching-stack">
      <div className="coaching-pitch">
        <h1 id="coaching-headline" className="coaching-headline">
          <span className="coaching-headline-1">{headline.line1}</span>
          <span className="coaching-headline-2">{headline.line2}</span>
          <span className="coaching-headline-3">{headline.line3}</span>
        </h1>
        <p className="coaching-subhead">{subhead}</p>
        {/* Desktop: the CTA sits here, beside the headline. Phone: CSS order moves it under the offer. */}
        <div className="coaching-cta-wrap">
          <a className="coaching-cta" href={cta.url} target="_blank" rel="noopener noreferrer" onClick={onCtaClick}>
            {cta.label}
          </a>
          <p className="coaching-caption">{ctaCaption}</p>
        </div>
      </div>

      <div className="coaching-offer">
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
      </div>
      </div>
    </section>
  );
}
