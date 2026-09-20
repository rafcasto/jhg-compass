import { describe, it, expect } from "vitest";
import {
  KEYS, dayKey, makeJobId, workerOnline, isMemberJobType, isAdminJobType, isTerminal, WORKER_STALE_MS, AGENT_KEYS, MEMBER_JOB_TYPES, JOB_AGENT,
} from "@/lib/careerops/keys";

describe("career-ops redis contract", () => {
  it("namespaces every key under careerops:", () => {
    const all = [KEYS.queue, KEYS.jobs, KEYS.job("x"), KEYS.userJobs("u"), KEYS.quota("u", "20260919"), KEYS.worker, KEYS.state, KEYS.rpc, KEYS.rpcReply("r")];
    for (const k of all) expect(k.startsWith("careerops:")).toBe(true);
    expect(KEYS.job("abc")).toBe("careerops:job:abc");
    expect(KEYS.quota("u1", "20260919")).toBe("careerops:quota:u1:20260919");
  });
  it("makes sortable job ids", () => {
    const a = makeJobId(Date.UTC(2026, 8, 19, 3, 15, 0), "1a2b3c4d");
    expect(a).toBe("20260919T031500-1a2b3c4d");
    expect(makeJobId(Date.UTC(2026, 8, 19, 3, 15, 1), "0") > a).toBe(true);
  });
  it("buckets quotas by UTC day", () => {
    expect(dayKey(Date.UTC(2026, 8, 19, 23, 59))).toBe("20260919");
  });
  it("treats a stale heartbeat as offline", () => {
    const now = 1_000_000;
    expect(workerOnline(now - 10_000, now)).toBe(true);
    expect(workerOnline(now - WORKER_STALE_MS - 1, now)).toBe(false);
    expect(workerOnline(null, now)).toBe(false);
  });
  it("keeps member and admin job types apart", () => {
    expect(isMemberJobType("evaluate")).toBe(true);
    expect(isMemberJobType("finetune")).toBe(false);
    expect(isAdminJobType("finetune")).toBe(true);
    expect(isTerminal("done") && isTerminal("failed") && isTerminal("cancelled")).toBe(true);
    expect(isTerminal("running")).toBe(false);
  });
  it("names the six agents", () => {
    expect([...AGENT_KEYS]).toEqual(["scout", "extractor", "evaluator", "tailor", "writer", "researcher"]);
  });
  it("routes every member job to an agent", () => {
    for (const t of MEMBER_JOB_TYPES) expect(AGENT_KEYS).toContain(JOB_AGENT[t]);
    expect(JOB_AGENT.deep).toBe("researcher");
  });
});
