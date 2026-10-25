"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut, UserRound } from "lucide-react";
import type { TabItem } from "./MobileChrome";

// Desktop shell chrome — the left sidebar — shared by the live app (AppShell) and
// the admin's 1280×800 preview so the preview is the real chrome, not a mock.
// Widths / paddings are mirrored in COACHING_DESKTOP (lib/coaching-screen.ts).
export const DESKTOP_SIDEBAR_WIDTH = 232;

// One row recipe for every sidebar link (primary tabs + Profile) so they can't
// drift apart: 8px radius, 44px tall, active = red text + icon on the red tint.
const rowCls = (active?: boolean) =>
  `flex items-center gap-3 rounded-sm px-3 min-h-[44px] font-display font-semibold text-sm w-full text-left transition-colors duration-200 ease-out ${active ? "bg-jh-red-soft text-jh-red" : "text-jh-mute hover:bg-jh-mist hover:text-jh-ink"}`;

export function DesktopSidebar({
  items, onSignOut, signingOut = false, position = "fixed", footer, brand, profileHref = "/profile", profileActive = false,
}: {
  items: TabItem[]; onSignOut?: () => void; signingOut?: boolean; position?: "fixed" | "static"; footer?: ReactNode; brand?: ReactNode;
  profileHref?: string; profileActive?: boolean;
}) {
  const fixed = position === "fixed";
  const profileInner = <><UserRound className="h-5 w-5" strokeWidth={1.5} aria-hidden /> Profile</>;
  return (
    <aside
      className={`${fixed ? "fixed inset-y-0" : "h-full"} flex flex-col bg-white border-r border-jh-line p-4`}
      style={{ width: DESKTOP_SIDEBAR_WIDTH }}
      aria-label="Sidebar"
    >
      {/* Logo section — the live app passes a portal switcher (Compass ⇄ CareerOps); previews get the static brand. */}
      <div className="mb-8 px-2 pt-1">
        {brand ?? (
          <div className="flex items-center gap-2">
            <Image src="/assets/logo-hand.png" alt="JobHackers" width={28} height={28} />
            <span className="font-display font-bold text-jh-ink">Compass</span>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1" aria-label="Primary">
        {items.map((item) => {
          const Icon = item.icon;
          const cls = rowCls(item.active);
          const inner = <><Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {item.label}</>;
          return fixed
            ? <Link key={item.key} href={item.href} className={cls} aria-current={item.active ? "page" : undefined}>{inner}</Link>
            : <span key={item.key} className={cls} aria-current={item.active ? "page" : undefined}>{inner}</span>;
        })}
      </nav>
      {/* Account group — separated from the product nav by a hairline + 16px, not a box.
          Profile is navigation (hover → ink); Sign out is the exit (hover → red). */}
      <div className="mt-auto pt-4 border-t border-jh-line space-y-1" aria-label="Account">
        {footer}
        {fixed
          ? <Link href={profileHref} className={rowCls(profileActive)} aria-current={profileActive ? "page" : undefined}>{profileInner}</Link>
          : <span className={rowCls(profileActive)} aria-current={profileActive ? "page" : undefined}>{profileInner}</span>}
        <button type="button" onClick={onSignOut} disabled={signingOut || !onSignOut} tabIndex={onSignOut ? undefined : -1}
          className="flex items-center gap-3 rounded-sm px-3 min-h-[44px] font-display font-semibold text-sm text-jh-mute hover:text-jh-red transition-colors duration-200 ease-out disabled:opacity-50 w-full text-left">
          <LogOut className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
