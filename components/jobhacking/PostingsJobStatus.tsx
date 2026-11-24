"use client";

import { useMemo } from "react";
import JobStatus from "@/components/coach/JobStatus";
import { paths, useLiveCollection } from "@/lib/firestore/db";
import type { EngineJob } from "@/lib/engine/jobs";
import { ENGINE_JOB_LABELS } from "@/lib/engine/keys";
import { latestPostingsJob, showsPostingsJob } from "@/lib/jobhacking/postings-job";

// True North's postings job on the page (docs/UX_JOURNEY_JOBHACKING.md, Stage 2): the page is the product, so a
// research job the coach started — running, landed, or failed — is read under the page header in the same JobStatus
// line the transcript shows, not only inside the panel. A failed search in particular must be seen where the postings
// would have appeared. Same recipe as CompaniesJobStatus; the job is the coach's, so there is no button here.

/** The latest postings job under this member, live. */
export function usePostingsJob(uid: string | undefined): EngineJob | null {
  const { data: jobs } = useLiveCollection<EngineJob>(uid, paths.engineJobs);
  return useMemo(() => latestPostingsJob(jobs), [jobs]);
}

export function PostingsJobStatus({ uid, latest, href }: { uid: string; latest: EngineJob | null; href: string }) {
  if (!latest || !showsPostingsJob(latest)) return null;
  return <JobStatus uid={uid} job={{ id: latest.id, type: latest.type, label: ENGINE_JOB_LABELS.postings }} href={href} />;
}
