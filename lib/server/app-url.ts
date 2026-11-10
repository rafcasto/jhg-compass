import "server-only";

// Base URL of the deployed app. APP_URL overrides (custom domains, local dev);
// otherwise Vercel provides the production domain. Null when neither is set.
// Shared by the email action links and the engine's queue callbacks.
export function appBaseUrl(): string | null {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return null;
}
