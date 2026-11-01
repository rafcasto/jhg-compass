import { Suspense } from "react";
import SettingsScreen from "@/components/profile/SettingsScreen";

// Settings — reached from the Settings link in the shell (sidebar on desktop,
// header icon on mobile), beside Profile. What the agents work from: master CV,
// target companies, portal accounts, archetypes, portfolio, notes. docs/UX_PROFILE.md §7.
export default function SettingsPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<p className="text-jh-mute animate-pulse">Loading…</p>}>
      <SettingsScreen />
    </Suspense>
  );
}
