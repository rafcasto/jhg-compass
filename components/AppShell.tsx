"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Compass, Gauge, Columns3, GraduationCap, Shield, LogOut, type LucideProps } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useContent } from "@/lib/firestore/content";
import { track } from "@/lib/track-client";
import { BottomTabBar, MobileHeader } from "@/components/shell/MobileChrome";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
};

export default function AppShell({ children, daysLeft }: { children: React.ReactNode; daysLeft: number | null }) {
  const pathname = usePathname();
  const { signOut, isAdmin } = useAuth();
  const { t } = useContent();
  const [signingOut, setSigningOut] = useState(false);

  // Record the LOGOUT event (while still authenticated) then sign out — the
  // (app) layout redirects to /login once the user becomes null.
  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try { await track("LOGOUT", { stage: "retention", source: "compass" }); } catch {}
    await signOut();
  }

  // Four tabs (req 4): Compass · Performance (iceberg) · Tracker (kanban) · Coaching.
  // Labels are admin-editable via content.
  const NAV: NavItem[] = [
    { href: "/compass", label: t("nav.compass"), icon: Compass },
    { href: "/performance", label: t("nav.performance"), icon: Gauge },
    { href: "/tracker", label: t("nav.tracker"), icon: Columns3 },
    { href: "/coaching", label: t("nav.coaching"), icon: GraduationCap },
  ];

  const nav: NavItem[] = isAdmin ? [...NAV, { href: "/admin", label: "Admin", icon: Shield }] : NAV;
  const isActive = (href: string) => pathname.startsWith(href);

  // Sidebar items are pill chips (active: red text on #f6e0e3).
  function renderSideItem(item: NavItem) {
    const Icon = item.icon;
    const active = isActive(item.href);
    const cls = `flex items-center gap-3 rounded-pill px-4 py-2.5 font-display font-semibold text-sm w-full text-left transition-colors duration-200 ease-out ${active ? "bg-jh-red-soft text-jh-red" : "text-jh-mute hover:bg-jh-mist hover:text-jh-ink"}`;
    return (
      <Link key={item.href} href={item.href} className={cls} aria-current={active ? "page" : undefined}>
        <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden /> {item.label}
      </Link>
    );
  }

  return (
    <div className="min-h-screen md:flex">
      {/* ---- Mobile top header (logout lives here on mobile) ---- */}
      <div className="md:hidden">
        <MobileHeader onSignOut={handleLogout} signingOut={signingOut} />
      </div>

      {/* ---- Desktop sidebar ---- */}
      <aside className="hidden md:flex md:w-[324px] md:flex-col md:fixed md:inset-y-0 bg-white border-r border-jh-line p-5" aria-label="Primary">
        <div className="flex items-center gap-2 mb-8">
          <Image src="/assets/logo-hand.png" alt="JobHackers" width={32} height={32} />
          <span className="font-display font-bold text-jh-ink">Compass</span>
        </div>
        <nav className="flex-1 space-y-1.5">
          {nav.map(renderSideItem)}
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
      <div className="md:hidden">
        <BottomTabBar items={nav.map((n) => ({ key: n.href, label: n.label, icon: n.icon, href: n.href, active: isActive(n.href) }))} />
      </div>
    </div>
  );
}
