import { getFunnel } from "@/lib/server/funnel";
import { DEFAULT_FUNNEL } from "@/lib/funnel";
import LandingClient from "./LandingClient";

// Server-render the saved funnel config so the landing's FIRST paint already shows
// the admin's content — no flash of default text on refresh. Rendered per-request
// so each load reflects the latest save.
export const dynamic = "force-dynamic";

export default async function Page() {
  let funnel = DEFAULT_FUNNEL;
  try { funnel = await getFunnel(); } catch { /* fall back to defaults */ }
  return <LandingClient funnel={funnel} />;
}
