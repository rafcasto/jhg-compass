import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import { isShareToken, shareDocument, type ShareDocument, type ShareLink, type SharePageKey, type ShareRecord } from "@/lib/jobhacking/share";
import type { Profile } from "@/lib/types";

// Share links — docs/UX_SHARE.md. Mirrors registration links: the public
// index `shareLinks/{token}` is server-only (Admin SDK, rules deny every
// client), and the owner's own record `users/{uid}/shares/{page}` is written
// here beside it so the page header reads it live through the owner rule.
//
// One token per page per member. Switching a page off deletes the owner's
// record and stamps the index `revokedAt`; switching it back on mints a new
// token, so a link someone forwarded before stays dead.

const linkRef = (token: string) => adminDb().doc(`shareLinks/${token}`);
const recordRef = (uid: string, page: SharePageKey) => adminDb().doc(`users/${uid}/shares/${page}`);

/** Mint a link for a page, replacing (and revoking) any current one. */
export async function createShare(uid: string, page: SharePageKey): Promise<ShareRecord> {
  await revokeShare(uid, page);
  const token = globalThis.crypto.randomUUID().replace(/-/g, "");
  const createdAt = Date.now();
  const link: ShareLink = { uid, page, createdAt };
  const record: ShareRecord = { token, createdAt };
  const batch = adminDb().batch();
  batch.set(linkRef(token), link);
  batch.set(recordRef(uid, page), record);
  await batch.commit();
  return record;
}

/** Switch a page's link off. A no-op when the page is not shared. */
export async function revokeShare(uid: string, page: SharePageKey): Promise<void> {
  const snap = await recordRef(uid, page).get();
  if (!snap.exists) return;
  const { token } = snap.data() as ShareRecord;
  const batch = adminDb().batch();
  batch.delete(recordRef(uid, page));
  if (token) batch.set(linkRef(token), { revokedAt: Date.now() }, { merge: true });
  await batch.commit();
}

/** The live link behind a token — null when unknown or switched off. */
export async function resolveShare(token: string): Promise<ShareLink | null> {
  if (!isShareToken(token)) return null;
  const snap = await linkRef(token).get();
  if (!snap.exists) return null;
  const link = snap.data() as ShareLink;
  if (link.revokedAt) return null;
  // The owner's record is the truth: a token the record no longer names is dead even if the stamp is missing.
  const record = await recordRef(link.uid, link.page).get();
  if (!record.exists || (record.data() as ShareRecord).token !== token) return null;
  return link;
}

/** The shared page as a document, read fresh from the member's own documents — null when the link is dead. */
export async function loadSharedDocument(token: string): Promise<{ doc: ShareDocument; sharedAt: number } | null> {
  const link = await resolveShare(token);
  if (!link) return null;
  const db = adminDb();
  const [profileSnap, setupSnap] = await Promise.all([db.doc(`users/${link.uid}`).get(), db.doc(`users/${link.uid}/careerOps/setup`).get()]);
  const profile = profileSnap.exists ? (profileSnap.data() as Profile) : null;
  const setup = setupSnap.exists ? (setupSnap.data() as CareerOpsSetupV2) : null;
  return { doc: shareDocument(link.page, { profile, setup }), sharedAt: link.createdAt };
}
