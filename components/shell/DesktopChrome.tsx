"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import type { TabItem } from "./MobileChrome";

// Desktop shell chrome — the left sidebar — shared by the live app (AppShell) and
// the admin's 1280×800 preview so the preview is the real chrome, not a mock.
// Widths / paddings are mirrored in COACHING_DESKTOP (lib/coaching-screen.ts).
export const DESKTOP_SIDEBAR_WIDTH = 232;

export function DesktopSidebar({
  items, onSignOut, signingOut = false, position = "fixed", footer,
}: { items: TabItem[]; onSignOut?: () => void; signingOut?: boolean; position?: "fixed" | "static"; footer?: ReactNode }) {
  const fixed = position === "fixed";
  return (
    <aside
      className={`${fixed ? "fixed inset-y-0" : "h-full"} flex flex-col bg-white border-r border-jh-line p-4`}
      style={{ width: DESKTOP_SIDEBAR_WIDTH }}
      aria-label="Sidebar"
    >
      <div className="flex items-center gap-2 mb-8 px-2 pt-1">
        <Image src="/assets/logo-hand.png" alt="JobHackers" width={28} height={28} />
        <span className="font-display font-bold text-jh-ink">Compass</span>
      </div>
      <nav className="flex-1 space-y-1" aria-label="Primary">
        {items.map((item) => {
          const Icon = item.icon;
          // 8px-radius rows; active = red text + icon on the red tint.
          const cls = `flex items-center gap-3 rounded-sm px-3 min-h-[44px] font-display font-semibold text-sm w-full text-left transition-colors duration-200 ease-out ${item.active ? "bg-jh-red-soft text-jh-red" : "text-jh-mute hover:bg-jh-mist hover:text-jh-ink"}`;
          const inner = <><Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {item.label}</>;
          return fixed
            ? <Link key={item.key} href={item.href} className={cls} aria-current={item.active ? "page" : undefined}>{inner}</Link>
            : <span key={item.key} className={cls} aria-current={item.active ? "page" : undefined}>{inner}</span>;
        })}
      </nav>
      {footer}
      <button type="button" onClick={onSignOut} disabled={signingOut || !onSignOut} tabIndex={onSignOut ? undefined : -1}
        className="flex items-center gap-3 rounded-sm px-3 min-h-[44px] font-display font-semibold text-sm text-jh-mute hover:text-jh-red transition-colors duration-200 ease-out disabled:opacity-50 w-full text-left">
        <LogOut className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </aside>
  );
}
