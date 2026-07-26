"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useAccess } from "@/lib/firestore/access";
import { useLiveDoc, paths } from "@/lib/firestore/db";
import type { Profile } from "@/lib/types";
import AppShell from "@/components/AppShell";
import Paywall from "@/components/Paywall";
import VerifyEmail from "@/components/VerifyEmail";
import FeedbackGate from "@/components/FeedbackGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, emailVerified } = useAuth();
  const { loading: accessLoading, hasAccess, daysLeft } = useAccess(user?.uid);
  const { data: profile, loading: profileLoading } =
    useLiveDoc<Profile>(user ? paths.profile(user.uid) : null);
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

  const onboarded = !!profile?.onboardedAt;

  // Send verified-but-not-onboarded users to the onboarding wizard (req 3).
  useEffect(() => {
    if (!user || !emailVerified) return;
    if (!profileLoading && !onboarded) router.replace("/onboarding");
  }, [user, emailVerified, profileLoading, onboarded, router]);

  if (loading || !user || accessLoading) {
    return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
  }

  // Gate 1 — email verification (req 2).
  if (!emailVerified) return <VerifyEmail />;

  // Gate 2 — onboarding (req 3). Hold the UI while we redirect.
  if (profileLoading || !onboarded) {
    return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
  }

  return (
    <AppShell daysLeft={daysLeft}>
      {children}
      {/* Expired access blocks everything and takes precedence over feedback. */}
      {!hasAccess && <Paywall />}
      {/* Feedback only renders for users who still have access. */}
      {hasAccess && <FeedbackGate uid={user.uid} profile={profile} />}
    </AppShell>
  );
}
