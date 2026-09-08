// Client-safe (no server-only import) so the admin UI and tests can share it.

// GA4 answers 403 PERMISSION_DENIED for three different problems; Google's message
// (appended to the error by the server) is what tells them apart.
export function gaErrorHint(error: string, serviceAccountEmail: string | null): string {
  const e = error.toLowerCase();
  const who = serviceAccountEmail ?? "the service account";
  if (error.startsWith("ga_token")) return "Token exchange failed — the service-account JSON may be malformed or the key revoked.";
  if (e.includes("has not been used") || e.includes("is disabled") || e.includes("api has not been enabled") || e.includes("enable it by visiting"))
    return "The Google Analytics Data API is not enabled on the GCP project — enable “Google Analytics Data API” in the Cloud console for the project that owns the service account, then retry.";
  if (e.includes("403") || e.includes("permission"))
    return `${who} has no access to this property — add it as Viewer under GA → Admin → Property access management. GA also returns 403 for a property it can't see, so double-check GA4_PROPERTY_ID is the numeric id of the right property.`;
  if (e.includes("404") || e.includes("not_found")) return "Check GA4_PROPERTY_ID — it must be the numeric property id, not the G-… measurement id.";
  return "Check the server logs; the Data API may be disabled on the GCP project (enable “Google Analytics Data API”).";
}
