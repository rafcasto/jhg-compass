"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useAccess } from "@/lib/firestore/access";
import AppShell from "@/components/AppShell";
import Paywall from "@/components/Paywall";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { loading: accessLoading, hasAccess, daysLeft } = useAccess(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // On entry, redeem pending grants (req 8) and expire elapsed ones (req 9).
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) =>
      fetch("/api/access/sync", { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {})
    );
  }, [user]);

  if (loading || !user || accessLoading) {
    return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
  }

  return (
    <AppShell daysLeft={daysLeft}>
      {children}
      {!hasAccess && <Paywall />}
    </AppShell>
  );
}
