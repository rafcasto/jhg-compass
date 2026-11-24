import { describe, it, expect } from "vitest";
import { RECENT_MS, latestPostingsJob, showsPostingsJob } from "@/lib/jobhacking/postings-job";
import type { EngineJob } from "@/lib/engine/jobs";

// True North reads the coach's postings job under its header (docs/UX_JOURNEY_JOBHACKING.md, Stage 2): while it runs,
// and for a quarter of an hour after it lands or fails — a failed search is said where the postings would have been.

const job = (over: Partial<EngineJob>): EngineJob => ({ id: "j1", type: "postings", status: "done", createdAt: 1_000, ...over } as EngineJob);

describe("showsPostingsJob", () => {
  it("shows a queued or running job whatever its age", () => {
    expect(showsPostingsJob(job({ status: "queued", createdAt: 0 }), 10 * RECENT_MS)).toBe(true);
    expect(showsPostingsJob(job({ status: "running", createdAt: 0 }), 10 * RECENT_MS)).toBe(true);
  });
  it("keeps a landed or failed job on the page for fifteen minutes, then lets it go", () => {
    const now = 100 * RECENT_MS;
    expect(showsPostingsJob(job({ status: "done", endedAt: now - RECENT_MS + 1 }), now)).toBe(true);
    expect(showsPostingsJob(job({ status: "failed", endedAt: now - RECENT_MS + 1 }), now)).toBe(true);
    expect(showsPostingsJob(job({ status: "done", endedAt: now - RECENT_MS }), now)).toBe(false);
  });
  it("shows nothing when there is no job", () => {
    expect(showsPostingsJob(null)).toBe(false);
  });
  it("picks the newest postings job and ignores the companies job beside it", () => {
    expect(latestPostingsJob([job({ id: "c", type: "companies" } as Partial<EngineJob>), job({ id: "p2" }), job({ id: "p1" })])?.id).toBe("p2");
    expect(latestPostingsJob([])).toBeNull();
  });
});
