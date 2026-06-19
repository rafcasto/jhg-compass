// Dev helper: grant access and/or admin to a user by email.
// Usage:
//   node scripts/grant.mjs you@email.com --admin
//   node scripts/grant.mjs you@email.com --days 90
//   node scripts/grant.mjs you@email.com --redeem-hours 48
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// load .env.local
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const [email, ...flags] = process.argv.slice(2);
if (!email) { console.error("Usage: node scripts/grant.mjs <email> [--admin] [--days N] [--redeem-hours N]"); process.exit(1); }

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8"));
initializeApp({ credential: cert(sa) });
const auth = getAuth(), db = getFirestore();

const isAdmin = flags.includes("--admin");
const days = Number(flags[flags.indexOf("--days") + 1]) || (isAdmin ? 0 : 90);
const redeemHours = flags.includes("--redeem-hours") ? Number(flags[flags.indexOf("--redeem-hours") + 1]) : 0;
const DAY = 86_400_000, now = Date.now();

let user;
try { user = await auth.getUserByEmail(email); }
catch { user = await auth.createUser({ email }); }

if (isAdmin) {
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`✔ ${email} is now an admin (uid ${user.uid})`);
}

if (days || redeemHours) {
  const grant = redeemHours
    ? { email, plan: "3_month", durationDays: 90, status: "pending", redeemBy: now + redeemHours * 3_600_000, startsAt: null, expiresAt: null }
    : { email, plan: "custom", durationDays: days, status: "active", redeemBy: null, startsAt: now, expiresAt: now + days * DAY };
  await db.doc(`accessGrants/${user.uid}`).set({ ...grant, source: "admin-script", createdAt: now, updatedAt: now }, { merge: true });
  console.log(`✔ access grant written: ${grant.status}${grant.expiresAt ? ` until ${new Date(grant.expiresAt).toDateString()}` : ` (redeem within ${redeemHours}h)`}`);
}
process.exit(0);
