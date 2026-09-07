"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut, Signal, Wifi, BatteryFull, type LucideProps } from "lucide-react";

// The mobile shell pieces (top header + bottom tab bar), shared by the live app
// (AppShell) and the admin's 390×844 preview so the preview is the real chrome,
// not a mock. Heights are fixed — the Coaching screen's no-scroll layout depends
// on them (see COACHING_VIEWPORT in lib/coaching-screen.ts).
export const MOBILE_HEADER_HEIGHT = 56;
export const MOBILE_TABBAR_HEIGHT = 58;

export interface TabItem {
  key: string;
  label: string;
  icon: ComponentType<LucideProps>;
  href: string;
  active?: boolean;
}

export function MobileHeader({
  onSignOut, signingOut = false, position = "sticky",
}: { onSignOut?: () => void; signingOut?: boolean; position?: "sticky" | "static" }) {
  return (
    <header className={`${position === "sticky" ? "sticky top-0 z-40" : ""} flex items-center justify-between h-14 px-4 bg-white border-b border-jh-line`}>
      <div className="flex items-center gap-2">
        <Image src="/assets/logo-hand.png" alt="JobHackers" width={26} height={26} />
        <span className="font-display font-bold text-jh-ink text-sm">Compass</span>
      </div>
      <button type="button" onClick={onSignOut} disabled={signingOut || !onSignOut} tabIndex={onSignOut ? undefined : -1}
        className="flex items-center gap-1.5 min-h-[44px] px-1 font-display font-semibold text-sm text-jh-mute hover:text-jh-red transition-colors duration-200 ease-out disabled:opacity-50">
        <LogOut className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </header>
  );
}

// Bottom tabs: icon-over-label, ≥44px hit target, active tab in red.
// `position: "fixed"` is the live app; "static" renders inert tabs for previews.
export function BottomTabBar({ items, position = "fixed" }: { items: TabItem[]; position?: "fixed" | "static" }) {
  const fixed = position === "fixed";
  return (
    <nav
      className={`${fixed ? "fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)]" : ""} bg-white border-t border-jh-line flex`}
      style={{ height: fixed ? `calc(${MOBILE_TABBAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))` : MOBILE_TABBAR_HEIGHT }}
      aria-label="Primary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const cls = `flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 text-[11px] font-display font-semibold transition-colors duration-200 ease-out ${item.active ? "text-jh-red" : "text-jh-mute hover:text-jh-ink"}`;
        const inner = <><Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {item.label}</>;
        return fixed
          ? <Link key={item.key} href={item.href} className={cls} aria-current={item.active ? "page" : undefined}>{inner}</Link>
          : <span key={item.key} className={cls} aria-current={item.active ? "page" : undefined}>{inner}</span>;
      })}
    </nav>
  );
}

// iOS-style status bar for the admin preview only (the real one is the device's).
export function PreviewStatusBar() {
  return (
    <div className="flex items-center justify-between h-11 px-5 bg-white text-jh-ink" aria-hidden>
      <span className="font-display font-semibold text-[15px]">9:41</span>
      <span className="flex items-center gap-1.5">
        <Signal className="h-4 w-4" strokeWidth={1.5} />
        <Wifi className="h-4 w-4" strokeWidth={1.5} />
        <BatteryFull className="h-4 w-4" strokeWidth={1.5} />
      </span>
    </div>
  );
}
