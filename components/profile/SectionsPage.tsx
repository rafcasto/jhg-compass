"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/shell/PageHeader";
import { GROUPS, PAGE_HREF, findSection, profileProgress, sectionHref, type ActiveSection, type ActiveSectionKey, type PageKey, type SectionSummary } from "@/lib/profile-sections";
import SectionList, { SECTION_ICONS } from "./SectionList";

// The one layout behind /profile and /settings — docs/UX_PROFILE.md §1, §7.
//
// Desktop (≥ md): a sticky 232px rail beside the content column; the active
// section lives in ?section= and the first section opens when it is absent.
// Mobile: the overview IS the page (identity, actions, progress, rows); a
// section drills in with a `‹ Page` back row and prev / next at the bottom.
// Both pages pass their sections, the rows that summarise them, and a panel
// renderer; everything else here is the same on purpose.

export default function SectionsPage({
  page, eyebrow, title, intro, actions, identity, sections, rows, active, panel, panelKey, loading = false, status,
}: {
  page: PageKey;
  eyebrow: string;
  title: string;
  intro: string;
  /** Page-level actions (Export · Upload). Header on desktop, under the identity on mobile. */
  actions?: ReactNode;
  /** Who this is — rail top on desktop, a card on the mobile overview. */
  identity?: ReactNode;
  sections: readonly ActiveSection[];
  rows: SectionSummary[];
  active: ActiveSectionKey | null;
  panel: (key: ActiveSectionKey) => ReactNode;
  /** Change to remount the open panel (after an upload replaced its data). */
  panelKey?: string | number;
  loading?: boolean;
  /** A role="status" line under the header. */
  status?: ReactNode;
}) {
  const progress = profileProgress(rows);
  const shown: ActiveSectionKey = active ?? sections[0].key;
  const meta = findSection(shown)!;
  const group = meta.group ? GROUPS.find((g) => g.key === meta.group) : undefined;
  const Icon = SECTION_ICONS[shown];
  const count = rows.find((r) => r.key === shown)?.count;
  const i = sections.findIndex((s) => s.key === shown);
  const prev = sections[i - 1], next = sections[i + 1];
  const listLabel = `${title} sections`;

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

      <div className="md:grid md:grid-cols-[232px_minmax(0,1fr)] md:items-start md:gap-8">
        {/* ---- Desktop rail ---- */}
        <aside className="hidden md:block md:sticky md:top-11 space-y-5">
          {identity}
          <SectionList sections={sections} rows={rows} active={shown} variant="rail" label={listLabel} />
          <div className="border-t border-jh-line pt-4">{progressBar}</div>
        </aside>

        <div className="min-w-0">
          {/* ---- Mobile overview ---- */}
          <div className={active ? "hidden" : "md:hidden space-y-6"}>
            {identity && <section className="card p-4">{identity}</section>}
            {actions && <div className="grid grid-cols-2 gap-2 [&>button]:w-full">{actions}</div>}
            {progressBar}
            <SectionList sections={sections} rows={rows} variant="rows" label={listLabel} />
          </div>

          {/* ---- Section ---- */}
          <section className={`space-y-4 ${active ? "" : "hidden md:block"}`} aria-labelledby={`${page}-section-title`}>
            <Link href={PAGE_HREF[page]} className="md:hidden -ml-2 inline-flex min-h-[44px] items-center gap-1 px-2 font-display font-semibold text-sm text-jh-mute hover:text-jh-ink">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {title}
            </Link>
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {group && <p className="section-label mb-1">{group.eyebrow} · {group.label}</p>}
                <h2 id={`${page}-section-title`} className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-jh-mute" strokeWidth={1.5} aria-hidden /> {meta.title}</h2>
                <p className="mt-1 max-w-prose text-sm text-jh-mute">{meta.ask}</p>
              </div>
              {count && <span className="shrink-0 font-mono text-xs text-jh-mute pt-1.5">{count}</span>}
            </header>
            <div className="card p-5">
              {loading ? <p className="text-jh-mute animate-pulse">Loading…</p> : <div key={`${shown}-${panelKey ?? 0}`}>{panel(shown)}</div>}
            </div>
            <nav className="flex items-center justify-between gap-3 md:hidden" aria-label="Neighbouring sections">
              {prev ? <Link href={sectionHref(prev.key)} className="btn-secondary btn-sm">← {prev.label}</Link> : <span />}
              {next ? <Link href={sectionHref(next.key)} className="btn-secondary btn-sm">{next.label} →</Link> : <span />}
            </nav>
          </section>
        </div>
      </div>
    </div>
  );
}
