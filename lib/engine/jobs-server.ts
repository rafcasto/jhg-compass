import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { appendLogTail, parentStatus, readJob, unitLanded, type EngineJob, type JobUnits } from "./jobs";
import { makeJobId, type EngineJobType } from "./keys";

// users/{uid}/engineJobs/{id} — Admin SDK writes; the member reads live (owner rules).

const ref = (uid: string, id: string) => adminDb().doc(`users/${uid}/engineJobs/${id}`);

export async function createJob(input: { uid: string; type: EngineJobType; payload: Record<string, unknown>; createdBy: string; units?: number }): Promise<EngineJob> {
  const createdAt = Date.now();
  const id = makeJobId(createdAt);
  const job: EngineJob = {
    id, uid: input.uid, type: input.type, status: "queued", payload: input.payload, createdAt, createdBy: input.createdBy,
    ...(input.units && input.units > 1 ? { units: { total: input.units, done: 0, failed: 0 } } : {}),
  };
  const { id: _id, ...doc } = job;
  await ref(input.uid, id).set(doc);
  return job;
}

export async function getJob(uid: string, id: string): Promise<EngineJob | null> {
  const snap = await ref(uid, id).get();
  return readJob(snap.exists ? (snap.data() as Partial<EngineJob>) : null, id);
}

export async function patchJob(uid: string, id: string, fields: Partial<Omit<EngineJob, "id" | "uid">>): Promise<void> {
  await ref(uid, id).set(fields, { merge: true });
}

/** One more log line (the tail is kept) — a transaction, since units of one parent log concurrently. */
export async function logLine(uid: string, id: string, line: string): Promise<void> {
  const r = ref(uid, id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    const log = snap.exists ? (snap.data()?.log as string | undefined) : undefined;
    tx.set(r, { log: appendLogTail(log, line) }, { merge: true });
  });
}

/** A unit of a parent job landed; closes the parent when it was the last. */
export async function finishUnit(uid: string, id: string, ok: boolean): Promise<{ units: JobUnits; finished: boolean } | null> {
  const r = ref(uid, id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    const units = snap.exists ? (snap.data()?.units as JobUnits | undefined) : undefined;
    if (!units) return null;
    const next = unitLanded(units, ok);
    tx.set(r, { units: next.units, ...(next.finished ? { status: parentStatus(next.units), endedAt: Date.now(), progress: `done — ${next.units.done} of ${next.units.total}` } : {}) }, { merge: true });
    return next;
  });
}

/** Queued → cancelled now; running → a flag the unit checks between steps. */
export async function cancelJob(uid: string, id: string): Promise<EngineJob | null> {
  const job = await getJob(uid, id);
  if (!job) return null;
  if (job.status === "queued") await patchJob(uid, id, { status: "cancelled", cancel: true, endedAt: Date.now(), progress: "cancelled" });
  else if (job.status === "running") await patchJob(uid, id, { cancel: true });
  return getJob(uid, id);
}

export async function isCancelled(uid: string, id: string): Promise<boolean> {
  const snap = await ref(uid, id).get();
  return snap.exists && snap.data()?.cancel === true;
}

export async function listUserJobs(uid: string, limit = 20): Promise<EngineJob[]> {
  const q = await adminDb().collection(`users/${uid}/engineJobs`).orderBy("createdAt", "desc").limit(limit).get();
  return q.docs.map((d) => readJob(d.data() as Partial<EngineJob>, d.id)).filter((j): j is EngineJob => !!j);
}
