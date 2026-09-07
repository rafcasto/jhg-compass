"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, GripVertical, Plus, Trash2 } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import CoachingPreview from "@/components/coaching/CoachingPreview";
import {
  COACHING_EMOJI, COACHING_LIMITS, COACHING_LIST_LIMITS, COACHING_VIEWPORT, DEFAULT_COACHING_SCREEN,
  charCount, validateCoachingScreen,
  type CoachingIssue, type CoachingItem, type CoachingScreenContent, type CoachingScreenDoc,
} from "@/lib/coaching-screen";

async function authed(url: string, init: RequestInit = {}) {
  const token = await auth.currentUser!.getIdToken();
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
}

type ListKey = "benefits" | "entitlements";
const LIST_META: Record<ListKey, { label: string; heading: string; help: string; title: number; body: number }> = {
  benefits: {
    label: "Benefit", heading: "Benefits",
    help: "Three rows with a red rule: emoji, title, one line of body. Between 2 and 4.",
    title: COACHING_LIMITS.benefitTitle, body: COACHING_LIMITS.benefitBody,
  },
  entitlements: {
    label: "Entitlement", heading: "Entitlement card",
    help: "What's included, on the blue-grey card. Between 1 and 6.",
    title: COACHING_LIMITS.entitlementTitle, body: COACHING_LIMITS.entitlementBody,
  },
};

const fmt = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Admin: edit every string on the Coaching tab beside a true-size 390×844 preview
// of the real screen. Save as draft (always allowed) or publish (blocked while any
// field is invalid). Stored at config/coachingScreen.
export default function CoachingScreenTab() {
  const [doc, setDoc] = useState<CoachingScreenDoc | null>(null);
  const [content, setContent] = useState<CoachingScreenContent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fits, setFits] = useState<boolean | null>(null);

  useEffect(() => {
    authed("/api/admin/coaching-screen").then((r) => r.json()).then((d) => {
      if (!d.ok) { setLoadError("Couldn't load the Coaching tab content."); return; }
      const dd = d.doc as CoachingScreenDoc;
      setDoc(dd);
      setContent(dd.draft ?? dd.published ?? structuredClone(DEFAULT_COACHING_SCREEN));
    }).catch(() => setLoadError("Couldn't load the Coaching tab content."));
  }, []);

  const validation = useMemo(() => (content ? validateCoachingScreen(content) : null), [content]);
  const errorAt = (path: string) => validation?.errors.find((e) => e.path === path)?.message;

  function update(fn: (c: CoachingScreenContent) => CoachingScreenContent) {
    setContent((c) => (c ? fn(c) : c));
    setDirty(true); setNotice(null);
  }
  const setHeadline = (k: "line1" | "line2" | "line3", v: string) => update((c) => ({ ...c, headline: { ...c.headline, [k]: v } }));
  const setList = (key: ListKey, items: CoachingItem[]) => update((c) => ({ ...c, [key]: items }));

  async function save(action: "draft" | "publish") {
    if (!content || !validation) return;
    if (action === "publish" && !validation.ok) {
      setNotice({ kind: "err", text: "Fix the highlighted fields before publishing." });
      return;
    }
    setBusy(action); setNotice(null);
    try {
      const r = await authed("/api/admin/coaching-screen", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, content }),
      });
      const d = await r.json();
      if (d.ok) {
        setDoc(d.doc); setContent(d.doc.draft); setDirty(false);
        setNotice({ kind: "ok", text: action === "publish" ? "Published — live for members now." : "Draft saved." });
      } else {
        const msg = Array.isArray(d.errors) && d.errors.length ? (d.errors as CoachingIssue[]).map((e) => e.message).join(" ") : "Save failed.";
        setNotice({ kind: "err", text: msg });
      }
    } catch {
      setNotice({ kind: "err", text: "Save failed." });
    } finally {
      setBusy(null);
    }
  }

  function resetToSeed() {
    if (confirm("Replace the draft with the built-in seed copy? Nothing changes for members until you publish.")) {
      setContent(structuredClone(DEFAULT_COACHING_SCREEN)); setDirty(true); setNotice(null);
    }
  }
  function discardDraft() {
    if (!doc?.published) return;
    if (confirm("Discard the draft and reload what's currently published?")) {
      setContent(structuredClone(doc.published)); setDirty(true); setNotice(null);
    }
  }

  if (loadError && !content) return <p className="text-jh-red">{loadError}</p>;
  if (!content || !validation) return <p className="text-jh-mute animate-pulse">Loading Coaching tab…</p>;

  const draftDiffers = !!doc && JSON.stringify(doc.published) !== JSON.stringify(content);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl">Coaching tab</h2>
          <p className="text-jh-mute text-sm mt-1">
            Every word on the Coaching screen. The preview is the real screen at {COACHING_VIEWPORT.width}×{COACHING_VIEWPORT.height} — members should never have to scroll it.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={discardDraft} disabled={!doc?.published} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap disabled:opacity-40">Load published</button>
          <button type="button" onClick={resetToSeed} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap">Reset to seed copy</button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-8 items-start">
        {/* ---------------- form ---------------- */}
        <div className="flex-1 min-w-0 space-y-6">
          <Section title="Headline" help="Three stacked lines: 36px ink · 18px ink · 44px red.">
            <Field id="cs-h1" label="Line 1" value={content.headline.line1} limit={COACHING_LIMITS.headlineLine1} onChange={(v) => setHeadline("line1", v)} error={errorAt("headline.line1")} />
            <Field id="cs-h2" label="Line 2" value={content.headline.line2} limit={COACHING_LIMITS.headlineLine2} onChange={(v) => setHeadline("line2", v)} error={errorAt("headline.line2")} />
            <Field id="cs-h3" label="Line 3 (red)" value={content.headline.line3} limit={COACHING_LIMITS.headlineLine3} onChange={(v) => setHeadline("line3", v)} error={errorAt("headline.line3")} />
          </Section>

          <Section title="Subhead">
            <Field id="cs-subhead" label="Subhead" value={content.subhead} limit={COACHING_LIMITS.subhead} textarea onChange={(v) => update((c) => ({ ...c, subhead: v }))} error={errorAt("subhead")} />
          </Section>

          <ItemList listKey="benefits" items={content.benefits} onChange={(items) => setList("benefits", items)} errorAt={errorAt} />
          <ItemList listKey="entitlements" items={content.entitlements} onChange={(items) => setList("entitlements", items)} errorAt={errorAt} />

          <Section title="Call to action" help="Opens in a new tab. Must be an absolute https:// link.">
            <Field id="cs-cta-label" label="Button label" value={content.cta.label} limit={COACHING_LIMITS.ctaLabel} onChange={(v) => update((c) => ({ ...c, cta: { ...c.cta, label: v } }))} error={errorAt("cta.label")} />
            <Field id="cs-cta-url" label="Button URL" value={content.cta.url} type="url" onChange={(v) => update((c) => ({ ...c, cta: { ...c.cta, url: v } }))} error={errorAt("cta.url")} />
            <Field id="cs-caption" label="Caption under the button" value={content.ctaCaption} limit={COACHING_LIMITS.ctaCaption} onChange={(v) => update((c) => ({ ...c, ctaCaption: v }))} error={errorAt("ctaCaption")} />
          </Section>
        </div>

        {/* ---------------- live preview ---------------- */}
        <aside className="shrink-0 xl:sticky xl:top-6 space-y-2">
          <div className="flex items-center justify-between gap-3" style={{ width: COACHING_VIEWPORT.width }}>
            <span className="font-display font-semibold text-sm text-jh-ink">Live preview · {COACHING_VIEWPORT.width}×{COACHING_VIEWPORT.height}</span>
            {fits === false ? (
              <span role="status" className="pill bg-jh-red-soft text-jh-red"><AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden /> Won&apos;t fit on a {COACHING_VIEWPORT.width}×{COACHING_VIEWPORT.height} screen</span>
            ) : (
              <span role="status" className="pill bg-jh-mist text-rb-green-dark"><Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden /> Fits without scrolling</span>
            )}
          </div>
          <CoachingPreview content={content} onFitChange={setFits} />
          {validation.warnings.length > 0 && (
            <p className="text-xs text-jh-mute" style={{ width: COACHING_VIEWPORT.width }}>
              {validation.warnings.length} field{validation.warnings.length === 1 ? "" : "s"} over the soft limit — allowed, but watch the fit flag.
            </p>
          )}
        </aside>
      </div>

      {/* ---------------- actions + audit ---------------- */}
      <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-jh-paper/90 backdrop-blur border-t border-jh-line flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => save("draft")} disabled={busy !== null} className="btn-secondary disabled:opacity-60">
          {busy === "draft" ? "Saving…" : "Save draft"}
        </button>
        <button type="button" onClick={() => save("publish")} disabled={busy !== null || !validation.ok} className="btn-primary disabled:opacity-60"
          title={validation.ok ? undefined : "Fix the highlighted fields first"}>
          {busy === "publish" ? "Publishing…" : "Publish"}
        </button>
        {notice && <span role="status" className={`text-sm ${notice.kind === "ok" ? "text-rb-green-dark" : "text-jh-red"}`}>{notice.text}</span>}
        {!notice && dirty && <span className="text-sm text-jh-mute">Unsaved changes</span>}
        {!notice && !dirty && draftDiffers && doc?.published && <span className="text-sm text-jh-mute">Draft differs from what&apos;s live</span>}
        <span className="ml-auto text-xs text-jh-mute" data-testid="coaching-audit">
          {doc?.publishedAt && doc.publishedBy
            ? <>Published by <span className="text-jh-ink font-semibold">{doc.publishedBy}</span> on {fmt(doc.publishedAt)}</>
            : <>Not published yet — members see the built-in copy</>}
          {doc?.updatedAt && doc.updatedBy && <> · Draft saved by {doc.updatedBy} on {fmt(doc.updatedAt)}</>}
        </span>
      </div>
    </div>
  );
}

/* ---------------- building blocks ---------------- */

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 space-y-4">
      <div>
        <h3 className="font-display font-bold text-jh-ink">{title}</h3>
        {help && <p className="text-jh-mute text-sm">{help}</p>}
      </div>
      {children}
    </section>
  );
}

function Counter({ value, limit }: { value: string; limit: number }) {
  const n = charCount(value);
  const over = n > limit;
  return (
    <span className={`text-xs tabular-nums whitespace-nowrap ${over ? "text-jh-red font-semibold" : "text-jh-mute"}`} aria-live="polite">
      {n}/{limit}{over ? " · over the soft limit" : ""}
    </span>
  );
}

function Field({
  id, label, value, onChange, limit, textarea, type = "text", error, ariaLabel,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  limit?: number; textarea?: boolean; type?: string; error?: string; ariaLabel?: string;
}) {
  const cls = `field mt-1.5 text-sm ${error ? "border-jh-red" : ""}`;
  const shared = { id, value, "aria-label": ariaLabel, "aria-invalid": !!error || undefined, "aria-describedby": error ? `${id}-err` : undefined };
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label mb-0">{label}</label>
        {limit != null && <Counter value={value} limit={limit} />}
      </div>
      {textarea
        ? <textarea {...shared} className={`${cls} min-h-[72px]`} onChange={(e) => onChange(e.target.value)} />
        : <input {...shared} type={type} className={cls} onChange={(e) => onChange(e.target.value)} />}
      {error && <p id={`${id}-err`} className="mt-1 text-xs text-jh-red">{error}</p>}
    </div>
  );
}

// Picker restricted to the brand's canonical emoji set.
function EmojiPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        aria-label={`${label}: ${value || "none"}`}
        className="h-11 w-11 rounded-sm border border-jh-line-2 bg-white text-xl grid place-items-center hover:border-jh-red transition-colors duration-200 ease-out">
        {value || "＋"}
      </button>
      {open && (
        <div role="listbox" aria-label={`${label} options`} className="absolute left-0 z-20 mt-1 w-[248px] card p-2 grid grid-cols-6 gap-1">
          {COACHING_EMOJI.map((e) => (
            <button key={e} type="button" role="option" aria-selected={e === value} aria-label={e}
              onClick={() => { onChange(e); setOpen(false); }}
              className={`h-9 w-9 rounded-sm text-lg grid place-items-center transition-colors duration-200 ease-out ${e === value ? "bg-jh-red-soft" : "hover:bg-jh-mist"}`}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Ordered, drag-reorderable list of { emoji, title, body } rows with min/max enforced.
function ItemList({
  listKey, items, onChange, errorAt,
}: { listKey: ListKey; items: CoachingItem[]; onChange: (items: CoachingItem[]) => void; errorAt: (p: string) => string | undefined }) {
  const meta = LIST_META[listKey];
  const { min, max } = COACHING_LIST_LIMITS[listKey];
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const patch = (i: number, p: Partial<CoachingItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...p } : it)));
  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items]; const [row] = next.splice(from, 1); next.splice(to, 0, row);
    onChange(next);
  }
  const remove = (i: number) => { if (items.length > min) onChange(items.filter((_, j) => j !== i)); };
  const add = () => { if (items.length < max) onChange([...items, { emoji: COACHING_EMOJI[0], title: "", body: "" }]); };

  function onDrop(e: DragEvent, i: number) {
    e.preventDefault();
    if (drag != null) move(drag, i);
    setDrag(null); setOver(null);
  }

  const countError = errorAt(listKey);
  return (
    <Section title={meta.heading} help={meta.help}>
      <ol className="divide-y divide-jh-line border border-jh-line rounded-md overflow-hidden" aria-label={meta.heading}>
        {items.map((it, i) => (
          <li key={i}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => onDrop(e, i)}
            className={`flex items-start gap-3 p-3 bg-white transition-colors duration-200 ease-out ${over === i && drag !== i ? "bg-jh-blue-grey" : ""}`}>
            <button type="button" draggable aria-label={`Drag to reorder ${meta.label.toLowerCase()} ${i + 1}`}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDrag(i); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
              className="mt-2 h-8 w-8 grid place-items-center rounded-sm text-jh-mute hover:text-jh-ink cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </button>
            <div className="mt-1">
              <EmojiPicker value={it.emoji} onChange={(v) => patch(i, { emoji: v })} label={`${meta.label} ${i + 1} emoji`} />
              {errorAt(`${listKey}.${i}.emoji`) && <p className="mt-1 text-xs text-jh-red">Pick one</p>}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <Field id={`cs-${listKey}-${i}-title`} label="Title" ariaLabel={`${meta.label} ${i + 1} title`} value={it.title} limit={meta.title}
                onChange={(v) => patch(i, { title: v })} error={errorAt(`${listKey}.${i}.title`)} />
              <Field id={`cs-${listKey}-${i}-body`} label="Body" ariaLabel={`${meta.label} ${i + 1} body`} value={it.body} limit={meta.body} textarea
                onChange={(v) => patch(i, { body: v })} error={errorAt(`${listKey}.${i}.body`)} />
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <button type="button" aria-label={`Move ${meta.label.toLowerCase()} ${i + 1} up`} onClick={() => move(i, i - 1)} disabled={i === 0}
                className="h-8 w-8 grid place-items-center rounded-sm text-jh-mute hover:text-jh-ink disabled:opacity-30"><ArrowUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /></button>
              <button type="button" aria-label={`Move ${meta.label.toLowerCase()} ${i + 1} down`} onClick={() => move(i, i + 1)} disabled={i === items.length - 1}
                className="h-8 w-8 grid place-items-center rounded-sm text-jh-mute hover:text-jh-ink disabled:opacity-30"><ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden /></button>
              <button type="button" aria-label={`Remove ${meta.label.toLowerCase()} ${i + 1}`} onClick={() => remove(i)} disabled={items.length <= min}
                title={items.length <= min ? `At least ${min} required` : undefined}
                className="h-8 w-8 grid place-items-center rounded-sm text-jh-mute hover:text-jh-red hover:bg-jh-red-soft disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-jh-mute"><Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden /></button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <button type="button" onClick={add} disabled={items.length >= max} title={items.length >= max ? `At most ${max} allowed` : undefined}
          className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1 disabled:opacity-40">
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Add {meta.label.toLowerCase()}
        </button>
        <span className="text-xs text-jh-mute">{items.length} of {min}–{max}</span>
        {countError && <span className="text-xs text-jh-red">{countError}</span>}
      </div>
    </Section>
  );
}
