"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
  Building2, Check, ChevronRight, Circle, CircleDashed, Compass, Contact, FileText, Globe, KeyRound, Layers, MapPin,
  Quote, Sparkles, StickyNote, Target, type LucideProps,
} from "lucide-react";
import { groupedSections, sectionHref, type ActiveSection, type ActiveSectionKey, type SectionSummary } from "@/lib/profile-sections";
import type { StepState } from "@/lib/careerops/intake-wizard";

// The section list of the Profile and Settings pages, in two densities from one
// registry:
//   rail — desktop, beside the content (the sidebar's row recipe)
//   rows — mobile, the page itself: each row quotes the data, tap to drill in
// Profile-page sections come in three groups (Who am I · What's my target ·
// What value do I create); the group's question is a `.section-label` above
// its rows. State is a glyph + text, never colour alone; "partial" is mute,
// not red — a half-filled section is not a negative state (UX audit §0.4).

export const SECTION_ICONS: Record<ActiveSectionKey, ComponentType<LucideProps>> = {
  contact: Contact, headline: Quote, story: Sparkles, northstar: Compass, logistics: MapPin, targeting: Target,
  cv: FileText, companies: Building2, accounts: KeyRound, archetypes: Layers, portfolio: Globe, notes: StickyNote,
};

const STATE_ICON: Record<StepState, ComponentType<LucideProps>> = { done: Check, partial: CircleDashed, empty: Circle };
const STATE_TONE: Record<StepState, string> = { done: "text-rb-green-dark", partial: "text-jh-mute", empty: "text-jh-mute-2" };
const STATE_TEXT: Record<StepState, string> = { done: "done", partial: "started", empty: "not set" };

export default function SectionList({ sections, rows, active, variant, label }: {
  /** This page's sections, in order. */
  sections: readonly ActiveSection[];
  rows: SectionSummary[];
  /** Highlighted in the rail; ignored by rows. */
  active?: ActiveSectionKey | null;
  variant: "rail" | "rows";
  /** Accessible name of the whole list. */
  label: string;
}) {
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r])) as Record<ActiveSectionKey, SectionSummary>;
  const groups = groupedSections(sections);

  if (variant === "rail") {
    return (
      <nav aria-label={label} className="space-y-4">
        {groups.map(({ group, sections: list }, gi) => (
          <div key={group?.key ?? gi} className="space-y-1">
            {group && <p className="section-label px-3 pb-1">{group.label}</p>}
            {list.map((s) => {
              const row = byKey[s.key];
              const StateIcon = STATE_ICON[row.state];
              const isActive = s.key === active;
              return (
                <Link
                  key={s.key}
                  href={sectionHref(s.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-sm px-3 min-h-[44px] font-display font-semibold text-sm transition-colors duration-200 ease-out ${isActive ? "bg-jh-red-soft text-jh-red" : "text-jh-mute hover:bg-jh-mist hover:text-jh-ink"}`}
                >
                  <StateIcon className={`h-4 w-4 shrink-0 ${isActive ? "" : STATE_TONE[row.state]}`} strokeWidth={2} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  {row.count && <span className={`font-mono text-xs font-normal ${isActive ? "text-jh-red" : "text-jh-mute"}`}>{row.count}</span>}
                  <span className="sr-only"> — {STATE_TEXT[row.state]}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div className="space-y-6" role="navigation" aria-label={label}>
      {groups.map(({ group, sections: list }, gi) => (
        <section key={group?.key ?? gi} aria-label={group?.label}>
          {group && <p className="section-label mb-2">{group.label}</p>}
          <ul className="card divide-y divide-jh-line">
            {list.map((s) => {
              const row = byKey[s.key];
              const StateIcon = STATE_ICON[row.state];
              return (
                <li key={s.key}>
                  <Link href={sectionHref(s.key)} className="flex items-center gap-3 px-4 py-3 min-h-[44px] transition-colors duration-200 ease-out hover:bg-jh-mist focus-visible:bg-jh-mist">
                    <StateIcon className={`h-4 w-4 shrink-0 ${STATE_TONE[row.state]}`} strokeWidth={2} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="font-display font-semibold text-[15px] text-jh-ink">{s.label}</span>
                        {row.count && <span className="font-mono text-xs text-jh-mute">{row.count}</span>}
                      </span>
                      <span className="block truncate text-sm text-jh-mute">{row.summary}</span>
                      <span className="sr-only"> — {STATE_TEXT[row.state]}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-jh-mute-2" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
