import { Suspense } from "react";
import JobHackingScreen from "@/components/jobhacking/JobHackingScreen";

// JobHacking · profile — docs/UX_JOBHACKING.md.
export default function Page() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<p className="text-jh-mute animate-pulse">Loading…</p>}>
      <JobHackingScreen page="profile" />
    </Suspense>
  );
}
