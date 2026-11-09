"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PageHeader from "@/components/shell/PageHeader";
import ProfileFilesPanel, { type Dropped } from "@/components/jobhacking/ProfileFilesPanel";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// JobHacking · Settings — docs/UX_JOBHACKING.md §4 (decision 2026-11-07).
//
// The Packer writes the profile as six files, one per page of this portal,
// so Settings is the six slots (ProfileFilesPanel, shared with the Compass
// Settings hub) under the portal's header. A file dropped anywhere on the
// page lands in the slot its stamp names.

export default function JobHackingSettings() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      className="space-y-6"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files?.length) return; e.preventDefault(); setOver(false); setDropped({ files: Array.from(e.dataTransfer.files), at: Date.now() }); }}
    >
      <PageHeader eyebrow="JobHacking" title="Settings" intro="Your coach's Packer writes your profile as six files — one for each page of this portal. Upload each one as it's ready, or all six at once. What a file carries replaces what's here, field by field; anything it doesn't mention is left as it is." />
      <div className="max-w-3xl space-y-6">
        {uid && <ProfileFilesPanel uid={uid} setup={setup} profile={profile} portal="jobhacking" dropped={dropped} over={over} />}
      </div>
    </div>
  );
}
