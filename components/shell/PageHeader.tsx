import type { ReactNode } from "react";

// The one page header for the Compass tabs (Compass · Performance · Progress):
// muted eyebrow → h1 (global 30/36px) → optional intro, with the page's actions
// right-aligned. Keeps the three tabs on the same hierarchy instead of each
// hand-rolling its own sizes.
export default function PageHeader({ eyebrow, title, intro, actions, className = "" }: {
  eyebrow?: string;
  title: string;
  intro?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="mt-1">{title}</h1>
        {intro && <p className="mt-2 max-w-prose text-sm text-jh-mute">{intro}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
    </header>
  );
}
