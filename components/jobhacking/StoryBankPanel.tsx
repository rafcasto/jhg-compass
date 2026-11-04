"use client";

import Link from "next/link";
import { FileUp } from "lucide-react";
import { JH_SETTINGS_HREF } from "@/lib/jobhacking/sections";
import { proofPoints, provenanceLabel, snapshotFigures, storyRows, type StoryBankSource } from "@/lib/jobhacking/story-bank";
import type { Snapshot } from "@/lib/careerops/types";

// JobHacking → Artefacts → Story Bank — docs/UX_JOBHACKING.md §3d.
//
// Read-only: the Packer writes narrative.proofPoints · stories · snapshots into
// profile.yml, the member reads them here. The same row grammar as the company
// lists — a quiet mono index, one heavy name, a mute second line, a neutral
// pill — so the two read-only pages read as one portal. Nothing here is red:
// an estimate is how sure the member is of a figure, not a failure. Snapshots
// sit under the story they point at (matched on storyId); one no story claims
// is listed on its own rather than dropped.

export default function StoryBankPanel({ source }: { source: StoryBankSource | null | undefined }) {
  const points = proofPoints(source);
  const { stories, unlinked } = storyRows(source);

  if (!points.length && !stories.length && !unlinked.length) {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <p className="font-display font-semibold text-jh-ink">No stories yet</p>
        <p className="mt-1 text-sm text-jh-mute">Your coach&apos;s Packer writes your proof points, stories and snapshots into your profile.yml. Upload it and they appear here.</p>
        <Link href={JH_SETTINGS_HREF} className="btn-secondary btn-sm mt-4"><FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Upload profile</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {points.length > 0 && (
        <section aria-labelledby="sb-proof" className="space-y-3">
          <h3 id="sb-proof" className="section-label">Proof points <Count n={points.length} /></h3>
          <ol className="divide-y divide-jh-line border-t border-jh-line">
            {points.map((p, i) => (
              <li key={`${i}-${p.name}`} className="grid min-h-[44px] grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 py-2">
                <Index n={i + 1} />
                <div className="min-w-0">
                  <p className="font-display text-[15px] font-semibold text-jh-ink">{p.name}</p>
                  {p.heroMetric?.trim() && <p className="text-sm text-jh-mute">{p.heroMetric}</p>}
                </div>
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
                    {snapshots.length > 0 && (
                      <ul className="space-y-0.5 pt-1">
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

      <p className="text-xs text-jh-mute">Written by your coach. A verified figure is one you can show a document for; an estimate is your best honest number. Upload a new profile.yml to change them.</p>
    </div>
  );
}

const Count = ({ n }: { n: number }) => <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{n}</span>;

const Index = ({ n }: { n: number | string }) => (
  <span className="pt-0.5 text-right font-mono text-xs tabular-nums text-jh-mute">{n}<span className="sr-only">.</span></span>
);

/** "Tracksuit — Fortnightly release train · monthly → fortnightly": the company it points at, its title where it differs, the figures to lead with. */
function SnapshotLine({ s, lead = false }: { s: Snapshot; lead?: boolean }) {
  const figures = snapshotFigures(s);
  const title = s.title?.trim();
  return (
    <li className={`flex flex-wrap items-baseline gap-x-2 text-sm ${lead ? "" : "text-jh-mute"}`}>
      <span className={lead ? "font-display text-[15px] font-semibold text-jh-ink" : "text-jh-body"}>{s.company}</span>
      {lead && title && <span className="text-jh-body">{title}</span>}
      {figures && <span className="font-mono text-xs text-jh-mute">{figures}</span>}
    </li>
  );
}
