"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Compass, Columns3, GraduationCap, Shield, LogOut, type LucideProps } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Iceberg } from "@/components/icons";
import CoachingModal from "@/components/CoachingModal";

type NavItem = {
  label: string;
  icon: ComponentType<LucideProps>;
  href?: string;
  action?: "coaching";
};

// Four tabs (req 4): Compass · Performance (iceberg) · Tracker (kanban) · Coaching (modal).
const NAV: NavItem[] = [
  { href: "/compass", label: "Compass", icon: Compass },
  { href: "/performance", label: "Performance", icon: Iceberg },
  { href: "/tracker", label: "Tracker", icon: Columns3 },
  { action: "coaching", label: "Coaching", icon: GraduationCap },
];

export default function AppShell({ children, daysLeft }: { children: React.ReactNode; daysLeft: number | null }) {
  const pathname = usePathname();
  const { signOut, isAdmin } = useAuth();
  const [coaching, setCoaching] = useState(false);

  const nav: NavItem[] = isAdmin ? [...NAV, { href: "/admin", label: "Admin", icon: Shield }] : NAV;

  function renderItem(item: NavItem, layout: "side" | "bottom") {
    const Icon = item.icon;
    const active = !!item.href && pathname.startsWith(item.href);
    const side = layout === "side";
    const base = side
      ? `flex items-center gap-3 rounded-[10px] px-3 py-2.5 font-display font-semibold text-sm transition w-full text-left ${active ? "bg-jh-red-soft text-jh-red" : "text-jh-mute hover:bg-jh-mist hover:text-jh-ink"}`
      : `flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-display font-semibold transition ${active ? "text-jh-red" : "text-jh-mute"}`;
    const inner = <><Icon className="h-5 w-5" /> {item.label}</>;

    if (item.action === "coaching") {
      return <button key={item.label} onClick={() => setCoaching(true)} className={base}>{inner}</button>;
    }
    return <Link key={item.href} href={item.href!} className={base}>{inner}</Link>;
  }

  return (
    <div className="min-h-screen md:flex">
      {/* ---- Desktop sidebar ---- */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-jh-line p-5">
        <div className="flex items-center gap-2 mb-8">
          <Image src="/assets/logo-hand.png" alt="JobHackers" width={32} height={32} />
          <span className="font-display font-bold text-jh-ink">Compass</span>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => renderItem(item, "side"))}
        </nav>
        {daysLeft != null && (
          <div className="mb-3 rounded-[10px] bg-jh-mist px-3 py-2 text-xs text-jh-mute">
            <span className="font-semibold text-jh-ink">{daysLeft} days</span> of access left
          </div>
        )}
        <button onClick={() => signOut()} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 font-display font-semibold text-sm text-jh-mute hover:text-jh-red">
          <LogOut className="h-5 w-5" /> Sign out
        </button>
      </aside>

      {/* ---- Main ---- */}
      <main className="md:ml-64 flex-1 pb-20 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8">{children}</div>
      </main>

      {/* ---- Mobile bottom nav ---- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-jh-line flex">
        {nav.map((item) => renderItem(item, "bottom"))}
      </nav>

      {coaching && <CoachingModal onClose={() => setCoaching(false)} />}
    </div>
  );
}
