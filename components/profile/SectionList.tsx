"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { Check, ChevronRight, Circle, CircleDashed, type LucideProps } from "lucide-react";
import type { StepState } from "@/lib/careerops/intake-wizard";

// The section list of every sectioned page (the JobHacking pages and the
// Settings areas) and of the Settings hub, in two densities from one shape:
//   rail — desktop, beside the content (the sidebar's row recipe)
//   rows — mobile, the page itself: each row quotes the data, tap to drill in
// Items may carry a group (Who am I · What's my target); the group's question
// is a `.section-label` above its rows. State is a glyph + text, never colour
// alone; "partial" is mute, not red — a half-filled section is not a negative
// state (UX audit §0.4).
//
// The list knows nothing about where its items come from: `SectionItem` is the
// one shape the registry (lib/jobhacking/sections) maps onto — a section on an
// area page, an area on the hub.

export interface SectionGroupInfo { key: string; eyebrow: string; label: string }

export interface SectionItem<K extends string = string> {
  key: K;
  /** Rail / row label — short. */
  label: string;
  /** The heading on the section itself. */
  title: string;
  /** One line under the heading: what this section is for. */
  ask: string;
  /** Deep link that opens the section. */
  href: string;
  icon: ComponentType<LucideProps>;
  group?: SectionGroupInfo;
}

export interface SectionRow<K extends string = string> {
  key: K;
  state: StepState;
  /** One line quoting the data, or "Not set". */
  summary: string;
  /** A small count for the row's right edge, when one makes sense. */
  count?: string;
}

/** Consecutive items with the same group, in order. Ungrouped runs have `group: null`. */
export function groupItems<K extends string>(items: readonly SectionItem<K>[]): { group: SectionGroupInfo | null; items: SectionItem<K>[] }[] {
  const out: { group: SectionGroupInfo | null; items: SectionItem<K>[] }[] = [];
  for (const it of items) {
    const group = it.group ?? null;
    const last = out[out.length - 1];
    if (last && last.group?.key === group?.key) last.items.push(it);
    else out.push({ group, items: [it] });
  }
  return out;
}

const STATE_ICON: Record<StepState, ComponentType<LucideProps>> = { done: Check, partial: CircleDashed, empty: Circle };
const STATE_TONE: Record<StepState, string> = { done: "text-rb-green-dark", partial: "text-jh-mute", empty: "text-jh-mute-2" };
const STATE_TEXT: Record<StepState, string> = { done: "done", partial: "started", empty: "not set" };

export default function SectionList<K extends string>({ items, rows, active, variant, label }: {
  /** This page's sections, in order. */
  items: readonly SectionItem<K>[];
  rows: readonly SectionRow<K>[];
  /** Highlighted in the rail; ignored by rows. */
  active?: K | null;
  variant: "rail" | "rows";
  /** Accessible name of the whole list. */
  label: string;
}) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const groups = groupItems(items);
  const rowOf = (key: K): SectionRow<K> => byKey.get(key) ?? { key, state: "empty", summary: "Not set" };

  if (variant === "rail") {
    return (
      <nav aria-label={label} className="space-y-4">
        {groups.map(({ group, items: list }, gi) => (
          <div key={group?.key ?? gi} className="space-y-1">
            {group && <p className="section-label px-3 pb-1">{group.label}</p>}
            {list.map((s) => {
              const row = rowOf(s.key);
              const StateIcon = STATE_ICON[row.state];
              const isActive = s.key === active;
              return (
                <Link
                  key={s.key}
                  href={s.href}
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
      {groups.map(({ group, items: list }, gi) => (
        <section key={group?.key ?? gi} aria-label={group?.label}>
          {group && <p className="section-label mb-2">{group.label}</p>}
          <ul className="card divide-y divide-jh-line">
            {list.map((s) => {
              const row = rowOf(s.key);
              const StateIcon = STATE_ICON[row.state];
              return (
                <li key={s.key}>
                  <Link href={s.href} className="flex items-center gap-3 px-4 py-3 min-h-[44px] transition-colors duration-200 ease-out hover:bg-jh-mist focus-visible:bg-jh-mist">
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
