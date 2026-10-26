import { Suspense } from "react";
import ProfileScreen from "@/components/profile/ProfileScreen";

// Account page reached from the Profile link in the shell (sidebar on desktop,
// header icon on mobile). Who you are as the app knows it, plus the whole
// profile the agents work from — upload, see, edit, export. docs/UX_PROFILE.md.
export default function ProfilePage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<p className="text-jh-mute animate-pulse">Loading…</p>}>
      <ProfileScreen />
    </Suspense>
  );
}
