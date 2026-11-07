"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { authed } from "@/components/admin/shared";
import JobHackingScreen from "@/components/jobhacking/JobHackingScreen";
import { useAccess } from "@/lib/firestore/access";
import { paths, useLiveCollection } from "@/lib/firestore/db";
import type { JhPageKey } from "@/lib/jobhacking/sections";
import type { VaultAccount } from "@/lib/careerops/vault";

// One area of Compass → Settings (/settings/narrative · true-north · companies ·
// artefacts · agents) — docs/UX_SETTINGS_HUB.md §3. The JobHacking screen on
// the Compass portal, plus what only Compass needs: whether the member has the
// CareerOps worker (Agents · Portal accounts exists only then), the vault's
// account count for its row, and the worker's public key for its editor.

export default function SettingsArea({ page }: { page: JhPageKey }) {
  const { user, isAdmin } = useAuth();
  const uid = user?.uid;
  const { agentsEnabled } = useAccess(uid);
  const careerOps = agentsEnabled || isAdmin;
  const { data: vault } = useLiveCollection<VaultAccount>(careerOps ? uid : undefined, paths.careerOpsVault);

  // The worker's RSA public key, so the browser can encrypt portal passwords for it alone.
  const [publicKey, setPublicKey] = useState<string | null>(null);
  useEffect(() => {
    if (!careerOps) return;
    let stop = false;
    authed("/api/agents/status").then((r) => r.json()).then((d) => { if (!stop && d?.ok) setPublicKey(d.vaultPublicKey ?? null); }).catch(() => {});
    return () => { stop = true; };
  }, [careerOps]);

  return <JobHackingScreen page={page} portal="compass" careerOps={careerOps} accounts={vault.length} publicKey={publicKey} />;
}
