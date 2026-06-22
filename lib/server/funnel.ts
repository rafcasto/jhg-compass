import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { mergeFunnel, type FunnelConfig } from "@/lib/funnel";

// Read the merged funnel config (defaults <- stored overrides).
export async function getFunnel(): Promise<FunnelConfig> {
  const snap = await adminDb().doc("config/funnel").get();
  return mergeFunnel(snap.exists ? (snap.data() as Partial<FunnelConfig>) : null);
}

// Persist a full funnel config (the admin editor sends the whole object).
export async function saveFunnel(funnel: Partial<FunnelConfig>, updatedBy?: string) {
  await adminDb().doc("config/funnel").set(
    { ...funnel, updatedBy: updatedBy ?? null, updatedAt: Date.now() },
    { merge: true }
  );
}
