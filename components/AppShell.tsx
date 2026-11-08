"use client";

import { Suspense, useState, type ComponentType, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Compass, Gauge, Columns3, GraduationCap, Shield, Radar, Target, FileText, ListChecks, type LucideProps } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useContent } from "@/lib/firestore/content";
import { track } from "@/lib/track-client";
import { BottomTabBar, MobileHeader } from "@/components/shell/MobileChrome";
import { DesktopSidebar } from "@/components/shell/DesktopChrome";
import PortalSwitcher, { type Portal } from "@/components/careerops/PortalSwitcher";
import { PORTAL_SECTIONS } from "@/lib/careerops/portal-nav";
import { JH_NAV, JH_PAGES, JH_SETTINGS_HREF, SETTINGS_BASE, jhNavActive } from "@/lib/jobhacking/sections";
import { JH_PAGE_ICONS, JH_SECTION_ICONS } from "@/components/jobhacking/pageIcons";
import type { TabItem } from "@/components/shell/MobileChrome";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
};

/** Hands the `?section=` of the URL to a renderer — under a Suspense boundary, as the app router asks of useSearchParams. */
function WithSection({ render }: { render: (section: string | null) => ReactNode }) {
  const params = useSearchParams();
  return <>{render(params.get("section"))}</>;
}

const SECTION_ICONS: Record<string, ComponentType<LucideProps>> = { sourcing: Radar, scoring: Target, tailoring: FileText, tracking: ListChecks };

// One shell, three portals. Compass: Compass · Performance · Progress · Coaching.
// CareerOps: Sourcing · Scoring · Tailoring · Tracking. JobHacking: two groups
// in the sidebar (decision 2026-11-08, docs/UX_JOBHACKING.md §9) — Compass:
// Narrative · True North · Target companies; Artefacts: Story Bank · Master CV ·
// LinkedIn profile — and the four pages in the mobile bottom bar, where six
// labels won't fit and the Artefacts overview rows are the sub-menu. The account
// group is Settings and Sign out on every portal (the Profile row went into
// Settings, 2026-11-07 — docs/UX_SETTINGS_HUB.md). The logo section is the
// switcher between the portals (only shown when the member has more than one).
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
  const JOBHACKING_NAV: NavItem[] = JH_PAGES.map((p) => ({ href: p.href, label: p.label, icon: JH_PAGE_ICONS[p.key] }));

  const base = portal === "careerops" ? CAREEROPS_NAV : portal === "jobhacking" ? JOBHACKING_NAV : COMPASS_NAV;
  const admin: NavItem[] = isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : [];
  const nav: NavItem[] = [...base, ...admin];
  const isActive = (href: string) => pathname.startsWith(href);
  const toTab = (n: NavItem): TabItem => ({ key: n.href, label: n.label, icon: n.icon, href: n.href, active: isActive(n.href) });
  // JobHacking's sidebar: the two groups, each row lit by the registry's rule (a section row needs the URL's ?section=).
  const sidebarItems = (section: string | null): TabItem[] => portal !== "jobhacking" ? nav.map(toTab) : [
    ...JH_NAV.flatMap((g) => g.items.map((i): TabItem => ({
      key: i.key, label: i.label, href: i.href, group: g.label,
      icon: i.section ? JH_SECTION_ICONS[i.section] : JH_PAGE_ICONS[i.page],
      active: jhNavActive(i, pathname, section),
    }))),
    ...admin.map(toTab),
  ];

  // Portals are switched on per member by the admin (Admin → TOFU → Access renewals) or by a
  // JobHacking sign-up link. Admins always have all of them.
  const available: Portal[] = [
    ...(compassEnabled || isAdmin ? ["compass" as const] : []),
    ...(agentsEnabled || isAdmin ? ["careerops" as const] : []),
    ...(jobHackingEnabled || isAdmin ? ["jobhacking" as const] : []),
  ];
  const items = nav.map(toTab);

  // Account group: Settings · Sign out. JobHacking's Settings is the four-file upload; Compass's
  // (and CareerOps's) is the hub — who I am, the five areas, the files (docs/UX_SETTINGS_HUB.md).
  const settingsHref = portal === "jobhacking" ? JH_SETTINGS_HREF : SETTINGS_BASE;
  const account = { profileHref: null, settingsHref, settingsActive: isActive(settingsHref) };
  const sidebar = (section: string | null) => (
    <DesktopSidebar
      items={sidebarItems(section)}
      brand={<PortalSwitcher portal={portal} available={available} />}
      onSignOut={handleLogout} signingOut={signingOut} {...account}
      footer={daysLeft != null ? (
        <div className="mb-3 rounded-sm bg-jh-mist px-3 py-2.5 text-xs text-jh-mute">
          <span className="font-semibold text-jh-ink">{daysLeft} days</span> of access left
        </div>
      ) : undefined}
    />
  );

  return (
    <div className="min-h-screen md:flex">
      {/* ---- Mobile top header (Settings + logout live here on mobile) ---- */}
      <div className="md:hidden">
        <MobileHeader onSignOut={handleLogout} signingOut={signingOut} {...account} brand={<PortalSwitcher portal={portal} available={available} compact />} />
      </div>

      {/* ---- Desktop sidebar (shared with the admin preview) ---- */}
      <div className="hidden md:block">
        {portal === "jobhacking"
          ? <Suspense fallback={sidebar(null)}><WithSection render={sidebar} /></Suspense>
          : sidebar(null)}
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
