// Seed the tracker with the data actually present in the JHG Monthly Activity Tracker (Excel).
// The Excel is a blank template except one row: "Research & read target industry" → Target 6, Actual 7 (Week 1).
// We seed that faithfully for the current week. No fabricated sample data.
// Usage: node scripts/seed-tracker.mjs <adminEmail>
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const email = process.argv[2] || "rafael@digitalpathways.io";

// ---- Excel values (only the research row was filled in) ----
const EXCEL_TARGETS = { research_industry: 6 };          // Week-1 "Target"
const EXCEL_ACTUALS = { research_industry: 7 };          // Week-1 "Actual"

// current week (Monday) key, YYYY-MM-DD
const d = new Date();
const day = (d.getDay() + 6) % 7;
d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0);
const weekKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8"));
initializeApp({ credential: cert(sa) });
const auth = getAuth(), db = getFirestore();

const user = await auth.getUserByEmail(email);
const uid = user.uid;

// targets for the week
await db.doc(`users/${uid}/activityTargets/${weekKey}`).set({ weekStart: weekKey, targets: EXCEL_TARGETS }, { merge: true });

// actuals — one activity log per recorded activity (replaces any prior seed of same category this week)
const logsCol = db.collection(`users/${uid}/activityLogs`);
const existing = await logsCol.where("loggedOn", ">=", weekKey).get();
const batch = db.batch();
for (const doc of existing.docs) if (doc.data().seed) batch.delete(doc.ref);
for (const [categoryId, count] of Object.entries(EXCEL_ACTUALS)) {
  batch.set(logsCol.doc(), { categoryId, loggedOn: todayKey, count, seed: true, createdAt: FieldValue.serverTimestamp() });
}
await batch.commit();

console.log(`✔ seeded tracker for ${email} (week of ${weekKey})`);
console.log(`  targets: ${JSON.stringify(EXCEL_TARGETS)}`);
console.log(`  actuals: ${JSON.stringify(EXCEL_ACTUALS)}  (from the Excel's only filled row)`);
process.exit(0);
