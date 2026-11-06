"use client";

import Link from "next/link";
import { ExternalLink, FileUp } from "lucide-react";
import { JH_SETTINGS_HREF } from "@/lib/jobhacking/sections";
import type { Fact, FactList } from "@/lib/jobhacking/workbook";

// The read-only block under a JobHacking editor — docs/UX_JOBHACKING.md §5
// (2026-11-07). What the coach's file carries beside the field the member
// edits: a `dl` of label · value pairs, lists as pills, a one-line note.
// Quiet on purpose — `.section-label`, mute labels, body text — so the editor
// above stays the one thing to do. Nothing red; a URL is one `.icon-btn`.
// Shown only when the file carried something; otherwise one line pointing at
// Settings, or nothing at all when `empty` is not given.

export default function FileFacts({ id, title, from, facts = [], lists = [], pills = [], text, note, empty, children }: {
  id: string;
  /** The block's heading — "From your True North file". */
  title: string;
  /** The file it came from — "true-north.yml" — for the sr-only hint. */
  from?: string;
  facts?: readonly Fact[];
  lists?: readonly FactList[];
  /** One group of pills with no heading of its own. */
  pills?: readonly string[];
  /** A pasteable paragraph (a headline, a one-liner). */
  text?: string;
  /** A line under the block. */
  note?: string;
  /** What to say when there is nothing yet; omit to render nothing. */
  empty?: string;
  children?: React.ReactNode;
}) {
  const has = facts.length > 0 || lists.length > 0 || pills.length > 0 || !!text?.trim() || !!children;
  if (!has) {
    if (!empty) return null;
    return (
      <section aria-labelledby={id} className="border-t border-jh-line pt-4">
        <h3 id={id} className="section-label">{title}</h3>
        <p className="mt-2 text-sm text-jh-mute">{empty} <Link href={JH_SETTINGS_HREF} className="link text-sm"><FileUp className="inline h-3.5 w-3.5 align-[-2px]" strokeWidth={1.5} aria-hidden /> Upload it</Link></p>
      </section>
    );
  }
  return (
    <section aria-labelledby={id} className="space-y-3 border-t border-jh-line pt-4">
      <h3 id={id} className="section-label">{title}{from && <span className="sr-only"> ({from})</span>}</h3>
      {text?.trim() && <p className="whitespace-pre-wrap rounded-sm border border-jh-line bg-jh-mist/40 p-3 text-sm text-jh-body">{text}</p>}
      {pills.length > 0 && <ul className="flex flex-wrap gap-2">{pills.map((p) => <li key={p} className="pill-visible">{p}</li>)}</ul>}
      {facts.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
          {facts.map((f) => (
            <FactPair key={f.label} f={f} />
          ))}
        </dl>
      )}
      {lists.map((l) => (
        <div key={l.label}>
          <p className="label">{l.label} <span className="font-mono text-xs">{l.items.length}</span></p>
          <ul className="flex flex-wrap gap-2">{l.items.map((x) => <li key={x} className="pill-visible">{x}</li>)}</ul>
        </div>
      ))}
      {children}
      {note && <p className="text-xs text-jh-mute">{note}</p>}
    </section>
  );
}

function FactPair({ f }: { f: Fact }) {
  return (
    <>
      <dt className="text-jh-mute">{f.label}</dt>
      <dd className="flex min-w-0 items-start gap-1 text-jh-body">
        <span className="min-w-0 whitespace-pre-wrap">{f.value}</span>
        {f.url && (
          <a href={f.url} target="_blank" rel="noreferrer" className="icon-btn icon-btn-tight shrink-0" aria-label={`${f.label} — source, opens in a new tab`} title="Open">
            <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </a>
        )}
      </dd>
    </>
  );
}

/** A compact label · value list inside a row (a story's STAR lines, a Top 10 thesis). */
export function FactLines({ facts }: { facts: readonly Fact[] }) {
  if (!facts.length) return null;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 pt-1 text-sm">
      {facts.map((f) => <FactPair key={f.label} f={f} />)}
    </dl>
  );
}
