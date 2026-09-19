import "server-only";
import { createSign } from "node:crypto";

// Read-only Google Drive access with the Firebase service account (or a dedicated
// one) so the site can stream a member's PDF back to them. Same JWT flow as the
// Pi worker (careerops-worker/lib/drive.js), no googleapis dependency.

function creds(): { email: string; key: string } | null {
  const email = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) return { email, key };
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  return { email: sa.client_email, key: sa.private_key };
}

let cached = { token: "", exp: 0 };
async function accessToken(): Promise<string> {
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token;
  const c = creds();
  if (!c) throw new Error("no Google service account configured");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: c.email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(c.key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${unsigned}.${sig}` });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Drive auth failed: ${j.error_description || j.error || r.status}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export async function fetchDriveFile(fileId: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) throw new Error("bad file id");
  return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { authorization: `Bearer ${await accessToken()}` } });
}
