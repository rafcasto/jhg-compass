"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import TofuTab from "@/components/admin/tofu/TofuTab";
import CmsTab from "@/components/admin/cms/CmsTab";
import InteractionsTab from "@/components/admin/interactions/InteractionsTab";
import AnalyticsTab from "@/components/admin/analytics/AnalyticsTab";
import {
  TABS, adminHash, firstSub, parseAdminHash,
  type AdminLocation, type TabKey, type TofuSub, type CmsSub, type InteractionsSub, type AnalyticsSub,
} from "@/components/admin/nav";

// Four top-level tabs, each with its own sub-tabs (components/admin/nav.ts).
// Location is kept in the URL hash (#cms/compass) so a refresh — or a link in
// Slack — lands on the same screen.
export default function AdminPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loc, setLoc] = useState<AdminLocation>({ tab: "tofu", sub: firstSub("tofu") });

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    user.getIdTokenResult(true).then((t) => setAuthorized(t.claims.admin === true));
  }, [user, loading, router]);

  // URL hash ↔ state
  useEffect(() => {
    const read = () => setLoc(parseAdminHash(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = useCallback((next: AdminLocation) => {
    setLoc(next);
    if (typeof window !== "undefined") window.history.replaceState(null, "", adminHash(next));
  }, []);
  const goTab = (tab: TabKey) => go({ tab, sub: firstSub(tab) });
  const goSub = (sub: string) => go({ tab: loc.tab, sub });

  if (authorized === null) return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
  if (authorized === false) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div><h1 className="mb-2">Not authorized</h1><p className="text-jh-mute">This area is for admins only.</p></div>
    </div>
  );

  return (
    <div className="admin-scope min-h-screen bg-jh-paper">
      <style>{`.admin-scope .btn-primary,.admin-scope .btn-secondary{border-radius:9999px;}`}</style>
      <div className="h-[5px] bg-jh-red" />
      <header className="bg-white border-b border-jh-line">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-8 w-8 rounded-[9px] bg-jh-red text-white text-base shadow-cta">🧭</span>
            <span className="font-display font-bold text-jh-ink">JobHacker <span className="text-jh-red">Compass</span></span>
            <span className="ml-1.5 hidden sm:inline font-display font-semibold text-[11px] uppercase tracking-[.12em] text-jh-mute">Admin</span>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <span className="text-jh-mute hidden sm:inline">{user?.email}</span>
            <Link href="/compass" className="inline-flex items-center gap-1 text-jh-ink hover:text-jh-red underline underline-offset-2">View site <ExternalLink className="h-3.5 w-3.5" /></Link>
            <button onClick={() => signOut()} className="font-display font-semibold text-jh-ink hover:text-jh-red">Sign out</button>
          </div>
        </div>
      </header>

      {/* top-level tabs */}
      <div className="bg-jh-paper border-b border-jh-line">
        <nav className="mx-auto max-w-6xl px-5 flex gap-6 overflow-x-auto" aria-label="Admin sections">
          {TABS.map((t, i) => (
            <button key={t.key} onClick={() => goTab(t.key)} aria-current={loc.tab === t.key ? "page" : undefined} title={t.title}
              className={`py-3 text-sm font-display font-semibold whitespace-nowrap border-b-2 -mb-px transition ${loc.tab === t.key ? "border-jh-red text-jh-red" : "border-transparent text-jh-mute hover:text-jh-ink"}`}>
              <span className="text-jh-mute-2 tabular-nums mr-1.5">{i + 1}</span>{t.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {loc.tab === "tofu" && <TofuTab sub={loc.sub as TofuSub} onSub={goSub} />}
        {loc.tab === "cms" && <CmsTab sub={loc.sub as CmsSub} onSub={goSub} />}
        {loc.tab === "interactions" && <InteractionsTab sub={loc.sub as InteractionsSub} onSub={goSub} />}
        {loc.tab === "analytics" && <AnalyticsTab sub={loc.sub as AnalyticsSub} onSub={goSub} />}
      </main>
    </div>
  );
}
