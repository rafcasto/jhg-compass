"use client";

import Link from "next/link";
import { ExternalLink, FileUp } from "lucide-react";
import { JH_SETTINGS_HREF } from "@/lib/jobhacking/sections";
import { boundaryFacts, boundaryLists, fitLabel, hasBoundaries, identityFacts, isoDate, locationFacts, outlookLabel, salaryFacts } from "@/lib/jobhacking/workbook";
import type { CareerOpsSetupV2, JhgBlock } from "@/lib/careerops/types";
import type { TrueNorthSection } from "./TrueNorthPanel";
import FileFacts from "./FileFacts";

// What the four Packer files carry BESIDE the fields the member edits —
// docs/UX_JOBHACKING.md §5 (2026-11-07). Each JobHacking section renders its
// editor, then the read-only block from its file: the Narrative file's
// headline, superpowers and lead skills; the True North file's titles,
// clusters, industries, boundaries and postings; the Artefacts file's CV
// house rules. All through FileFacts, so every block reads the same. Nothing
// here is editable and nothing is invented: every line is a key the file has.

type Jhg = JhgBlock | null | undefined;

// ---- Narrative ----

export function ContactFacts({ jhg }: { jhg: Jhg }) {
  return <FileFacts id="wb-identity" title="From your Narrative file" from="narrative.yml" facts={identityFacts(jhg)} />;
}

export function HeadlineFacts({ setup }: { setup: CareerOpsSetupV2 | null | undefined }) {
  const headline = setup?.narrative?.headline?.trim();
  return (
    <FileFacts id="wb-headline" title="Positioning line — from your Narrative file" from="narrative.yml" text={headline}
      note={headline ? "The one sentence your coach wrote for the top of your LinkedIn and CV summary: who you help, with what, through which skills." : undefined}
      empty="Your coach's one-sentence positioning line lands here from narrative.yml." />
  );
}

export function StoryFacts({ jhg }: { jhg: Jhg }) {
  return <FileFacts id="wb-bridge" title="One-line version — from your Narrative file" from="narrative.yml" text={jhg?.narrative?.bridgeStoryOneLine?.trim()} note="The bridge story in one breath — for a recruiter screen or the first line of a message." />;
}

export function CompetencyFacts({ setup, jhg }: { setup: CareerOpsSetupV2 | null | undefined; jhg: Jhg }) {
  const superpowers = setup?.narrative?.superpowers ?? [];
  const lead = jhg?.narrative?.leadSkills ?? [];
  if (!superpowers.length && !lead.length) return null;
  return (
    <FileFacts id="wb-competencies" title="From your Narrative file" from="narrative.yml"
      lists={[{ label: "Superpowers", items: superpowers }, { label: "Lead skills", items: lead }].filter((l) => l.items.length)}
      note="Superpowers are what you're hired for; lead skills are the three your stories prove." />
  );
}

// ---- True North ----

export function TrueNorthFacts({ section, jhg }: { section: TrueNorthSection; jhg: Jhg }) {
  const tn = jhg?.trueNorth;
  if (!tn) return null;
  switch (section) {
    case "industry": {
      const industries = (tn.industries ?? []).filter((i) => i.name?.trim());
      if (!industries.length) return null;
      return (
        <FileFacts id="wb-industries" title="Industries your coach researched — from your True North file" from="true-north.yml" note="Sunrise sub-sectors are growing; sunset ones are shrinking. Aim at sunrise.">
          <ul className="divide-y divide-jh-line border-t border-jh-line">
            {industries.map((ind) => (
              <li key={ind.name} className="py-2">
                <p className="font-display text-[15px] font-semibold text-jh-ink">{ind.name}</p>
                {!!ind.subSectors?.length && (
                  <ul className="mt-1 space-y-1">
                    {ind.subSectors.filter((s) => s.name?.trim()).map((s) => (
                      <li key={s.name} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="text-jh-body">{s.name}</span>
                        {s.outlook && <span className="pill-neutral">{outlookLabel(s.outlook)}</span>}
                        {s.growthSignal && <span className="text-jh-mute">{s.growthSignal}</span>}
                        {s.source && <a href={s.source} target="_blank" rel="noreferrer" className="icon-btn icon-btn-tight" aria-label={`${s.name} — growth source, opens in a new tab`} title="Source"><ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden /></a>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </FileFacts>
      );
    }
    case "roles": {
      const titles = tn.titles;
      const clusters = (tn.clusters ?? []).filter((c) => c.name?.trim());
      const postings = (tn.postings ?? []).filter((p) => p.title?.trim());
      const keepers = tn.keepers ?? [];
      const titleLists = [
        { label: "Target titles", items: titles?.target ?? [] },
        { label: "Analog titles — same job, another name", items: titles?.analog ?? [] },
        { label: "Titles to exclude", items: titles?.exclude ?? [] },
        { label: "Keeper phrases — the words the postings use", items: keepers },
      ].filter((l) => l.items.length);
      if (!titleLists.length && !clusters.length && !postings.length) return null;
      return (
        <>
          <FileFacts id="wb-titles" title="Titles and clusters — from your True North file" from="true-north.yml" lists={titleLists}>
            {clusters.length > 0 && (
              <ul className="divide-y divide-jh-line border-t border-jh-line">
                {clusters.map((c) => (
                  <li key={c.name} className="py-2">
                    <p className="flex flex-wrap items-center gap-2 font-display text-[15px] font-semibold text-jh-ink">
                      {c.name}
                      {c.fit && <span className="pill-neutral">{fitLabel(c.fit)}</span>}
                      {c.level && <span className="pill-neutral">{c.level}</span>}
                    </p>
                    {!!c.titles?.length && <p className="text-sm text-jh-mute">{c.titles.join(" · ")}</p>}
                    {!!c.axes?.length && <p className="text-sm text-jh-body">Axes: {c.axes.join(", ")}</p>}
                    {c.buys && <p className="text-sm text-jh-body">They buy: {c.buys}</p>}
                  </li>
                ))}
              </ul>
            )}
          </FileFacts>
          {postings.length > 0 && (
            <FileFacts id="wb-postings" title="Postings your coach read" from="true-north.yml" note="The live postings the titles and phrases came from, with the date each was checked.">
              <ul className="divide-y divide-jh-line border-t border-jh-line">
                {postings.map((p, i) => (
                  <li key={`${p.title}-${i}`} className="grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-[15px] font-semibold text-jh-ink">{p.title}{p.company && <span className="font-body font-normal text-jh-mute"> · {p.company}</span>}</p>
                      <p className="truncate text-sm text-jh-mute">{[p.location, p.phrases?.length ? p.phrases.join(" · ") : "", p.verified ? `checked ${isoDate(p.verified)}` : ""].filter(Boolean).join(" · ")}</p>
                    </div>
                    {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="icon-btn" aria-label={`${p.title} at ${p.company ?? "the company"} — opens in a new tab`} title="Open posting"><ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden /></a> : <span />}
                  </li>
                ))}
              </ul>
            </FileFacts>
          )}
        </>
      );
    }
    case "salary": {
      const b = tn.boundaries;
      return <FileFacts id="wb-salary" title="From your True North file" from="true-north.yml" facts={salaryFacts(b)} lists={b?.negotiationLines?.length ? [{ label: "Negotiation lines", items: b.negotiationLines }] : []} />;
    }
    case "location":
      return <FileFacts id="wb-location" title="From your True North file" from="true-north.yml" facts={locationFacts(tn.boundaries)} />;
    case "company-type":
      return <FileFacts id="wb-company-type" title="From your True North file" from="true-north.yml" facts={tn.companyType ? [{ label: "Company type", value: tn.companyType }] : []} />;
    case "seniority":
      return null;
  }
}

/** The Boundaries section — read-only, the True North file's rules that screen a role out before scoring. */
export function BoundariesPanel({ jhg }: { jhg: Jhg }) {
  if (!hasBoundaries(jhg)) {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <p className="font-display font-semibold text-jh-ink">No boundaries yet</p>
        <p className="mt-1 text-sm text-jh-mute">Your coach writes your hard no&apos;s, culture must-haves and never-apply list into true-north.yml. Upload it and they appear here.</p>
        <Link href={JH_SETTINGS_HREF} className="btn-secondary btn-sm mt-4"><FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Upload True North</Link>
      </div>
    );
  }
  const b = jhg!.trueNorth!.boundaries;
  return (
    <div className="space-y-6">
      {boundaryLists(b).map((l) => (
        <section key={l.label} aria-labelledby={`bd-${l.label}`} className="space-y-2">
          <h3 id={`bd-${l.label}`} className="section-label">{l.label} <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{l.items.length}</span></h3>
          <ul className="flex flex-wrap gap-2">{l.items.map((x) => <li key={x} className="pill-visible">{x}</li>)}</ul>
        </section>
      ))}
      {boundaryFacts(b).length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
          {boundaryFacts(b).map((f) => <div key={f.label} className="contents"><dt className="text-jh-mute">{f.label}</dt><dd className="text-jh-body">{f.value}</dd></div>)}
        </dl>
      )}
      <p className="text-xs text-jh-mute">Written by your coach. A hard no rules a role out; a soft dislike lowers it; a culture must-have missing from a posting deprioritises it. Upload a new true-north.yml to change them.</p>
    </div>
  );
}
