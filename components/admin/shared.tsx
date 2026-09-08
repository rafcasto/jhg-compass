"use client";

import type { ComponentType, ReactNode } from "react";
import { Compass, Gauge, Columns3, GraduationCap, type LucideProps } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { BottomTabBar, MobileHeader, PreviewStatusBar } from "@/components/shell/MobileChrome";
import { COACHING_COLUMN_HEIGHT, COACHING_VIEWPORT } from "@/lib/coaching-screen";

// Building blocks shared by every admin editor so each tab reads the same way:
//   TabHeader → sub-tabs → Sections of Fields (+ optional live PhoneFrame) → SaveBar.
// The layout is the one the Coaching editor established (form beside a true-size
// phone preview, sticky action bar with an audit line).

export async function authed(url: string, init: RequestInit = {}) {
  const token = await auth.currentUser!.getIdToken();
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
}
export const postJson = (url: string, body: unknown) =>
  authed(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export type Notice = { kind: "ok" | "err"; text: string } | null;

/* ---------------- headings & navigation ---------------- */

export function TabHeader({ title, intro, icon: Icon, actions }: {
  title: string; intro?: ReactNode; icon?: ComponentType<LucideProps>; actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-jh-red" strokeWidth={1.5} aria-hidden />}
          <h2 className="text-xl">{title}</h2>
        </div>
        {intro && <p className="text-jh-mute text-sm mt-1 max-w-3xl">{intro}</p>}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export interface SubTabItem<K extends string> { key: K; label: string; hint?: string }

// Second-level navigation inside a top-level tab: pill segments.
export function SubTabs<K extends string>({ items, value, onChange, ariaLabel }: {
  items: readonly SubTabItem<K>[]; value: K; onChange: (k: K) => void; ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-pill bg-jh-mist p-1">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button key={it.key} type="button" role="tab" aria-selected={active} title={it.hint}
            onClick={() => onChange(it.key)}
            className={`px-4 py-2 rounded-pill text-sm font-display font-semibold transition-colors duration-200 ease-out ${active ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute hover:text-jh-ink"}`}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- form primitives ---------------- */

export function Section({ title, help, children, className = "", aside }: {
  title: string; help?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode;
}) {
  return (
    <section className={`card p-5 space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-jh-ink">{title}</h3>
          {help && <p className="text-jh-mute text-sm">{help}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Field({
  id, label, value, onChange, textarea, type = "text", help, placeholder, className = "", mono, error,
}: {
  id?: string; label: string; value: string; onChange: (v: string) => void;
  textarea?: boolean; type?: string; help?: string; placeholder?: string; className?: string; mono?: boolean; error?: string;
}) {
  const cls = `field mt-1.5 text-sm ${mono ? "font-mono text-xs" : ""} ${error ? "border-jh-red" : ""}`;
  const fid = id ?? `f-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return (
    <div className={className}>
      <label htmlFor={fid} className="label mb-0">{label}</label>
      {textarea
        ? <textarea id={fid} className={`${cls} min-h-[72px]`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} />
        : <input id={fid} type={type} className={cls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} />}
      {error ? <p className="mt-1 text-xs text-jh-red">{error}</p> : help ? <p className="mt-1 text-[11px] text-jh-mute">{help}</p> : null}
    </div>
  );
}

export function NumberField({ id, label, value, onChange, min = 0, max, help, className = "" }: {
  id?: string; label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; help?: string; className?: string;
}) {
  const fid = id ?? `n-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return (
    <div className={className}>
      <label htmlFor={fid} className="label mb-0">{label}</label>
      <input id={fid} type="number" min={min} max={max} className="field mt-1.5 text-sm" value={value}
        onChange={(e) => onChange(Math.max(min, +e.target.value || 0))} />
      {help && <p className="mt-1 text-[11px] text-jh-mute">{help}</p>}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-pill transition shrink-0 ${on ? "bg-rb-green-dark" : "bg-jh-line-2"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// Renders a catalogue of editable strings (lib/content.ts TEXT_FIELDS) bound to a
// text map. Used by every CMS / TOFU editor so copy fields look identical.
export function TextFields({ fields, text, onChange, idPrefix = "t" }: {
  fields: { key: string; label: string; textarea?: boolean; help?: string }[];
  text: Record<string, string>;
  onChange: (key: string, value: string) => void;
  idPrefix?: string;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {fields.map((f) => (
        <Field key={f.key} id={`${idPrefix}-${f.key.replace(/\./g, "-")}`} label={f.label} value={text[f.key] ?? ""}
          onChange={(v) => onChange(f.key, v)} textarea={f.textarea} help={f.help}
          className={f.textarea ? "sm:col-span-2" : ""} />
      ))}
    </div>
  );
}

/* ---------------- save bar ---------------- */

export function SaveBar({
  onSave, busy, dirty, notice, label = "Save", audit, children, disabled, secondary,
}: {
  onSave: () => void; busy: boolean; dirty: boolean; notice: Notice; label?: string;
  audit?: ReactNode; children?: ReactNode; disabled?: boolean; secondary?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-jh-paper/90 backdrop-blur border-t border-jh-line flex items-center gap-3 flex-wrap">
      {secondary}
      <button type="button" onClick={onSave} disabled={busy || disabled} className="btn-primary disabled:opacity-60">
        {busy ? "Saving…" : label}
      </button>
      {children}
      {notice && <span role="status" className={`text-sm ${notice.kind === "ok" ? "text-rb-green-dark" : "text-jh-red"}`}>{notice.text}</span>}
      {!notice && dirty && <span className="text-sm text-jh-mute">Unsaved changes</span>}
      {audit && <span className="ml-auto text-xs text-jh-mute">{audit}</span>}
    </div>
  );
}

export function AuditLine({ updatedAt, updatedBy, empty = "Not saved yet — members see the built-in copy" }: {
  updatedAt?: number | null; updatedBy?: string | null; empty?: string;
}) {
  if (!updatedAt) return <>{empty}</>;
  return <>Last saved{updatedBy ? <> by <span className="text-jh-ink font-semibold">{updatedBy}</span></> : null} on {fmtDateTime(updatedAt)}</>;
}

/* ---------------- live preview frame ---------------- */

export type PreviewTab = "compass" | "performance" | "tracker" | "coaching";
const PREVIEW_TABS = [
  { key: "compass", label: "Compass", icon: Compass, href: "/compass" },
  { key: "performance", label: "Performance", icon: Gauge, href: "/performance" },
  { key: "tracker", label: "Progress", icon: Columns3, href: "/tracker" },
  { key: "coaching", label: "Coaching", icon: GraduationCap, href: "/coaching" },
] as const;

// A true-size 390×844 phone around a real screen + the real shell chrome — the
// same frame the Coaching editor uses. `labels` lets the CMS preview the tab
// names it is editing.
export function PhoneFrame({ active, children, labels, scroll = true, title }: {
  active: PreviewTab; children: ReactNode; labels?: Partial<Record<PreviewTab, string>>; scroll?: boolean; title?: string;
}) {
  const items = PREVIEW_TABS.map((t) => ({ ...t, label: labels?.[t.key] || t.label, active: t.key === active }));
  return (
    <div className="coaching-preview" style={{ width: COACHING_VIEWPORT.width, height: COACHING_VIEWPORT.height }}
      role="img" aria-label={title ?? `Live preview at ${COACHING_VIEWPORT.width}×${COACHING_VIEWPORT.height}`}>
      <PreviewStatusBar />
      <MobileHeader position="static" />
      <div style={{ height: COACHING_COLUMN_HEIGHT, overflowY: scroll ? "auto" : "hidden" }} className="px-4 py-3 bg-jh-paper">
        {children}
      </div>
      <BottomTabBar items={items} position="static" />
    </div>
  );
}

// Column beside the form that holds the phone.
export function PreviewAside({ children, caption }: { children: ReactNode; caption?: ReactNode }) {
  return (
    <aside className="shrink-0 xl:sticky xl:top-6 space-y-2">
      <div className="flex items-center justify-between gap-3" style={{ width: COACHING_VIEWPORT.width }}>
        <span className="font-display font-semibold text-sm text-jh-ink">Live preview · {COACHING_VIEWPORT.width}×{COACHING_VIEWPORT.height}</span>
        {caption}
      </div>
      {children}
    </aside>
  );
}

// Two-column editor layout: form (flex-1) + preview aside.
export function EditorLayout({ form, preview }: { form: ReactNode; preview: ReactNode }) {
  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start">
      <div className="flex-1 min-w-0 space-y-6">{form}</div>
      {preview}
    </div>
  );
}

/* ---------------- stats ---------------- */

export function StatCard({ value, label, hint }: { value: ReactNode; label: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="font-display font-extrabold text-3xl text-jh-ink tabular-nums">{value ?? 0}</div>
      <div className="text-sm text-jh-mute mt-1">{label}</div>
      {hint && <div className="text-[11px] text-jh-mute-2 mt-0.5">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card p-10 text-center text-jh-mute">{children}</div>;
}

export function Loading({ children = "Loading…" }: { children?: ReactNode }) {
  return <p className="text-jh-mute animate-pulse">{children}</p>;
}
