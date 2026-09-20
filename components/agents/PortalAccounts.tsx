"use client";

import { paths, useLiveCollection } from "@/lib/firestore/db";
import type { VaultAccount } from "@/lib/careerops/vault";
import { useCareerOps } from "@/components/careerops/shared";
import { PortalAccountForm, PortalAccountRow } from "./PortalAccount";

// Setup → Portal accounts: the vault list plus an add form.
export default function PortalAccounts({ uid }: { uid: string }) {
  const { data: vault } = useLiveCollection<VaultAccount>(uid, paths.careerOpsVault);
  const { ctx } = useCareerOps();
  return (
    <div className="space-y-3">
      {vault.length > 0 ? <ul className="divide-y divide-jh-line">{vault.map((a) => <PortalAccountRow key={a.id} uid={uid} a={a} />)}</ul> : <p className="text-xs text-jh-mute">No portal accounts yet. The Apply screen offers to add one the moment a form asks for it.</p>}
      <PortalAccountForm uid={uid} publicKey={ctx?.status?.vaultPublicKey ?? null} />
    </div>
  );
}
