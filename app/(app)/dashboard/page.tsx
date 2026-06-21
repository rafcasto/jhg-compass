"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The standalone dashboard was folded into Performance (req 4). Keep this route as a
// redirect so old links/bookmarks still work.
export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/performance"); }, [router]);
  return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
}
