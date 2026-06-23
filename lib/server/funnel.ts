import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { mergeFunnel, type FunnelConfig } from "@/lib/funnel";

// Read the merged funnel config (defaults <- stored overrides).
export async function getFunnel(): Promise<FunnelConfig> {
  const snap = await adminDb().doc("config/funnel").get();
  return mergeFunnel(snap.exists ? (snap.data() as Partial<FunnelConfig>) : null);
}

// Persist a full funnel config. We normalise through mergeFunnel (drops any
// legacy/removed keys) and OVERWRITE the doc (no merge) so stale fields are
// physically removed from Firestore rather than lingering.
export async function saveFunnel(funnel: Partial<FunnelConfig>, updatedBy?: string) {
  const clean = mergeFunnel(funnel);
  await adminDb().doc("config/funnel").set(
    { ...clean, updatedBy: updatedBy ?? null, updatedAt: Date.now() }
  );
}
