// Deploy firestore.rules to the live project using the service account (no firebase CLI / login needed).
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8"));
const pid = sa.project_id;
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

const auth = new GoogleAuth({ credentials: sa, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const token = (await (await auth.getClient()).getAccessToken()).token;
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const base = `https://firebaserules.googleapis.com/v1/projects/${pid}`;

// 1) create a ruleset
const rs = await fetch(`${base}/rulesets`, {
  method: "POST", headers: H,
  body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content: rules }] } }),
});
const rsBody = await rs.json();
if (!rs.ok) { console.error("ruleset create failed:", JSON.stringify(rsBody)); process.exit(1); }
console.log("✔ ruleset:", rsBody.name);

// 2) point the cloud.firestore release at it (PATCH existing, else POST new)
const relName = `projects/${pid}/releases/cloud.firestore`;
let rel = await fetch(`${base}/releases/cloud.firestore`, {
  method: "PATCH", headers: H,
  body: JSON.stringify({ release: { name: relName, rulesetName: rsBody.name } }),
});
if (!rel.ok) {
  rel = await fetch(`${base}/releases`, {
    method: "POST", headers: H,
    body: JSON.stringify({ name: relName, rulesetName: rsBody.name }),
  });
}
const relBody = await rel.json();
if (!rel.ok) { console.error("release failed:", JSON.stringify(relBody)); process.exit(1); }
console.log("✔ released to cloud.firestore");
process.exit(0);
