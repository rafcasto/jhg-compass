"use client";

import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, writeBatch, arrayUnion,
  onSnapshot, query, orderBy, serverTimestamp, type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";

// ---- collection paths ----
export const paths = {
  // per-user
  contacts: (uid: string) => collection(db, "users", uid, "contacts"),
  interactions: (uid: string) => collection(db, "users", uid, "interactions"),
  opportunities: (uid: string) => collection(db, "users", uid, "opportunities"),
  activityLogs: (uid: string) => collection(db, "users", uid, "activityLogs"),
  reminders: (uid: string) => collection(db, "users", uid, "reminders"),
  profile: (uid: string) => doc(db, "users", uid),
  settingsTargets: (uid: string) => doc(db, "users", uid, "settings", "targets"),
  // per-user feedback submissions (owner-writable via users/{uid} rules)
  feedbackResponses: (uid: string) => collection(db, "users", uid, "feedback"),
  // Agents (career-ops on the Pi): the member's setup doc + the worker-written reports
  careerOpsSetup: (uid: string) => doc(db, "users", uid, "careerOps", "setup"),
  careerOpsReports: (uid: string) => collection(db, "users", uid, "careerOpsReports"),
  careerOpsPipeline: (uid: string) => collection(db, "users", uid, "careerOpsPipeline"),
  careerOpsDocs: (uid: string) => collection(db, "users", uid, "careerOpsDocs"),
  careerOpsNotes: (uid: string) => collection(db, "users", uid, "careerOpsNotes"),
  careerOpsAnswers: (uid: string) => collection(db, "users", uid, "careerOpsAnswers"),
  careerOpsVault: (uid: string) => collection(db, "users", uid, "careerOpsVault"),
  careerOpsFollowup: (uid: string) => doc(db, "users", uid, "careerOps", "followup"),
  careerOpsPortalsStatus: (uid: string) => doc(db, "users", uid, "careerOps", "portalsStatus"),
  grant: (uid: string) => doc(db, "accessGrants", uid),
  adminConfig: () => doc(db, "config", "admin"),
  content: () => doc(db, "config", "content"),
  // Coaching tab copy: { draft, published, publishedAt, publishedBy, … } (Admin → Coaching)
  coachingScreen: () => doc(db, "config", "coachingScreen"),
  feedbackConfig: () => doc(db, "config", "feedback"),
};

type SubCollection = "contacts" | "interactions" | "opportunities" | "activityLogs" | "reminders";

// ---- generic live collection hook ----
export function useLiveCollection<T extends { id: string }>(
  uid: string | undefined,
  pathFn: (uid: string) => ReturnType<typeof collection>,
  orderField = "createdAt"
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(pathFn(uid), orderBy(orderField, "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as T[]);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [uid, pathFn, orderField]);

  return { data, loading };
}

// ---- live single doc hook ----
export function useLiveDoc<T>(ref: ReturnType<typeof doc> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const key = ref?.path;
  useEffect(() => {
    if (!ref) return;
    const unsub = onSnapshot(ref, (snap) => { setData(snap.exists() ? (snap.data() as T) : null); setLoading(false); }, () => setLoading(false));
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, loading };
}

// ---- CRUD helpers ----
export async function createDoc(col: ReturnType<typeof collection>, data: Record<string, unknown>) {
  return addDoc(col, { ...data, createdAt: serverTimestamp() });
}
export async function updateRecord(
  uid: string,
  sub: SubCollection,
  id: string,
  data: Record<string, unknown>
) {
  return updateDoc(doc(db, "users", uid, sub, id), data);
}
export async function deleteRecord(
  uid: string,
  sub: SubCollection,
  id: string
) {
  return deleteDoc(doc(db, "users", uid, sub, id));
}

// ---- bulk import (CSV) ----
// Writes many docs to a per-user subcollection in chunked batches (Firestore caps
// a batch at 500 ops). Each doc gets the same createdAt as a single add would.
// Returns the new document ids, in input order.
export async function importRecords(
  uid: string,
  sub: SubCollection,
  docs: Record<string, unknown>[],
  chunkSize = 400
): Promise<string[]> {
  const col = collection(db, "users", uid, sub);
  const ids: string[] = [];
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + chunkSize)) {
      const ref = doc(col);
      batch.set(ref, { ...d, createdAt: serverTimestamp() });
      ids.push(ref.id);
    }
    await batch.commit();
  }
  return ids;
}

// Add contacts to opportunities' contactIds (set semantics — never duplicates).
export async function attachContactsToOpportunities(
  uid: string,
  links: { opportunityId: string; contactIds: string[] }[],
  chunkSize = 400
): Promise<void> {
  const todo = links.filter((l) => l.contactIds.length > 0);
  for (let i = 0; i < todo.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const l of todo.slice(i, i + chunkSize)) {
      batch.update(doc(db, "users", uid, "opportunities", l.opportunityId), { contactIds: arrayUnion(...l.contactIds) });
    }
    await batch.commit();
  }
}

export { serverTimestamp, setDoc, doc, deleteDoc, addDoc };
