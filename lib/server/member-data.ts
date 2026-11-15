import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ACCOUNT_FIELDS, MEMBER_COLLECTIONS, collectionsForScope, type MemberDataSummary, type ResetScope } from "@/lib/member-data";
import type { Profile } from "@/lib/types";

// Reset or delete one member's data (Admin → TOFU → Access renewals → Member data). Admin SDK
// only: the rules never let a client write engineJobs, coachSessions or claudeUsage, and a
// delete has to reach shareLinks and the Auth user too. Every act leaves one line in
// adminAudit/{id} (server-only; the rules deny every client).

/** What the member has — counted, so the admin confirms against the real numbers. */
export async function memberDataSummary(uid: string): Promise<MemberDataSummary> {
  const db = adminDb();
  const [account, grant, counts, authUser] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`accessGrants/${uid}`).get(),
    Promise.all(MEMBER_COLLECTIONS.map(async (c) => [c.key, (await db.collection(`users/${uid}/${c.key}`).count().get()).data().count] as const)),
    adminAuth().getUser(uid).then((u) => u).catch(() => null),
  ]);
  const profile = account.exists ? (account.data() as Partial<Profile>) : null;
  return {
    uid,
    email: profile?.email ?? (grant.exists ? ((grant.data() as { email?: string }).email ?? null) : null) ?? authUser?.email ?? null,
    counts: Object.fromEntries(counts.filter(([, n]) => n > 0)),
    hasAccount: account.exists,
    hasGrant: grant.exists,
    hasAuthUser: !!authUser,
  };
}

/** The share links a member minted — top-level, keyed by token, so they are found by uid. */
async function deleteShareLinks(uid: string): Promise<number> {
  const db = adminDb();
  const snap = await db.collection("shareLinks").where("uid", "==", uid).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function audit(action: "reset" | "delete", uid: string, by: string, details: Record<string, unknown>): Promise<void> {
  await adminDb().collection("adminAudit").add({ action, uid, by, at: Date.now(), ...details });
}

export interface ResetResult { uid: string; scope: ResetScope; removed: string[]; shareLinks: number }

/**
 * Reset: the subcollections of the scope go (recursively — a document's own subcollections with it);
 * on `all` the account document keeps only its identity fields and the share links are revoked.
 * The grant and the Auth user stay — the member signs in to an empty Compass.
 */
export async function resetMemberData(uid: string, scope: ResetScope, by: string): Promise<ResetResult> {
  const db = adminDb();
  const before = await memberDataSummary(uid);
  const keys = collectionsForScope(scope);
  const removed: string[] = [];
  for (const key of keys) {
    if (!before.counts[key]) continue;
    await db.recursiveDelete(db.collection(`users/${uid}/${key}`));
    removed.push(key);
  }
  let shareLinks = 0;
  if (scope === "all") {
    shareLinks = await deleteShareLinks(uid);
    const snap = await db.doc(`users/${uid}`).get();
    if (snap.exists) {
      const d = snap.data() as Record<string, unknown>;
      const kept: Record<string, unknown> = {};
      for (const f of ACCOUNT_FIELDS) if (d[f] !== undefined) kept[f] = d[f];
      await db.doc(`users/${uid}`).set(kept);
    }
  }
  await audit("reset", uid, by, { scope, email: before.email, removed, shareLinks, counts: before.counts });
  return { uid, scope, removed, shareLinks };
}

export interface DeleteResult { uid: string; email: string | null; shareLinks: number; authUserDeleted: boolean }

/** Delete: the whole users/{uid} tree, the grant, the share links, and the Auth user. Nothing of the member stays. */
export async function deleteMember(uid: string, by: string): Promise<DeleteResult> {
  const db = adminDb();
  const before = await memberDataSummary(uid);
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.doc(`accessGrants/${uid}`).delete();
  const shareLinks = await deleteShareLinks(uid);
  let authUserDeleted = false;
  if (before.hasAuthUser) { await adminAuth().deleteUser(uid); authUserDeleted = true; }
  await audit("delete", uid, by, { email: before.email, shareLinks, authUserDeleted, counts: before.counts });
  return { uid, email: before.email, shareLinks, authUserDeleted };
}
