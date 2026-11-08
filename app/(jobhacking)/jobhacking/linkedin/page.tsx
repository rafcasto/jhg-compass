import { Suspense } from "react";
import JobHackingScreen from "@/components/jobhacking/JobHackingScreen";

// JobHacking · linkedin — a page of its own under Artefacts, docs/UX_JOBHACKING.md §10.
export default function Page() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<p className="text-jh-mute animate-pulse">Loading…</p>}>
      <JobHackingScreen page="linkedin" />
    </Suspense>
  );
}
