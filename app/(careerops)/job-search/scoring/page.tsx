import { Suspense } from "react";
import SectionScreen from "@/components/careerops/SectionScreen";

export default function Page() {
  return <Suspense fallback={<p className="text-jh-mute animate-pulse">Loading…</p>}><SectionScreen section="scoring" /></Suspense>;
}
