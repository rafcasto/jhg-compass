// True North's postings job on the page (docs/UX_JOURNEY_JOBHACKING.md, Stage 2) — the pure half: which job is the
// page's, and whether it is still worth a line under the header. The component in
// components/jobhacking/PostingsJobStatus.tsx reads the live collection and draws the same JobStatus line the transcript has.

import type { EngineJob } from "../engine/jobs";

/** The latest postings job in a newest-first list. */
export const latestPostingsJob = (jobs: readonly EngineJob[]): EngineJob | null => jobs.find((j) => j.type === "postings") ?? null;

/** Shown while the job runs and for fifteen minutes after it ends — long enough to read a failure, short enough to not be furniture. */
export const RECENT_MS = 15 * 60_000;
export const showsPostingsJob = (latest: EngineJob | null, now = Date.now()): boolean =>
  !!latest && (latest.status === "queued" || latest.status === "running" || now - (latest.endedAt ?? latest.createdAt) < RECENT_MS);
