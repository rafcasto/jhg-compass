// Portal-account vault (users/{uid}/careerOpsVault/{host}). The password is encrypted HERE, in the
// browser, with the Pi worker's RSA public key (careerops:state.vaultPublicKey) — Vercel never sees
// it, Firestore stores ciphertext only, and only the Pi's private key can read it back.
export interface VaultAccount {
  id: string;                 // = host
  host: string;
  portal: "workday" | "successfactors" | "csod" | "generic";
  company?: string | null;
  email: string;
  passwordEnc: string;        // base64 RSA-OAEP(SHA-256) ciphertext for the worker's public key
  status: "pending" | "ok" | "failed";
  lastLoginAt?: number | null;
  lastError?: string | null;
  createdAt: number;
  updatedAt: number;
}

export const hostOf = (url: string): string => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } };
export function portalFor(host: string): VaultAccount["portal"] {
  if (/myworkdayjobs\.com$/i.test(host)) return "workday";
  if (/successfactors\.(eu|com)$|jobs2web/i.test(host)) return "successfactors";
  if (/\.csod\.com$/i.test(host)) return "csod";
  return "generic";
}
export const PORTAL_LABELS: Record<VaultAccount["portal"], string> = { workday: "Workday", successfactors: "SuccessFactors", csod: "Cornerstone", generic: "Careers site" };

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function encryptForWorker(publicKeySpkiB64: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("spki", fromB64(publicKeySpkiB64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  return b64(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, new TextEncoder().encode(secret)));
}
// A password for this portal only — so nothing else of yours is exposed if a portal leaks.
export function generatePassword(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = ""; for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
