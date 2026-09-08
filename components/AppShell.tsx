"use client";

import { useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { Compass, Gauge, Columns3, GraduationCap, Shield, type LucideProps } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useContent } from "@/lib/firestore/content";
import { track } from "@/lib/track-client";
import { BottomTabBar, MobileHeader } from "@/components/shell/MobileChrome";
import { DesktopSidebar } from "@/components/shell/DesktopChrome";

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

  return (
    <div className="min-h-screen md:flex">
      {/* ---- Mobile top header (logout lives here on mobile) ---- */}
      <div className="md:hidden">
        <MobileHeader onSignOut={handleLogout} signingOut={signingOut} />
      </div>

      {/* ---- Desktop sidebar (shared with the admin preview) ---- */}
      <div className="hidden md:block">
        <DesktopSidebar
          items={nav.map((n) => ({ key: n.href, label: n.label, icon: n.icon, href: n.href, active: isActive(n.href) }))}
          onSignOut={handleLogout} signingOut={signingOut}
          footer={daysLeft != null ? (
            <div className="mb-3 rounded-sm bg-jh-mist px-3 py-2.5 text-xs text-jh-mute">
              <span className="font-semibold text-jh-ink">{daysLeft} days</span> of access left
            </div>
          ) : undefined}
        />
      </div>

      {/* ---- Main ---- */}
      {/* Main: 44px vertical / 48px horizontal padding on desktop (COACHING_DESKTOP.padY / padX). */}
      <main className="flex-1 pb-24 md:pb-0 md:ml-[232px]">
        <div className="mx-auto max-w-[1200px] px-5 py-6 md:px-12 md:py-11">{children}</div>
      </main>

      {/* ---- Mobile bottom nav ---- */}
      <div className="md:hidden">
        <BottomTabBar items={nav.map((n) => ({ key: n.href, label: n.label, icon: n.icon, href: n.href, active: isActive(n.href) }))} />
      </div>
    </div>
  );
}
