"use client";

import { ArrowRight, Compass, FileUp, ListChecks } from "lucide-react";
import { START_PATHS, type StartPathKey } from "@/lib/careerops/maleta";

// Three ways to get started, light to heavy. All three produce the same thing —
// la maleta — so nobody is choosing a dead end: start light today, go through
// the form next week, export the file and bring it back whenever.

const ICONS: Record<StartPathKey, typeof Compass> = {
  compass: Compass,
  intake: ListChecks,
  maleta: FileUp,
};

export default function StartChooser({ onPick, goalRole }: { onPick: (k: StartPathKey) => void; goalRole?: string | null }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg">How would you like to start?</h2>
        <p className="text-jh-mute text-sm mt-1 max-w-2xl">
          All three end up in the same place, and you can switch at any point — nothing you do here is wasted or locked in.
        </p>
      </div>

      <ul className="grid gap-3 md:grid-cols-3">
        {START_PATHS.map((p) => {
          const Icon = ICONS[p.key];
          return (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => onPick(p.key)}
                className="card h-full w-full p-4 text-left space-y-2 transition-colors hover:border-jh-red focus:border-jh-red focus:outline-none"
              >
                <span className="flex items-center gap-2 font-display font-semibold text-jh-ink">
                  <Icon className="h-4 w-4 text-jh-red" strokeWidth={1.5} /> {p.label}
                </span>
                <span className="block text-xs text-jh-mute">{p.blurb}</span>
                {p.key === "compass" && goalRole && (
                  <span className="block text-xs text-jh-ink">
                    Your North Star is already set: <strong>{goalRole}</strong>.
                  </span>
                )}
                <span className="flex items-center justify-between gap-2 border-t border-jh-line pt-2 text-xs">
                  <span className="text-jh-mute-2">{p.asks} · {p.minutes}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-jh-red" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
