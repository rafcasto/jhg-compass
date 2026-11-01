"use client";

import { paths, useLiveCollection } from "@/lib/firestore/db";
import type { VaultAccount } from "@/lib/careerops/vault";
import { PortalAccountForm, PortalAccountRow } from "./PortalAccount";

// The vault list plus an add form. Rendered on Settings → Portal accounts and
// on the CareerOps Setup screen. `publicKey` is the worker's RSA public key
// (from /api/agents/status); without it nothing can be encrypted, so the form
// says so instead of pretending.
export default function PortalAccounts({ uid, publicKey }: { uid: string; publicKey: string | null }) {
  const { data: vault } = useLiveCollection<VaultAccount>(uid, paths.careerOpsVault);
  return (
    <div className="space-y-4">
      {vault.length > 0
        ? <ul className="divide-y divide-jh-line" aria-label="Portal accounts">{vault.map((a) => <PortalAccountRow key={a.id} uid={uid} a={a} />)}</ul>
        : <p className="text-sm text-jh-mute">No portal accounts yet. The Apply screen also offers to add one the moment a form asks for it.</p>}
      <div className={vault.length > 0 ? "border-t border-jh-line pt-4" : ""}>
        <PortalAccountForm uid={uid} publicKey={publicKey} />
      </div>
    </div>
  );
}
