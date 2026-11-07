"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/shell/PageHeader";
import SectionList, { type SectionItem, type SectionRow } from "./SectionList";

// The one layout behind every sectioned page — the JobHacking pages and the
// Settings areas — docs/UX_PROFILE.md §1; docs/UX_JOBHACKING.md;
// docs/UX_SETTINGS_HUB.md §3.
//
// Desktop (≥ md): a sticky 232px rail beside the content column; the active
// section lives in ?section= and the first section opens when it is absent.
// Mobile: the overview IS the page (identity, lead, actions, progress, rows); a
// section drills in with a `‹ Page` back row and prev / next at the bottom.
// A page under a hub (Settings → True North) names its `parent`: a `‹ Settings`
// row leads the desktop rail and the mobile overview.
// Every page passes its items, the rows that summarise them, and a panel
// renderer; everything else here is the same on purpose.

export interface SectionsProgress { done: number; total: number; pct: number }

/** Over every rendered section — the whole picture, not just the required ones. */
export function sectionsProgress(rows: readonly SectionRow[]): SectionsProgress {
  const done = rows.filter((r) => r.state === "done").length;
  return { done, total: rows.length, pct: rows.length ? Math.round((done / rows.length) * 100) : 0 };
}

export default function SectionsPage<K extends string>({
  id, backHref, eyebrow, title, intro, actions, identity, lead, items, rows, active, panel, panelKey, loading = false, status, parent,
}: {
  /** Prefix for the section heading's id (one per page). */
  id: string;
  /** The page's overview — where the mobile back row goes. */
  backHref: string;
  eyebrow: string;
  title: string;
  intro: string;
  /** Page-level actions (Export · Upload). Header on desktop, under the identity on mobile. */
  actions?: ReactNode;
  /** Who this is — rail top on desktop, a card on the mobile overview. */
  identity?: ReactNode;
  /** A full-width block under the header (the True North statement). Hidden on mobile while a section is open. */
  lead?: ReactNode;
  items: readonly SectionItem<K>[];
  rows: readonly SectionRow<K>[];
  active: K | null;
  panel: (key: K) => ReactNode;
  /** Change to remount the open panel (after an upload replaced its data). */
  panelKey?: string | number;
  loading?: boolean;
  /** A role="status" line under the header. */
  status?: ReactNode;
  /** The hub this page sits under — a back row at the top of the rail and of the mobile overview. */
  parent?: { label: string; href: string };
}) {
  const progress = sectionsProgress(rows);
  const shown: K = active ?? items[0].key;
  const meta = items.find((s) => s.key === shown) ?? items[0];
  const Icon = meta.icon;
  const count = rows.find((r) => r.key === shown)?.count;
  const i = items.findIndex((s) => s.key === shown);
  const prev = items[i - 1], next = items[i + 1];
  const listLabel = `${title} sections`;
  const parentRow = parent && (
    <Link href={parent.href} className="-ml-2 inline-flex min-h-[44px] items-center gap-1 px-2 font-display font-semibold text-sm text-jh-mute hover:text-jh-ink">
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {parent.label}
    </Link>
  );

  const progressBar = (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-jh-mute">{progress.done} of {progress.total} sections</span>
        <span className="font-mono text-xs text-jh-mute" aria-hidden>{progress.pct}%</span>
      </div>
      {/* Information, not a call to action — ink, not red. */}
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-pill bg-jh-mist" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total} aria-label={`${title} sections filled in`}>
        <div className="h-full rounded-pill bg-jh-ink transition-[width]" style={{ width: `${progress.pct}%` }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        actions={actions ? <div className="hidden md:flex items-center gap-2">{actions}</div> : undefined}
      />

      {status}

      {lead && <div className={active ? "hidden md:block" : ""}>{lead}</div>}

      <div className="md:grid md:grid-cols-[232px_minmax(0,1fr)] md:items-start md:gap-8">
        {/* ---- Desktop rail ---- */}
        <aside className="hidden md:block md:sticky md:top-11 space-y-5">
          {parentRow && <div className="-mt-2">{parentRow}</div>}
          {identity}
          <SectionList items={items} rows={rows} active={shown} variant="rail" label={listLabel} />
          <div className="border-t border-jh-line pt-4">{progressBar}</div>
        </aside>

        <div className="min-w-0">
          {/* ---- Mobile overview ---- */}
          <div className={active ? "hidden" : "md:hidden space-y-6"}>
            {parentRow}
            {identity && <section className="card p-4">{identity}</section>}
            {actions && <div className="flex flex-wrap gap-2 [&>button]:flex-1">{actions}</div>}
            {progressBar}
            <SectionList items={items} rows={rows} variant="rows" label={listLabel} />
          </div>

          {/* ---- Section ---- */}
          <section className={`space-y-4 ${active ? "" : "hidden md:block"}`} aria-labelledby={`${id}-section-title`}>
            <Link href={backHref} className="md:hidden -ml-2 inline-flex min-h-[44px] items-center gap-1 px-2 font-display font-semibold text-sm text-jh-mute hover:text-jh-ink">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {title}
            </Link>
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {meta.group && <p className="section-label mb-1">{meta.group.eyebrow} · {meta.group.label}</p>}
                <h2 id={`${id}-section-title`} className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-jh-mute" strokeWidth={1.5} aria-hidden /> {meta.title}</h2>
                <p className="mt-1 max-w-prose text-sm text-jh-mute">{meta.ask}</p>
              </div>
              {count && <span className="shrink-0 font-mono text-xs text-jh-mute pt-1.5">{count}</span>}
            </header>
            <div className="card p-5">
              {loading ? <p className="text-jh-mute animate-pulse">Loading…</p> : <div key={`${shown}-${panelKey ?? 0}`}>{panel(shown)}</div>}
            </div>
            <nav className="flex items-center justify-between gap-3 md:hidden" aria-label="Neighbouring sections">
              {prev ? <Link href={prev.href} className="btn-secondary btn-sm">← {prev.label}</Link> : <span />}
              {next ? <Link href={next.href} className="btn-secondary btn-sm">{next.label} →</Link> : <span />}
            </nav>
          </section>
        </div>
      </div>
    </div>
  );
}
