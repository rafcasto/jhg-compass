"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, Users, Briefcase, CalendarDays, Shield, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tracker", label: "Tracker", icon: Target },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/opportunities", label: "Jobs", icon: Briefcase },
  { href: "/events", label: "Events", icon: CalendarDays },
];

export default function AppShell({ children, daysLeft }: { children: React.ReactNode; daysLeft: number | null }) {
  const pathname = usePathname();
  const { signOut, isAdmin } = useAuth();
  const nav = isAdmin ? [...NAV, { href: "/admin", label: "Admin", icon: Shield }] : NAV;

  return (
    <div className="min-h-screen md:flex">
      {/* ---- Desktop sidebar ---- */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-jh-line p-5">
        <div className="flex items-center gap-2 mb-8">
          <Image src="/assets/logo-hand.png" alt="JobHackers" width={32} height={32} />
          <span className="font-display font-bold text-jh-ink">Compass</span>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 font-display font-semibold text-sm transition
                ${active ? "bg-jh-red-soft text-jh-red" : "text-jh-mute hover:bg-jh-mist hover:text-jh-ink"}`}>
                <Icon className="h-5 w-5" /> {label}
              </Link>
            );
          })}
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
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-display font-semibold transition
              ${active ? "text-jh-red" : "text-jh-mute"}`}>
              <Icon className="h-5 w-5" /> {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
