import "server-only";
import { createSign } from "node:crypto";

// Google Analytics 4 — the Awareness layer of Pirate metrics.
//
// Reads the GA4 Data API with a service account, no googleapis dependency:
// sign a JWT (RS256), swap it for an access token, call runReport. Everything
// is non-throwing at the edges: the admin dashboard shows "not connected" or
// the error string instead of failing the whole metrics call.
//
// Env:
//   GA4_PROPERTY_ID            — the numeric property id (Admin → Property settings)
//   GA4_SERVICE_ACCOUNT_B64    — base64 service-account JSON with Viewer on the property
//                                (optional: falls back to FIREBASE_SERVICE_ACCOUNT_B64 —
//                                 same GCP project, just grant that account Viewer in GA)

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";

interface ServiceAccount { client_email: string; private_key: string }

export function gaPropertyId(): string | null {
  return process.env.GA4_PROPERTY_ID?.trim() || null;
}
function serviceAccount(): ServiceAccount | null {
  const b64 = process.env.GA4_SERVICE_ACCOUNT_B64?.trim() || process.env.FIREBASE_SERVICE_ACCOUNT_B64?.trim();
  if (!b64) return null;
  try {
    const j = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return j?.client_email && j?.private_key ? { client_email: j.client_email, private_key: j.private_key } : null;
  } catch { return null; }
}
export const isGaConfigured = () => !!gaPropertyId() && !!serviceAccount();
export const gaUsesFirebaseAccount = () => !process.env.GA4_SERVICE_ACCOUNT_B64?.trim() && !!process.env.FIREBASE_SERVICE_ACCOUNT_B64?.trim();

/* ---------------- auth ---------------- */

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

// Pure: build + sign the OAuth JWT assertion. Exported for tests.
export function signServiceAccountJwt(sa: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signServiceAccountJwt(sa) }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`ga_token_${res.status}${json.error ? `_${json.error}` : ""}`);
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

/* ---------------- runReport ---------------- */

interface RunReportResponse {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
}

// Pure: flatten a runReport response into { [dimension]: string, [metric]: number } rows.
export function normalizeReport(r: RunReportResponse): Record<string, string | number>[] {
  const dims = (r.dimensionHeaders ?? []).map((h) => h.name);
  const mets = (r.metricHeaders ?? []).map((h) => h.name);
  return (r.rows ?? []).map((row) => {
    const out: Record<string, string | number> = {};
    dims.forEach((d, i) => { out[d] = row.dimensionValues?.[i]?.value ?? ""; });
    mets.forEach((m, i) => { out[m] = Number(row.metricValues?.[i]?.value ?? 0) || 0; });
    return out;
  });
}

async function runReport(token: string, propertyId: string, body: Record<string, unknown>) {
  const res = await fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ga_report_${res.status}${json?.error?.status ? `_${json.error.status}` : ""}`);
  return normalizeReport(json as RunReportResponse);
}

/* ---------------- the Awareness report ---------------- */

export interface AwarenessReport {
  days: number;
  totals: { sessions: number; users: number; newUsers: number; pageViews: number; engagementRate: number };
  channels: { label: string; count: number }[];   // sessionDefaultChannelGroup → sessions
  countries: { label: string; count: number }[];  // country → sessions (top 10)
  pages: { label: string; count: number }[];      // landing page → sessions (top 8)
  daily: { day: string; sessions: number; users: number }[];
}

export type AwarenessResult =
  | { configured: false }
  | { configured: true; ok: true; report: AwarenessReport }
  | { configured: true; ok: false; error: string };

const toYmd = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`; // GA "20260908" → "2026-09-08"
const rows = (list: Record<string, string | number>[], dim: string, met = "sessions") =>
  list.map((r) => ({ label: String(r[dim] || "(not set)"), count: Number(r[met]) })).filter((r) => r.count > 0);

export async function getAwarenessReport(days = 28): Promise<AwarenessResult> {
  const propertyId = gaPropertyId(); const sa = serviceAccount();
  if (!propertyId || !sa) return { configured: false };
  const dateRanges = [{ startDate: `${Math.max(1, Math.min(365, days))}daysAgo`, endDate: "today" }];
  try {
    const token = await accessToken(sa);
    const [totals, channels, countries, pages, daily] = await Promise.all([
      runReport(token, propertyId, { dateRanges, metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }, { name: "screenPageViews" }, { name: "engagementRate" }] }),
      runReport(token, propertyId, { dateRanges, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }),
      runReport(token, propertyId, { dateRanges, dimensions: [{ name: "country" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 10 }),
      runReport(token, propertyId, { dateRanges, dimensions: [{ name: "landingPage" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 8 }),
      runReport(token, propertyId, { dateRanges, dimensions: [{ name: "date" }], metrics: [{ name: "sessions" }, { name: "totalUsers" }], orderBys: [{ dimension: { dimensionName: "date" } }] }),
    ]);
    const t = totals[0] ?? {};
    return {
      configured: true, ok: true,
      report: {
        days,
        totals: {
          sessions: Number(t.sessions ?? 0), users: Number(t.totalUsers ?? 0), newUsers: Number(t.newUsers ?? 0),
          pageViews: Number(t.screenPageViews ?? 0), engagementRate: Math.round(Number(t.engagementRate ?? 0) * 100),
        },
        channels: rows(channels, "sessionDefaultChannelGroup"),
        countries: rows(countries, "country"),
        pages: rows(pages, "landingPage"),
        daily: daily.map((r) => ({ day: toYmd(String(r.date)), sessions: Number(r.sessions), users: Number(r.totalUsers) })),
      },
    };
  } catch (err) {
    return { configured: true, ok: false, error: err instanceof Error ? err.message : "ga_request_failed" };
  }
}
