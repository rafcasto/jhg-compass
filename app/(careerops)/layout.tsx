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

// The CareerOps portal shell. Same gates as the Compass shell (signed in, email
// verified, onboarded, access active) plus one more: the admin has switched the
// portal on for this member (accessGrants/{uid}.features.careerOps). Admins always get in.
export default function CareerOpsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, emailVerified, isAdmin } = useAuth();
  const { loading: accessLoading, hasAccess, daysLeft, agentsEnabled } = useAccess(user?.uid);
  const { data: profile, loading: profileLoading } = useLiveDoc<Profile>(user ? paths.profile(user.uid) : null);
  const router = useRouter();

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) => fetch("/api/access/sync", { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {}));
  }, [user]);

  const onboarded = !!profile?.onboardedAt;
  useEffect(() => {
    if (!user || !emailVerified) return;
    if (!profileLoading && !onboarded) router.replace("/onboarding");
  }, [user, emailVerified, profileLoading, onboarded, router]);

  if (loading || !user || accessLoading) return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
  if (!emailVerified) return <VerifyEmail />;
  if (profileLoading || !onboarded) return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;

  const allowed = agentsEnabled || isAdmin;
  return (
    <AppShell daysLeft={daysLeft} agentsEnabled={agentsEnabled} portal="careerops">
      {allowed ? children : (
        <div className="card p-10 text-center">
          <h1 className="mb-2">CareerOps isn&apos;t switched on for you yet</h1>
          <p className="text-jh-mute">Ask your JobHackers coach to enable the CareerOps portal on your account. Your Compass is still here — click the logo to switch back.</p>
        </div>
      )}
      {!hasAccess && <Paywall />}
    </AppShell>
  );
}
