"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Compass, Gauge, Columns3, GraduationCap, Shield, LogOut, type LucideProps } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useContent } from "@/lib/firestore/content";
import { track } from "@/lib/track-client";
import CoachingModal from "@/components/CoachingModal";

type NavItem = {
  label: string;
  icon: ComponentType<LucideProps>;
  href?: string;
  action?: "coaching";
};

export default function AppShell({ children, daysLeft }: { children: React.ReactNode; daysLeft: number | null }) {
  const pathname = usePathname();
  const { signOut, isAdmin } = useAuth();
  const { t } = useContent();
  const [coaching, setCoaching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Record the LOGOUT event (while still authenticated) then sign out — the
  // (app) layout redirects to /login once the user becomes null.
  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try { await track("LOGOUT", { stage: "retention", source: "compass" }); } catch {}
    await signOut();
  }

  // Four tabs (req 4): Compass · Performance (iceberg) · Tracker (kanban) · Coaching (modal).
  // Labels are admin-editable via content.
  const NAV: NavItem[] = [
    { href: "/compass", label: t("nav.compass"), icon: Compass },
    { href: "/performance", label: t("nav.performance"), icon: Gauge },
    { href: "/tracker", label: t("nav.tracker"), icon: Columns3 },
    { action: "coaching", label: t("nav.coaching"), icon: GraduationCap },
  ];

  const nav: NavItem[] = isAdmin ? [...NAV, { href: "/admin", label: "Admin", icon: Shield }] : NAV;

  function renderItem(item: NavItem, layout: "side" | "bottom") {
    const Icon = item.icon;
    const active = !!item.href && pathname.startsWith(item.href);
    const side = layout === "side";
    // Sidebar items are pill chips (active: red text on #f6e0e3); bottom tabs are
    // icon-over-label with a >=44px hit target and the active one in red.
    const base = side
      ? `flex items-center gap-3 rounded-pill px-4 py-2.5 font-display font-semibold text-sm w-full text-left transition-colors duration-200 ease-out ${active ? "bg-jh-red-soft text-jh-red" : "text-jh-mute hover:bg-jh-mist hover:text-jh-ink"}`
      : `flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 text-[11px] font-display font-semibold transition-colors duration-200 ease-out ${active ? "text-jh-red" : "text-jh-mute hover:text-jh-ink"}`;
    const inner = <><Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {item.label}</>;

    if (item.action === "coaching") {
      return <button key={item.label} type="button" onClick={() => setCoaching(true)} className={base}>{inner}</button>;
    }
    return <Link key={item.href} href={item.href!} className={base} aria-current={active ? "page" : undefined}>{inner}</Link>;
  }

  return (
    <div className="min-h-screen md:flex">
      {/* ---- Mobile top header (logout lives here on mobile) ---- */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-white border-b border-jh-line">
        <div className="flex items-center gap-2">
          <Image src="/assets/logo-hand.png" alt="JobHackers" width={26} height={26} />
          <span className="font-display font-bold text-jh-ink text-sm">Compass</span>
        </div>
        <button type="button" onClick={handleLogout} disabled={signingOut}
          className="flex items-center gap-1.5 min-h-[44px] px-1 font-display font-semibold text-sm text-jh-mute hover:text-jh-red transition-colors duration-200 ease-out disabled:opacity-50">
          <LogOut className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </header>

      {/* ---- Desktop sidebar ---- */}
      <aside className="hidden md:flex md:w-[324px] md:flex-col md:fixed md:inset-y-0 bg-white border-r border-jh-line p-5" aria-label="Primary">
        <div className="flex items-center gap-2 mb-8">
          <Image src="/assets/logo-hand.png" alt="JobHackers" width={32} height={32} />
          <span className="font-display font-bold text-jh-ink">Compass</span>
        </div>
        <nav className="flex-1 space-y-1.5">
          {nav.map((item) => renderItem(item, "side"))}
        </nav>
        {daysLeft != null && (
          <div className="mb-3 rounded-sm bg-jh-mist px-3 py-2.5 text-xs text-jh-mute">
            <span className="font-semibold text-jh-ink">{daysLeft} days</span> of access left
          </div>
        )}
        <button type="button" onClick={handleLogout} disabled={signingOut}
          className="flex items-center gap-3 rounded-pill px-4 py-2.5 font-display font-semibold text-sm text-jh-mute hover:text-jh-red transition-colors duration-200 ease-out disabled:opacity-50">
          <LogOut className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>

      {/* ---- Main ---- */}
      <main className="md:ml-[324px] flex-1 pb-24 md:pb-0">
        <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-14 md:py-11">{children}</div>
      </main>

      {/* ---- Mobile bottom nav ---- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-jh-line flex pb-[env(safe-area-inset-bottom)]" aria-label="Primary">
        {nav.map((item) => renderItem(item, "bottom"))}
      </nav>

      {coaching && <CoachingModal onClose={() => setCoaching(false)} />}
    </div>
  );
}
