import { Suspense } from "react";
import { notFound } from "next/navigation";
import SettingsArea from "@/components/profile/SettingsArea";
import { jhPagesFor, type JhPageKey } from "@/lib/jobhacking/sections";

// One area of Settings — /settings/narrative · true-north · companies ·
// artefacts · agents. The same sectioned pages as the JobHacking portal, on
// Compass. docs/UX_SETTINGS_HUB.md §3.
export default function SettingsAreaPage({ params }: { params: { area: string } }) {
  const page = jhPagesFor("compass").find((p) => p.key === params.area);
  if (!page) notFound();
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<p className="text-jh-mute animate-pulse">Loading…</p>}>
      <SettingsArea page={page.key as JhPageKey} />
    </Suspense>
  );
}
