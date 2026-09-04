// Seed an admin user with a password + 90-day access.
// Usage: node scripts/seed-admin.mjs <email> <password> [days]
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const [email, password, daysArg] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/seed-admin.mjs <email> <password> [days]");
  process.exit(1);
}
const days = Number(daysArg) || 90;
const DAY = 86_400_000, now = Date.now();

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8"));
initializeApp({ credential: cert(sa) });
const auth = getAuth(), db = getFirestore();

// create or update the user with the given password
let user;
try {
  user = await auth.getUserByEmail(email);
  user = await auth.updateUser(user.uid, { password, emailVerified: true });
  console.log(`↻ updated existing user ${email}`);
} catch {
  user = await auth.createUser({ email, password, emailVerified: true });
  console.log(`＋ created user ${email}`);
}

// admin claim
await auth.setCustomUserClaims(user.uid, { admin: true });

// profile doc
await db.doc(`users/${user.uid}`).set({ email, createdAt: now }, { merge: true });

// 90-day access grant
await db.doc(`accessGrants/${user.uid}`).set({
  email, plan: "admin", durationDays: days, status: "active",
  redeemBy: null, startsAt: now, expiresAt: now + days * DAY,
  source: "seed", createdAt: now, updatedAt: now,
}, { merge: true });

// ensure default admin config exists
await db.doc("config/admin").set({
  paywallTitle: "Your access has ended",
  paywallBody: "Your JobHacker Compass access period is over. Renew to keep tracking your job-search momentum.",
  paywallCtaLabel: "Renew access",
  paywallCtaUrl: "https://jobhackers.global",
  pwResetSubject: "Set your JobHacker Compass password",
  pwResetBody: "Click the button below to set your password and start tracking.",
  updatedAt: now,
}, { merge: true });

console.log(`✔ ${email} is admin with ${days}-day access (uid ${user.uid})`);
console.log("  default admin config seeded.");
process.exit(0);
