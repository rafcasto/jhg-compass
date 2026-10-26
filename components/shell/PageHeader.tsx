import type { ReactNode } from "react";

// The one page header for the Compass tabs (Compass · Performance · Progress):
// muted eyebrow → h1 (global 30/36px) → optional intro, with the page's actions
// right-aligned. Keeps the three tabs on the same hierarchy instead of each
// hand-rolling its own sizes.
//
// The intro takes the full width of the text column. On a phone the actions drop
// below the text instead of squeezing it into a sliver beside the buttons.
export default function PageHeader({ eyebrow, title, intro, actions, className = "" }: {
  eyebrow?: string;
  title: string;
  intro?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${className}`}>
      <div className="min-w-0 flex-1">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="mt-1">{title}</h1>
        {intro && <p className="mt-2 text-sm text-jh-mute">{intro}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">{actions}</div>}
    </header>
  );
}
