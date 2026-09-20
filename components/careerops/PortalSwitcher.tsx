"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronsUpDown, Compass, Briefcase, Check } from "lucide-react";
import { PORTAL_HOME } from "@/lib/careerops/portal-nav";

export type Portal = "compass" | "careerops";

export const PORTALS: { key: Portal; label: string; hint: string; href: string; icon: typeof Compass }[] = [
  { key: "compass", label: "Compass", hint: "Goal, performance, progress board, coaching", href: "/compass", icon: Compass },
  { key: "careerops", label: "CareerOps", hint: "Sourcing · Scoring · Tailoring · Tracking", href: PORTAL_HOME, icon: Briefcase },
];

// The logo section of both shells. When the member has more than one portal
// (CareerOps is switched on per member by the admin), clicking it opens the
// switcher; otherwise it is the plain brand.
export default function PortalSwitcher({ portal, available, compact = false }: { portal: Portal; available: Portal[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = PORTALS.find((p) => p.key === portal) ?? PORTALS[0];
  const canSwitch = available.length > 1;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const brand = (
    <>
      <Image src="/assets/logo-hand.png" alt="JobHackers" width={compact ? 26 : 28} height={compact ? 26 : 28} />
      <span className={`font-display font-bold text-jh-ink ${compact ? "text-sm" : ""}`}>{current.label}</span>
    </>
  );
  if (!canSwitch) return <div className="flex items-center gap-2">{brand}</div>;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`Switch portal (current: ${current.label})`}
        className="flex items-center gap-2 rounded-sm -mx-1 px-1 py-0.5 hover:bg-jh-mist transition-colors">
        {brand}
        <ChevronsUpDown className="h-4 w-4 text-jh-mute" strokeWidth={1.5} aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Portals" className={`absolute z-50 mt-2 w-64 rounded-md border border-jh-line bg-white shadow-jh-2 p-1 ${compact ? "left-0" : "left-0"}`}>
          <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-[.12em] font-display font-semibold text-jh-mute">Switch portal</p>
          {PORTALS.filter((p) => available.includes(p.key)).map((p) => {
            const Icon = p.icon; const active = p.key === portal;
            return (
              <Link key={p.key} role="menuitem" href={p.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={`flex items-start gap-3 rounded-sm px-3 py-2.5 text-left transition-colors ${active ? "bg-jh-red-soft" : "hover:bg-jh-mist"}`}>
                <Icon className={`h-5 w-5 mt-0.5 ${active ? "text-jh-red" : "text-jh-mute"}`} strokeWidth={1.5} aria-hidden />
                <span className="flex-1 min-w-0">
                  <span className={`block font-display font-semibold text-sm ${active ? "text-jh-red" : "text-jh-ink"}`}>{p.label}</span>
                  <span className="block text-xs text-jh-mute">{p.hint}</span>
                </span>
                {active && <Check className="h-4 w-4 text-jh-red mt-1" aria-hidden />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
