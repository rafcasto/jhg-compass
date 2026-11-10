import { describe, it, expect } from "vitest";
import { appendLogTail, jobView, parentStatus, readJob, runnable, unitLanded, type EngineJob } from "@/lib/engine/jobs";
import { ENGINE_JOB_TYPES, JOB_ID_RE, isEngineJobType, isTerminal, makeJobId } from "@/lib/engine/keys";

const job = (p: Partial<EngineJob> = {}): EngineJob => ({ id: "20261110T100000-0a1b2c3d", uid: "u1", type: "ping", status: "queued", payload: {}, createdAt: 1, createdBy: "rafael@x.io", ...p });

describe("the engine job document", () => {
  it("mints ids the routes accept, and knows its own job types", () => {
    expect(JOB_ID_RE.test(makeJobId(Date.UTC(2026, 10, 10, 10, 0, 0), "0a1b2c3d"))).toBe(true);
    expect(JOB_ID_RE.test("../../etc")).toBe(false);
    expect(ENGINE_JOB_TYPES).toContain("ping");
    expect(isEngineJobType("evaluate")).toBe(false); // not ported yet — the registry is the truth
  });

  it("keeps the tail of the log", () => {
    const log = appendLogTail(undefined, "one");
    expect(log).toBe("one\n");
    const long = appendLogTail("x".repeat(100), "end", 20);
    expect(long.length).toBe(20);
    expect(long.endsWith("end\n")).toBe(true);
  });

  it("closes a parent when its last unit lands, failed only when every unit failed", () => {
    const a = unitLanded({ total: 3, done: 0, failed: 0 }, true);
    expect(a).toEqual({ units: { total: 3, done: 1, failed: 0 }, finished: false });
    const b = unitLanded(a.units, false);
    const c = unitLanded(b.units, true);
    expect(c.finished).toBe(true);
    expect(parentStatus(c.units)).toBe("done");
    expect(parentStatus({ total: 2, done: 0, failed: 2 })).toBe("failed");
    expect(parentStatus({ total: 0, done: 0, failed: 0 })).toBe("done");
  });

  it("runs a queued or running job, never a cancelled or finished one", () => {
    expect(runnable(job())).toBe(true);
    expect(runnable(job({ status: "running" }))).toBe(true);
    expect(runnable(job({ status: "running", cancel: true }))).toBe(false);
    expect(runnable(job({ status: "done" }))).toBe(false);
    for (const s of ["done", "failed", "cancelled"] as const) expect(isTerminal(s)).toBe(true);
  });

  it("reads a stored document and hides the log and payload from the member's view", () => {
    expect(readJob(null, "x")).toBeNull();
    expect(readJob({ uid: "u1" }, "x")).toBeNull();
    const j = readJob({ uid: "u1", type: "ping", log: "secret", payload: { jd: "…" }, cancel: true, units: { total: 2, done: 1, failed: 0 } }, "id1")!;
    expect(j).toMatchObject({ id: "id1", status: "queued", cancel: true, units: { total: 2, done: 1, failed: 0 } });
    const v = jobView(j) as Record<string, unknown>;
    expect(v.log).toBeUndefined();
    expect(v.payload).toBeUndefined();
    expect(v.units).toBeDefined();
  });
});
