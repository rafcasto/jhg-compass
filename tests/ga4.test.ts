import { describe, it, expect, vi } from "vitest";

// lib/server/ga4 is server-only; the pure helpers under test don't need the guard.
vi.mock("server-only", () => ({}));
import { generateKeyPairSync, createVerify } from "node:crypto";
import { normalizeReport, signServiceAccountJwt } from "@/lib/server/ga4";

const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

describe("GA4 Data API client", () => {
  it("signs a verifiable RS256 JWT for the analytics.readonly scope", () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const sa = { client_email: "ga@proj.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) as string };
    const jwt = signServiceAccountJwt(sa, 1_700_000_000);
    const [h, c, sig] = jwt.split(".");
    expect(JSON.parse(fromB64url(h).toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(fromB64url(c).toString());
    expect(claims).toMatchObject({ iss: sa.client_email, aud: "https://oauth2.googleapis.com/token", iat: 1_700_000_000, exp: 1_700_003_600 });
    expect(claims.scope).toBe("https://www.googleapis.com/auth/analytics.readonly");
    const v = createVerify("RSA-SHA256"); v.update(`${h}.${c}`);
    expect(v.verify(publicKey, fromB64url(sig))).toBe(true);
  });

  it("flattens a runReport response into typed rows", () => {
    const rows = normalizeReport({
      dimensionHeaders: [{ name: "sessionDefaultChannelGroup" }],
      metricHeaders: [{ name: "sessions" }],
      rows: [
        { dimensionValues: [{ value: "Organic Social" }], metricValues: [{ value: "42" }] },
        { dimensionValues: [{ value: "Direct" }], metricValues: [{ value: "7" }] },
      ],
    });
    expect(rows).toEqual([{ sessionDefaultChannelGroup: "Organic Social", sessions: 42 }, { sessionDefaultChannelGroup: "Direct", sessions: 7 }]);
    expect(normalizeReport({})).toEqual([]);
  });
});
