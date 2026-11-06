"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, FileUp, Pencil, Plus } from "lucide-react";
import { JH_SETTINGS_HREF } from "@/lib/jobhacking/sections";
import { proofPoints, provenanceLabel, snapshotDetail, snapshotFigures, storyRows, storyStar, type StoryBankSource } from "@/lib/jobhacking/story-bank";
import { storyFact, storyFactFacts } from "@/lib/jobhacking/workbook";
import type { JhgBlock, Snapshot } from "@/lib/careerops/types";
import { FactLines } from "./FileFacts";
import StoryBankEditor from "./StoryBankEditor";

// JobHacking → Artefacts → Story Bank — docs/UX_JOBHACKING.md §3d.
//
// Reads the Packer's narrative.proofPoints · stories · snapshots in the same
// row grammar as the company lists — a quiet mono index, one heavy name, a
// mute second line, a neutral pill — so the two pages read as one portal.
// Nothing here is red: an estimate is how sure the member is of a figure, not
// a failure. Snapshots sit under the story they point at (matched on storyId);
// one no story claims is listed on its own rather than dropped. One secondary
// button, Edit story bank, swaps the read view for the editor (decision
// 2026-11-05: the member adds, changes and removes stories here; an upload
// still replaces the lot).

// Since 2026-11-07 the Packer writes STAR-R stories (situation · task · action
// · result · reflection), snapshots with their context, activities and key
// decisions, proof points with a URL, and — in the workbook — the fact behind
// each story (where, the lead skill, the numbers, the source). All of it is
// read here under the row it belongs to; the editor still edits the few
// fields it always did and carries the rest through.

export default function StoryBankPanel({ uid, source, jhg }: { uid: string; source: StoryBankSource | null | undefined; jhg?: JhgBlock | null }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const points = proofPoints(source);
  const { stories, unlinked } = storyRows(source);

  if (editing) {
    return <StoryBankEditor uid={uid} source={source} onSaved={() => { setEditing(false); setSaved(true); }} onCancel={() => setEditing(false)} />;
  }

  if (!points.length && !stories.length && !unlinked.length) {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <p className="font-display font-semibold text-jh-ink">No stories yet</p>
        <p className="mt-1 text-sm text-jh-mute">Add your proof points, stories and snapshots here — or upload the artefacts.yml your coach&apos;s Packer wrote them into.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => setEditing(true)} className="btn-secondary btn-sm"><Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Add stories</button>
          <Link href={JH_SETTINGS_HREF} className="btn-secondary btn-sm"><FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Upload artefacts</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        {saved ? <p role="status" className="flex items-center gap-2 text-sm text-rb-green-dark"><Check className="h-4 w-4 shrink-0" aria-hidden /> Saved.</p> : <span />}
        <button type="button" onClick={() => { setEditing(true); setSaved(false); }} className="btn-secondary btn-sm">
          <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Edit story bank
        </button>
      </div>

      {points.length > 0 && (
        <section aria-labelledby="sb-proof" className="space-y-3">
          <h3 id="sb-proof" className="section-label">Proof points <Count n={points.length} /></h3>
          <ol className="divide-y divide-jh-line border-t border-jh-line">
            {points.map((p, i) => (
              <li key={`${i}-${p.name}`} className="grid min-h-[44px] grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 py-2">
                <Index n={i + 1} />
                <div className="min-w-0">
                  <p className="font-display text-[15px] font-semibold text-jh-ink">{p.name}</p>
                  {p.heroMetric?.trim() && <p className="text-sm text-jh-mute">{p.heroMetric}</p>}
                </div>
                {p.url?.trim()
                  ? <a href={p.url} target="_blank" rel="noreferrer" className="icon-btn" aria-label={`${p.name} — where it is shown, opens in a new tab`} title="Open"><ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden /></a>
                  : <span />}
              </li>
            ))}
          </ol>
        </section>
      )}

      {stories.length > 0 && (
        <section aria-labelledby="sb-stories" className="space-y-3">
          <h3 id="sb-stories" className="section-label">Stories <Count n={stories.length} /></h3>
          <ol className="divide-y divide-jh-line border-t border-jh-line">
            {stories.map(({ story, snapshots }, i) => {
              const prov = provenanceLabel(story.provenance);
              return (
                <li key={`${story.id ?? i}-${story.title}`} className="grid min-h-[44px] grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 py-2">
                  <Index n={story.id?.trim() || i + 1} />
                  <div className="min-w-0 space-y-1">
                    <p className="font-display text-[15px] font-semibold text-jh-ink">{story.title}</p>
                    {story.result?.trim() && <p className="text-sm text-jh-body">{story.result}</p>}
                    {prov && <p className="text-sm text-jh-mute sm:hidden">{prov}</p>}
                    {/* The STAR-R lines around the result, then the fact behind the story — both the Packer's. */}
                    <FactLines facts={storyStar(story).map((l) => ({ label: l.label, value: l.text }))} />
                    <FactLines facts={storyFactFacts(storyFact(jhg, story))} />
                    {snapshots.length > 0 && (
                      <ul className="space-y-1 pt-1">
                        {snapshots.map((s, j) => <SnapshotLine key={`${s.company}-${j}`} s={s} />)}
                      </ul>
                    )}
                  </div>
                  {/* Below sm the provenance joins the text, so the pill only shows from sm. */}
                  {prov && <span className="pill-neutral hidden sm:inline-flex">{prov}</span>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {unlinked.length > 0 && (
        <section aria-labelledby="sb-snapshots" className="space-y-3">
          <h3 id="sb-snapshots" className="section-label">Snapshots <Count n={unlinked.length} /></h3>
          <ul className="divide-y divide-jh-line border-t border-jh-line">
            {unlinked.map((s, i) => (
              <li key={`${s.company}-${i}`} className="min-h-[44px] py-2">
                <SnapshotLine s={s} lead />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-jh-mute">A verified figure is one you can show a document for; an estimate is your best honest number. Edit here, or upload a new artefacts.yml to replace the lot.</p>
    </div>
  );
}

const Count = ({ n }: { n: number }) => <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{n}</span>;

const Index = ({ n }: { n: number | string }) => (
  <span className="pt-0.5 text-right font-mono text-xs tabular-nums text-jh-mute">{n}<span className="sr-only">.</span></span>
);

/**
 * "Tracksuit — Fortnightly release train · monthly → fortnightly": the company it points at, its title where it
 * differs, the figures to lead with — then, under a disclosure, the context, challenge, role, activities,
 * relevance and key decisions the Packer wrote for that company.
 */
function SnapshotLine({ s, lead = false }: { s: Snapshot; lead?: boolean }) {
  const figures = snapshotFigures(s);
  const title = s.title?.trim();
  const detail = snapshotDetail(s);
  const head = (
    <span className={`flex flex-wrap items-baseline gap-x-2 text-sm ${lead ? "" : "text-jh-mute"}`}>
      <span className={lead ? "font-display text-[15px] font-semibold text-jh-ink" : "text-jh-body"}>{s.company}</span>
      {lead && title && <span className="text-jh-body">{title}</span>}
      {figures && <span className="font-mono text-xs text-jh-mute">{figures}</span>}
    </span>
  );
  if (!detail.length) return <li>{head}</li>;
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-[32px] cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
          {head}
          <span className="text-xs text-jh-mute group-open:hidden">· more</span>
          <span className="sr-only">Show the snapshot for {s.company}</span>
        </summary>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 pb-1 pl-3 text-sm">
          {detail.map((d) => (
            <div key={d.label} className="contents">
              <dt className="text-jh-mute">{d.label}</dt>
              <dd className="text-jh-body">{d.text ?? <ul className="list-disc pl-4">{d.items!.map((x) => <li key={x}>{x}</li>)}</ul>}</dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}
