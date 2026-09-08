import { describe, expect, it } from "vitest";
import { gaErrorHint } from "@/lib/ga4-hint";

const SA = "firebase-adminsdk-fbsvc@jhg-compass.iam.gserviceaccount.com";

describe("gaErrorHint — tells the three 403 PERMISSION_DENIED causes apart", () => {
  it("names the service account when it is not on the property", () => {
    const hint = gaErrorHint("ga_report_403_PERMISSION_DENIED: User does not have sufficient permissions for this property.", SA);
    expect(hint).toContain(SA);
    expect(hint).toContain("Property access management");
    expect(hint).toContain("GA4_PROPERTY_ID");
  });
  it("points at the Cloud console when the Data API is disabled on the project", () => {
    const hint = gaErrorHint("ga_report_403_PERMISSION_DENIED: Google Analytics Data API has not been used in project jhg-compass before or it is disabled. Enable it by visiting https://console.developers.google.com/…", SA);
    expect(hint).toContain("Google Analytics Data API");
    expect(hint).toContain("not enabled");
    expect(hint).not.toContain("Property access management");
  });
  it("falls back to a generic label when the account email is unknown", () => {
    expect(gaErrorHint("ga_report_403_PERMISSION_DENIED", null)).toMatch(/^the service account has no access/);
  });
  it("still recognises token and 404 failures", () => {
    expect(gaErrorHint("ga_token_400_invalid_grant: Invalid JWT Signature.", SA)).toContain("Token exchange failed");
    expect(gaErrorHint("ga_report_404_NOT_FOUND", SA)).toContain("numeric property id");
  });
});
