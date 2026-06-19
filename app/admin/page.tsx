"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase/client";
import type { AdminConfig } from "@/lib/types";

const FIELDS: { key: keyof AdminConfig; label: string; textarea?: boolean }[] = [
  { key: "paywallTitle", label: "Paywall — title" },
  { key: "paywallBody", label: "Paywall — body", textarea: true },
  { key: "paywallCtaLabel", label: "Paywall — CTA label" },
  { key: "paywallCtaUrl", label: "Paywall — CTA URL" },
  { key: "pwResetSubject", label: "Password email — subject" },
  { key: "pwResetBody", label: "Password email — body", textarea: true },
];

async function token() { return auth.currentUser!.getIdToken(); }

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    user.getIdTokenResult(true).then((t) => setAuthorized(t.claims.admin === true));
  }, [user, loading, router]);

  if (authorized === null) return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
  if (authorized === false) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div><h1 className="mb-2">Not authorized</h1><p className="text-jh-mute">This area is for admins only.</p></div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <div><span className="eyebrow">Admin</span><h1 className="mt-1">Compass settings</h1></div>
      <RegistrationLinks />
      <ConfigForm />
    </div>
  );
}

function RegistrationLinks() {
  const [expiryHours, setExpiryHours] = useState(48);
  const [accessDurationDays, setAccessDurationDays] = useState(90);
  const [maxUses, setMaxUses] = useState(1);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/registration-link", { headers: { authorization: `Bearer ${await token()}` } });
    if (res.ok) setLinks((await res.json()).links ?? []);
  }
  useEffect(() => { load(); }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const res = await fetch("/api/admin/registration-link", {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiryHours, accessDurationDays, maxUses, email: email || null }),
    });
    if (res.ok) { setEmail(""); await load(); }
    setBusy(false);
  }

  const urlFor = (t: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/register/${t}`;
  async function copy(t: string) { await navigator.clipboard.writeText(urlFor(t)); setCopied(t); setTimeout(() => setCopied(null), 1500); }
  const fmt = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center gap-2"><LinkIcon className="h-5 w-5 text-jh-red" /><h3 className="text-base">Registration links</h3></div>
      <p className="text-sm text-jh-mute">Generate a temporary signup link that grants timed access. Set how long the link stays valid and how long access lasts.</p>
      <form onSubmit={generate} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div><label className="label">Link valid (hours)</label><input type="number" min={1} className="field" value={expiryHours} onChange={(e) => setExpiryHours(+e.target.value)} /></div>
        <div><label className="label">Access (days)</label><input type="number" min={1} className="field" value={accessDurationDays} onChange={(e) => setAccessDurationDays(+e.target.value)} /></div>
        <div><label className="label">Max uses</label><input type="number" min={1} className="field" value={maxUses} onChange={(e) => setMaxUses(+e.target.value)} /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label">Lock to email (optional)</label><input className="field" placeholder="anyone" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="col-span-2 sm:col-span-4"><button disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Generating…" : "Generate link"}</button></div>
      </form>

      {links.length > 0 && (
        <ul className="divide-y divide-jh-line border-t border-jh-line pt-2">
          {links.map((l) => (
            <li key={l.token} className="py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono text-jh-ink truncate">/register/{l.token.slice(0, 12)}…</p>
                <p className="text-xs text-jh-mute">
                  {l.accessDurationDays}d access · {l.uses}/{l.maxUses} used · {l.email ? `${l.email} · ` : ""}
                  <span className={l.status === "active" ? "text-rb-green-dark" : "text-jh-mute"}>
                    {l.status === "active" ? `valid till ${fmt(l.expiresAt)}` : l.status}
                  </span>
                </p>
              </div>
              <button onClick={() => copy(l.token)} disabled={l.status !== "active"} className="btn-secondary text-xs px-3 py-2 disabled:opacity-40">
                {copied === l.token ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConfigForm() {
  const [cfg, setCfg] = useState<Partial<AdminConfig>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/config", { headers: { authorization: `Bearer ${await token()}` } });
      if (res.ok) setCfg((await res.json()).config);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setSaved(false);
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    if (res.ok) { setCfg((await res.json()).config); setSaved(true); }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="card p-6 space-y-4">
      <h3 className="text-base">Paywall &amp; email copy</h3>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          {f.textarea ? (
            <textarea className="field min-h-24" value={(cfg[f.key] as string) ?? ""} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })} />
          ) : (
            <input className="field" value={(cfg[f.key] as string) ?? ""} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save changes"}</button>
        {saved && <span className="text-sm text-rb-green-dark">Saved ✓</span>}
      </div>
    </form>
  );
}
