"use client";

import { useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { Compass, Gauge, Columns3, GraduationCap, Shield, Radar, Target, FileText, ListChecks, type LucideProps } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useContent } from "@/lib/firestore/content";
import { track } from "@/lib/track-client";
import { BottomTabBar, MobileHeader } from "@/components/shell/MobileChrome";
import { DesktopSidebar } from "@/components/shell/DesktopChrome";
import PortalSwitcher, { type Portal } from "@/components/careerops/PortalSwitcher";
import { PORTAL_SECTIONS } from "@/lib/careerops/portal-nav";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
};

const SECTION_ICONS: Record<string, ComponentType<LucideProps>> = { sourcing: Radar, scoring: Target, tailoring: FileText, tracking: ListChecks };

// One shell, two portals. Compass: Compass · Performance · Progress · Coaching.
// CareerOps: Sourcing · Scoring · Tailoring · Tracking. The logo section is the
// switcher between them (only shown when the member has both).
export default function AppShell({ children, daysLeft, agentsEnabled = false, portal = "compass" }: { children: React.ReactNode; daysLeft: number | null; agentsEnabled?: boolean; portal?: Portal }) {
  const pathname = usePathname();
  const { signOut, isAdmin } = useAuth();
  const { t } = useContent();
  const [signingOut, setSigningOut] = useState(false);

  // Record the LOGOUT event (while still authenticated) then sign out — the
  // (app) layout redirects to /login once the user becomes null.
  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try { await track("LOGOUT", { stage: "retention", source: portal }); } catch {}
    await signOut();
  }

  // Compass: four tabs (req 4). Labels are admin-editable via content.
  const COMPASS_NAV: NavItem[] = [
    { href: "/compass", label: t("nav.compass"), icon: Compass },
    { href: "/performance", label: t("nav.performance"), icon: Gauge },
    { href: "/tracker", label: t("nav.tracker"), icon: Columns3 },
    { href: "/coaching", label: t("nav.coaching"), icon: GraduationCap },
  ];
  const CAREEROPS_NAV: NavItem[] = PORTAL_SECTIONS.map((s) => ({ href: s.href, label: s.label, icon: SECTION_ICONS[s.key] ?? Compass }));

  const base = portal === "careerops" ? CAREEROPS_NAV : COMPASS_NAV;
  const nav: NavItem[] = isAdmin ? [...base, { href: "/admin", label: "Admin", icon: Shield }] : base;
  const isActive = (href: string) => pathname.startsWith(href);

  // CareerOps is switched on per member by the admin (Admin → TOFU → Access renewals). Admins always have it.
  const available: Portal[] = agentsEnabled || isAdmin ? ["compass", "careerops"] : ["compass"];
  const items = nav.map((n) => ({ key: n.href, label: n.label, icon: n.icon, href: n.href, active: isActive(n.href) }));

  return (
    <div className="min-h-screen md:flex">
      {/* ---- Mobile top header (logout lives here on mobile) ---- */}
      <div className="md:hidden">
        <MobileHeader onSignOut={handleLogout} signingOut={signingOut} brand={<PortalSwitcher portal={portal} available={available} compact />} />
      </div>

      {/* ---- Desktop sidebar (shared with the admin preview) ---- */}
      <div className="hidden md:block">
        <DesktopSidebar
          items={items}
          brand={<PortalSwitcher portal={portal} available={available} />}
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
        <BottomTabBar items={items} />
      </div>
    </div>
  );
}
