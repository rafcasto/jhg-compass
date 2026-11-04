"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import WatchlistPanel from "@/components/careerops/WatchlistPanel";
import { watchlistRows } from "@/lib/jobhacking/company-lists";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import CompanyRow from "./CompanyRow";

// JobHacking → Target companies → Watchlist — docs/UX_JOBHACKING.md §3c.
//
// Reads like the ranked lists (the same CompanyRow: position · name + second
// line · type pill · careers target), then the title keywords as two groups
// of pills. One secondary button, Edit watchlist, swaps the read view for the
// shared editor (WatchlistPanel → Portals) with Save and Cancel; a save
// returns here. The industry line and company type on a row are borrowed
// from the Packer's lists where the company name matches — never invented.

export default function WatchlistSection({ uid, setup, goalRole }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  goalRole?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const portals = setup?.portals;
  const rows = useMemo(() => watchlistRows(portals?.companies, setup?.companyLists), [portals?.companies, setup?.companyLists]);
  const positive = portals?.positive ?? [];
  const negative = portals?.negative ?? [];

  if (editing) {
    return <WatchlistPanel uid={uid} setup={setup} goalRole={goalRole} intro={false} onSaved={() => { setEditing(false); setSaved(true); }} onCancel={() => setEditing(false)} />;
  }

  if (!rows.length) {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <p className="font-display font-semibold text-jh-ink">No companies on your watchlist yet</p>
        <p className="mt-1 text-sm text-jh-mute">Add each company with the page that lists its jobs, and the titles to include and exclude.</p>
        <button type="button" onClick={() => setEditing(true)} className="btn-secondary btn-sm mt-4"><Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Add companies</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saved && <p role="status" className="flex items-center gap-2 text-sm text-rb-green-dark"><Check className="h-4 w-4 shrink-0" aria-hidden /> Saved.</p>}

      <section aria-labelledby="jh-watchlist-companies" className="space-y-3">
        <header className="flex items-center justify-between gap-3">
          <h3 id="jh-watchlist-companies" className="section-label flex items-center gap-2">
            Companies <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{rows.length}</span>
          </h3>
          <button type="button" onClick={() => { setEditing(true); setSaved(false); }} className="btn-secondary btn-sm">
            <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Edit watchlist
          </button>
        </header>
        <ol className="divide-y divide-jh-line border-t border-jh-line">
          {rows.map((r) => <CompanyRow key={`${r.c.rank}-${r.c.name}`} c={r.c} secondLine={r.secondLine} />)}
        </ol>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Keywords id="jh-watchlist-include" label="Titles to include" items={positive} empty="Nothing yet — every title is listed." />
        <Keywords id="jh-watchlist-exclude" label="Titles to exclude" items={negative} empty="Nothing excluded." />
      </div>
    </div>
  );
}

function Keywords({ id, label, items, empty }: { id: string; label: string; items: readonly string[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="section-label">{label} <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{items.length}</span></h3>
      {items.length
        ? <ul className="flex flex-wrap gap-2">{items.map((k) => <li key={k} className="pill-visible">{k}</li>)}</ul>
        : <p className="text-sm text-jh-mute">{empty}</p>}
    </section>
  );
}
