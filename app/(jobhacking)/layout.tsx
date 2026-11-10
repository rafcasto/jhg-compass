"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useAccess } from "@/lib/firestore/access";
import AppShell from "@/components/AppShell";
import Paywall from "@/components/Paywall";
import VerifyEmail from "@/components/VerifyEmail";

// The JobHacking portal shell — docs/UX_JOBHACKING.md. Signed in, email verified,
// access active, and the portal switched on for this member (an admin switch, or
// a JobHacking sign-up link). Admins always get in.
//
// No onboarding gate: the Compass wizard is Compass's first run. A JobHacking
// member's profile comes from the profile.yml they upload under Settings, or
// from the sections they fill in here.
export default function JobHackingLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, emailVerified, isAdmin } = useAuth();
  const { loading: accessLoading, hasAccess, daysLeft, agentsEnabled, jobHackingEnabled, compassEnabled, coachEnabled } = useAccess(user?.uid);
  const router = useRouter();

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) => fetch("/api/access/sync", { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {}));
  }, [user]);

  if (loading || !user || accessLoading) return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
  if (!emailVerified) return <VerifyEmail />;

  const allowed = jobHackingEnabled || isAdmin;
  return (
    <AppShell daysLeft={daysLeft} agentsEnabled={agentsEnabled} jobHackingEnabled={jobHackingEnabled} compassEnabled={compassEnabled} coachEnabled={coachEnabled} portal="jobhacking">
      {allowed ? children : (
        <div className="card p-10 text-center">
          <h1 className="mb-2">JobHacking isn&apos;t switched on for you yet</h1>
          <p className="text-jh-mute">Ask your JobHackers coach to enable the JobHacking portal on your account.{compassEnabled ? " Your Compass is still here — click the logo to switch back." : ""}</p>
        </div>
      )}
      {!hasAccess && <Paywall />}
    </AppShell>
  );
}
