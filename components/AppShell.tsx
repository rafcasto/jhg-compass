"use client";

import { useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { Compass, Gauge, Columns3, GraduationCap, Shield, Radar, Target, FileText, ListChecks, UserRound, Navigation, Building2, type LucideProps } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useContent } from "@/lib/firestore/content";
import { track } from "@/lib/track-client";
import { BottomTabBar, MobileHeader } from "@/components/shell/MobileChrome";
import { DesktopSidebar } from "@/components/shell/DesktopChrome";
import PortalSwitcher, { type Portal } from "@/components/careerops/PortalSwitcher";
import { PORTAL_SECTIONS } from "@/lib/careerops/portal-nav";
import { JH_PAGES, JH_SETTINGS_HREF } from "@/lib/jobhacking/sections";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
};

const SECTION_ICONS: Record<string, ComponentType<LucideProps>> = { sourcing: Radar, scoring: Target, tailoring: FileText, tracking: ListChecks };
const JH_ICONS: Record<string, ComponentType<LucideProps>> = { profile: UserRound, "true-north": Navigation, companies: Building2 };

// One shell, three portals. Compass: Compass · Performance · Progress · Coaching.
// CareerOps: Sourcing · Scoring · Tailoring · Tracking. JobHacking: Profile ·
// True North · Target companies (Settings in the account group). The logo
// section is the switcher between them (only shown when the member has more than one).
export interface AppShellAccess {
  agentsEnabled?: boolean;
  jobHackingEnabled?: boolean;
  /** false only for members who signed up to JobHacking alone. */
  compassEnabled?: boolean;
}

export default function AppShell({ children, daysLeft, agentsEnabled = false, jobHackingEnabled = false, compassEnabled = true, portal = "compass" }: { children: React.ReactNode; daysLeft: number | null; portal?: Portal } & AppShellAccess) {
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
  const JOBHACKING_NAV: NavItem[] = JH_PAGES.map((p) => ({ href: p.href, label: p.label, icon: JH_ICONS[p.key] ?? Compass }));

  const base = portal === "careerops" ? CAREEROPS_NAV : portal === "jobhacking" ? JOBHACKING_NAV : COMPASS_NAV;
  const nav: NavItem[] = isAdmin ? [...base, { href: "/admin", label: "Admin", icon: Shield }] : base;
  const isActive = (href: string) => pathname.startsWith(href);

  // Portals are switched on per member by the admin (Admin → TOFU → Access renewals) or by a
  // JobHacking sign-up link. Admins always have all of them.
  const available: Portal[] = [
    ...(compassEnabled || isAdmin ? ["compass" as const] : []),
    ...(agentsEnabled || isAdmin ? ["careerops" as const] : []),
    ...(jobHackingEnabled || isAdmin ? ["jobhacking" as const] : []),
  ];
  const items = nav.map((n) => ({ key: n.href, label: n.label, icon: n.icon, href: n.href, active: isActive(n.href) }));

  // Account group. JobHacking has Profile as a primary tab, so its account group is Settings
  // (the profile.yml upload) and Sign out; the Compass and CareerOps shells keep Profile · Settings.
  const account = portal === "jobhacking"
    ? { profileHref: null, profileActive: false, settingsHref: JH_SETTINGS_HREF, settingsActive: isActive(JH_SETTINGS_HREF) }
    : { profileHref: "/profile", profileActive: isActive("/profile"), settingsHref: "/settings", settingsActive: isActive("/settings") };

  return (
    <div className="min-h-screen md:flex">
      {/* ---- Mobile top header (Profile + logout live here on mobile) ---- */}
      <div className="md:hidden">
        <MobileHeader onSignOut={handleLogout} signingOut={signingOut} {...account} brand={<PortalSwitcher portal={portal} available={available} compact />} />
      </div>

      {/* ---- Desktop sidebar (shared with the admin preview) ---- */}
      <div className="hidden md:block">
        <DesktopSidebar
          items={items}
          brand={<PortalSwitcher portal={portal} available={available} />}
          onSignOut={handleLogout} signingOut={signingOut} {...account}
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
