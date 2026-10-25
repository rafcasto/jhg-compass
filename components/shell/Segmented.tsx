"use client";

import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export interface SegmentedItem<K extends string> {
  key: K;
  label: string;
  icon?: ComponentType<LucideProps>;
  /** Small count. `alert` is the only red allowed here (open reminders). */
  badge?: { n: number; tone?: "neutral" | "alert" };
}

// Segmented control: white active pill on a mist track. Shared by the Progress
// view switch and the Performance period toggle so both tabs use the same one.
// 4px inner radius inside an 8px track with 4px padding — nested radii stay ≤ outer − padding.
export default function Segmented<K extends string>({ items, value, onChange, fill = false, label }: {
  items: SegmentedItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Stretch to the container and give every segment equal width. */
  fill?: boolean;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className={`${fill ? "flex w-full" : "inline-flex"} rounded-sm bg-jh-mist p-1`}>
      {items.map(({ key, label: text, icon: Icon, badge }) => {
        const active = key === value;
        return (
          <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={active}
            className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xs px-3 py-1.5 font-display text-sm font-semibold transition-colors duration-200 ease-out
              ${fill ? "flex-1" : ""} ${active ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute hover:text-jh-ink"}`}>
            {Icon && <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
            {text}
            {badge && (
              <span className={`ml-0.5 min-w-[18px] rounded-pill px-1.5 text-center text-[11px] leading-[18px]
                ${badge.tone === "alert" ? "bg-jh-red text-white" : "bg-jh-line text-jh-mute"}`}>
                {badge.n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
