"use client";

import { useState } from "react";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { KeyRound, Trash2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { encryptForWorker, generatePassword, hostOf, portalFor, PORTAL_LABELS, type VaultAccount } from "@/lib/careerops/vault";
import { CopyButton } from "@/components/careerops/shared";

// One portal account: email + password → encrypted in this browser with the Pi's public key → vault.
// The Pi signs in with it to read application forms; it never submits anything.
export function PortalAccountForm({ uid, host: hostIn = "", company, publicKey, existing, onSaved }: { uid: string; host?: string; company?: string | null; publicKey: string | null; existing?: VaultAccount | null; onSaved?: () => void }) {
  const [host, setHost] = useState(hostIn);
  const [email, setEmail] = useState(existing?.email ?? "");
  const [password, setPassword] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const h = hostOf(host.includes("://") ? host : `https://${host}`);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!publicKey) { setMsg("The Pi hasn't published its vault key yet — is the worker online?"); return; }
    if (!h || !email.trim() || !password) { setMsg("Portal host, email and password are all needed."); return; }
    setBusy(true);
    try {
      const passwordEnc = await encryptForWorker(publicKey, password);
      const now = Date.now();
      await setDoc(doc(paths.careerOpsVault(uid), h), { host: h, portal: portalFor(h), company: company ?? existing?.company ?? null, email: email.trim(), passwordEnc, status: "pending", lastError: null, updatedAt: now, ...(existing ? {} : { createdAt: now }) }, { merge: true });
      setPassword(""); setMsg("Saved — encrypted for the Pi. Read the form again to use it."); onSaved?.();
    } catch { setMsg("Couldn't save the account."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="space-y-2">
      <div className="grid sm:grid-cols-[1.4fr_1fr_1fr_auto] gap-2 items-end">
        <label className="block"><span className="text-xs text-jh-mute">Portal host</span><input aria-label="Portal host" className="field text-sm font-mono" placeholder="westpacnz.wd105.myworkdayjobs.com" value={host} onChange={(e) => setHost(e.target.value)} disabled={!!hostIn} /></label>
        <label className="block"><span className="text-xs text-jh-mute">Email used on the portal</span><input aria-label="Portal email" type="email" className="field text-sm" placeholder="you+westpac@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block"><span className="text-xs text-jh-mute">{existing ? "New password" : "Password"}</span><input aria-label="Portal password" type="password" className="field text-sm font-mono" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
        <button type="submit" disabled={busy || !publicKey} className="btn-primary text-xs px-3 py-2 h-[42px] disabled:opacity-60"><KeyRound className="h-4 w-4" /> {busy ? "Saving…" : existing ? "Replace" : "Save"}</button>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-xs text-jh-mute">
        <button type="button" onClick={() => { const p = generatePassword(); setPassword(p); setGenerated(p); }} className="btn-ghost text-xs">Generate a password for this portal</button>
        {generated && <span className="flex items-center gap-2">Use this when you create the account — it is shown once: <code className="font-mono text-jh-ink">{generated}</code> <CopyButton text={generated} /></span>}
        <span>{h ? `${PORTAL_LABELS[portalFor(h)]} · ` : ""}encrypted in your browser for the Pi only; Compass can&apos;t read it back.</span>
        {msg && <span className={msg.startsWith("Saved") ? "text-rb-green-dark" : "text-jh-red"}>{msg}</span>}
      </div>
    </form>
  );
}

export function PortalAccountRow({ uid, a }: { uid: string; a: VaultAccount }) {
  const Icon = a.status === "ok" ? CheckCircle2 : a.status === "failed" ? AlertTriangle : Clock;
  return (
    <li className="flex items-center gap-3 py-2">
      <Icon className={`h-4 w-4 shrink-0 ${a.status === "ok" ? "text-rb-green-dark" : a.status === "failed" ? "text-jh-red" : "text-jh-mute"}`} />
      <span className="flex-1 min-w-0 text-sm"><span className="block font-semibold text-jh-ink truncate">{a.company ? `${a.company} · ` : ""}{PORTAL_LABELS[a.portal] ?? a.portal} <span className="font-mono font-normal text-xs text-jh-mute">{a.host}</span></span>
        <span className="block text-xs text-jh-mute truncate">{a.email} · {a.status === "ok" ? `signed in ${a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : ""}` : a.status === "failed" ? `last sign-in failed: ${a.lastError ?? "unknown"}` : "not used yet"}</span></span>
      <button type="button" onClick={() => { if (confirm(`Remove the ${a.host} account from your vault?`)) deleteDoc(doc(paths.careerOpsVault(uid), a.id)); }} className="btn-ghost p-2 text-jh-red" aria-label={`Remove ${a.host}`}><Trash2 className="h-4 w-4" /></button>
    </li>
  );
}
