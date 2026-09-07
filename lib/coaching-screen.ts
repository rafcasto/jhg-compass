// Coaching tab content — single source of truth for the screen's copy.
//
// Everything on the Coaching screen is content, not code: it lives in the
// config/coachingScreen Firestore document as a { draft, published } pair edited
// from Admin → Coaching. This module is pure (no client/server-only imports) so
// the screen, the admin editor, the API route and the tests all share the same
// types, seed copy, limits and validation.

export interface CoachingItem {
  emoji: string;
  title: string;
  body: string;
}

export interface CoachingScreenContent {
  headline: { line1: string; line2: string; line3: string };
  subhead: string;
  /** 2–4 rows, in display order. */
  benefits: CoachingItem[];
  /** 1–6 rows inside the entitlement card, in display order. */
  entitlements: CoachingItem[];
  cta: { label: string; url: string };
  ctaCaption: string;
}

// Stored at config/coachingScreen. The app reads `published`; the editor works on `draft`.
export interface CoachingScreenDoc {
  draft: CoachingScreenContent | null;
  published: CoachingScreenContent | null;
  publishedAt: number | null;
  publishedBy: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

// ---- seed copy (also the fallback when nothing has been published yet) ----
export const DEFAULT_COACHING_SCREEN: CoachingScreenContent = {
  headline: { line1: "Maximize", line2: "your job search with the power of a", line3: "Coach!" },
  subhead: "Hands-on support that keeps you on track — so you land a job you love, at the salary you deserve.",
  benefits: [
    { emoji: "🤝", title: "Held accountable", body: "A weekly call where you report on what you actually did." },
    { emoji: "🏆", title: "Better odds", body: "Your resume, LinkedIn and pitch reviewed by someone who hires." },
    { emoji: "⚡", title: "Go faster", body: "Skip the guesswork with the 7-step playbook applied to your case." },
  ],
  entitlements: [
    {
      emoji: "🗣️",
      title: "Live Sessions",
      body: "2 sessions per week (1 Masterclass, 1 Unblocking U) over 8 weeks. 60 minutes each.",
    },
  ],
  cta: { label: "Book a coaching call", url: "https://jobhackers.global" },
  ctaCaption: "Free 20 minutes. No pitch if it's not a fit.",
};

// ---- the brand's canonical emoji set (the only values the picker offers) ----
export const COACHING_EMOJI = [
  "🎯", "💎", "💼", "✅", "🤝", "💬", "🤑", "🧭", "❤", "🔥", "🤩", "💡", "⚡", "💪", "⏳", "🕒", "🏆", "🗣️",
] as const;

// Compare emoji without the optional variation selector so "🗣️" and "🗣" match.
const stripVS = (s: string) => s.replace(/️/g, "");
export function isBrandEmoji(s: string): boolean {
  const key = stripVS(s);
  return COACHING_EMOJI.some((e) => stripVS(e) === key);
}

// ---- soft character limits (warn, never block) — sized so seed-length copy
//      keeps the no-scroll promise on a 390×844 screen ----
export const COACHING_LIMITS = {
  headlineLine1: 12,
  headlineLine2: 40,
  headlineLine3: 12,
  subhead: 120,
  benefitTitle: 24,
  benefitBody: 90,
  entitlementTitle: 24,
  entitlementBody: 130,
  ctaLabel: 28,
  ctaCaption: 60,
} as const;

// ---- hard list-size limits (enforced in the UI and in validation) ----
export const COACHING_LIST_LIMITS = {
  benefits: { min: 2, max: 4 },
  entitlements: { min: 1, max: 6 },
} as const;

// Count user-perceived characters (emoji, dashes and accents count as one).
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
export function charCount(s: string): number {
  const str = s ?? "";
  if (!segmenter) return Array.from(str).length;
  let n = 0;
  for (const _ of segmenter.segment(str)) n++;
  return n;
}

// ---- normalisation: coerce whatever was stored / posted into the exact shape ----
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function normalizeItems(raw: unknown): CoachingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const o = r as Record<string, unknown>;
      return { emoji: str(o.emoji), title: str(o.title), body: str(o.body) };
    });
}

export function normalizeCoachingScreen(raw: unknown): CoachingScreenContent {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  return {
    headline: {
      line1: str(o.headline?.line1),
      line2: str(o.headline?.line2),
      line3: str(o.headline?.line3),
    },
    subhead: str(o.subhead),
    benefits: normalizeItems(o.benefits),
    entitlements: normalizeItems(o.entitlements),
    cta: { label: str(o.cta?.label), url: str(o.cta?.url) },
    ctaCaption: str(o.ctaCaption),
  };
}

// What the app renders: the published content with every missing / blank piece
// back-filled from the seed, so a half-written doc can never blank the screen.
export function mergeCoachingScreen(raw: unknown): CoachingScreenContent {
  if (!raw || typeof raw !== "object") return DEFAULT_COACHING_SCREEN;
  const n = normalizeCoachingScreen(raw);
  const d = DEFAULT_COACHING_SCREEN;
  const { min: bMin } = COACHING_LIST_LIMITS.benefits;
  const { min: eMin } = COACHING_LIST_LIMITS.entitlements;
  return {
    headline: {
      line1: n.headline.line1 || d.headline.line1,
      line2: n.headline.line2 || d.headline.line2,
      line3: n.headline.line3 || d.headline.line3,
    },
    subhead: n.subhead || d.subhead,
    benefits: n.benefits.length >= bMin ? n.benefits : d.benefits,
    entitlements: n.entitlements.length >= eMin ? n.entitlements : d.entitlements,
    cta: { label: n.cta.label || d.cta.label, url: isHttpsUrl(n.cta.url) ? n.cta.url : d.cta.url },
    ctaCaption: n.ctaCaption || d.ctaCaption,
  };
}

// ---- validation ----
export interface CoachingIssue {
  /** Dot path into the content, e.g. "headline.line2", "benefits.1.body", "benefits", "cta.url". */
  path: string;
  message: string;
}
export interface CoachingValidation {
  ok: boolean;
  /** Blocking problems — publish is refused while any exist. */
  errors: CoachingIssue[];
  /** Soft-limit overruns — shown, never blocking. */
  warnings: CoachingIssue[];
}

export function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !!u.hostname;
  } catch {
    return false;
  }
}

export function validateCoachingScreen(input: unknown): CoachingValidation {
  const c = normalizeCoachingScreen(input);
  const errors: CoachingIssue[] = [];
  const warnings: CoachingIssue[] = [];

  const required = (path: string, value: string, label: string) => {
    if (!value) errors.push({ path, message: `${label} is required.` });
  };
  const soft = (path: string, value: string, limit: number, label: string) => {
    const n = charCount(value);
    if (n > limit) warnings.push({ path, message: `${label} is ${n} characters — over the ${limit} soft limit.` });
  };

  required("headline.line1", c.headline.line1, "Headline line 1");
  required("headline.line2", c.headline.line2, "Headline line 2");
  required("headline.line3", c.headline.line3, "Headline line 3");
  required("subhead", c.subhead, "Subhead");
  required("cta.label", c.cta.label, "CTA label");
  required("cta.url", c.cta.url, "CTA URL");
  required("ctaCaption", c.ctaCaption, "CTA caption");
  if (c.cta.url && !isHttpsUrl(c.cta.url)) {
    errors.push({ path: "cta.url", message: "CTA URL must be an absolute https:// link." });
  }

  soft("headline.line1", c.headline.line1, COACHING_LIMITS.headlineLine1, "Headline line 1");
  soft("headline.line2", c.headline.line2, COACHING_LIMITS.headlineLine2, "Headline line 2");
  soft("headline.line3", c.headline.line3, COACHING_LIMITS.headlineLine3, "Headline line 3");
  soft("subhead", c.subhead, COACHING_LIMITS.subhead, "Subhead");
  soft("cta.label", c.cta.label, COACHING_LIMITS.ctaLabel, "CTA label");
  soft("ctaCaption", c.ctaCaption, COACHING_LIMITS.ctaCaption, "CTA caption");

  const list = (
    key: "benefits" | "entitlements",
    items: CoachingItem[],
    limits: { title: number; body: number },
    label: string
  ) => {
    const { min, max } = COACHING_LIST_LIMITS[key];
    if (items.length < min) errors.push({ path: key, message: `${label}: at least ${min} required.` });
    if (items.length > max) errors.push({ path: key, message: `${label}: at most ${max} allowed.` });
    items.forEach((it, i) => {
      const at = `${key}.${i}`;
      const nth = `${label} ${i + 1}`;
      if (!it.emoji) errors.push({ path: `${at}.emoji`, message: `${nth}: pick an emoji.` });
      else if (!isBrandEmoji(it.emoji)) errors.push({ path: `${at}.emoji`, message: `${nth}: emoji must be one of the brand set.` });
      required(`${at}.title`, it.title, `${nth} title`);
      required(`${at}.body`, it.body, `${nth} body`);
      soft(`${at}.title`, it.title, limits.title, `${nth} title`);
      soft(`${at}.body`, it.body, limits.body, `${nth} body`);
    });
  };
  list("benefits", c.benefits, { title: COACHING_LIMITS.benefitTitle, body: COACHING_LIMITS.benefitBody }, "Benefit");
  list("entitlements", c.entitlements, { title: COACHING_LIMITS.entitlementTitle, body: COACHING_LIMITS.entitlementBody }, "Entitlement");

  return { ok: errors.length === 0, errors, warnings };
}

// ---- 390×844 layout model ----
// Geometry of the mobile shell the screen sits in (see components/shell/MobileChrome.tsx
// and the .coaching-screen rules in app/globals.css). Keep these in step with the CSS.
export const COACHING_VIEWPORT = {
  width: 390,
  height: 844,
  statusBar: 44,
  header: 56,
  tabBar: 58,
  padX: 16,
  padY: 12,
} as const;
/** Height of the content column between the header and the tab bar (≈670px). */
export const COACHING_COLUMN_HEIGHT =
  COACHING_VIEWPORT.height - COACHING_VIEWPORT.statusBar - COACHING_VIEWPORT.header - COACHING_VIEWPORT.tabBar;

// Text metrics mirrored from the .coaching-* CSS. `cw` is the average glyph
// width as a fraction of the font size, calibrated against a headless-Chrome
// render of the seed / 4-benefit / at-the-limits copy with the real fonts
// (Roboto ≈ 0.44em, Poppins 600 ≈ 0.49em, Poppins 700 display ≈ 0.66em).
// This is an estimate: the admin preview measures the real DOM; this backs the
// tests and gives a cheap heuristic where there is no layout engine.
const TYPE = {
  line1: { size: 36, lh: 1.1, cw: 0.66 },
  line2: { size: 18, lh: 1.25, cw: 0.49 },
  line3: { size: 44, lh: 1.05, cw: 0.66 },
  subhead: { size: 15, lh: 1.45, cw: 0.44 },
  benefitTitle: { size: 16, lh: 1.3, cw: 0.62 },
  benefitBody: { size: 14, lh: 1.4, cw: 0.44 },
  entTitle: { size: 15, lh: 1.3, cw: 0.62 },
  entBody: { size: 13, lh: 1.4, cw: 0.44 },
  caption: { size: 13, lh: 1.4, cw: 0.44 },
} as const;
const GAP = { afterHeadline: 10, afterSubhead: 12, benefitRows: 8, afterBenefits: 12, afterCard: 14, ctaToCaption: 8 };
const CTA_HEIGHT = 48;
const CARD_PAD = 14;
const ROW_EMOJI = 36;   // emoji column (incl. gap) inside a benefit row
const ROW_RULE = 14;    // 3px red rule + its 11px inset
const CARD_EMOJI = 30;

function textHeight(text: string, t: { size: number; lh: number; cw: number }, width: number): number {
  const lines = Math.max(1, Math.ceil((charCount(text) * t.size * t.cw) / width));
  return lines * t.size * t.lh;
}

export interface CoachingHeightEstimate {
  /** Estimated natural height of the stacked content, in px. */
  height: number;
  /** Height available inside the column (after the screen's own padding). */
  available: number;
  fits: boolean;
}

export function estimateCoachingScreenHeight(
  content: CoachingScreenContent,
  viewport: { width?: number; columnHeight?: number } = {}
): CoachingHeightEstimate {
  const width = (viewport.width ?? COACHING_VIEWPORT.width) - COACHING_VIEWPORT.padX * 2;
  const available = (viewport.columnHeight ?? COACHING_COLUMN_HEIGHT) - COACHING_VIEWPORT.padY * 2;

  let h = 0;
  h += textHeight(content.headline.line1, TYPE.line1, width);
  h += textHeight(content.headline.line2, TYPE.line2, width);
  h += textHeight(content.headline.line3, TYPE.line3, width);
  h += GAP.afterHeadline;
  h += textHeight(content.subhead, TYPE.subhead, width);
  h += GAP.afterSubhead;

  const rowWidth = width - ROW_RULE - ROW_EMOJI;
  content.benefits.forEach((b, i) => {
    h += textHeight(b.title, TYPE.benefitTitle, rowWidth) + 2 + textHeight(b.body, TYPE.benefitBody, rowWidth);
    if (i > 0) h += GAP.benefitRows;
  });
  h += GAP.afterBenefits;

  const cardWidth = width - CARD_PAD * 2 - CARD_EMOJI;
  h += CARD_PAD * 2;
  content.entitlements.forEach((e, i) => {
    h += textHeight(e.title, TYPE.entTitle, cardWidth) + 4 + textHeight(e.body, TYPE.entBody, cardWidth);
    if (i > 0) h += 10;
  });
  h += GAP.afterCard;

  h += CTA_HEIGHT + GAP.ctaToCaption + textHeight(content.ctaCaption, TYPE.caption, width);

  const height = Math.round(h);
  return { height, available, fits: height <= available };
}
