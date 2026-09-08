"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Link as LinkIcon, CornerDownRight } from "lucide-react";
import { TEXT_FIELDS } from "@/lib/content";
import type { AdminConfig, ContentConfig } from "@/lib/types";
import {
  authed, postJson, AuditLine, Field, Loading, NumberField, SaveBar, Section, TextFields, type Notice,
} from "@/components/admin/shared";

// Which strings this screen owns — every auth surface a prospect crosses on the
// way in, plus the paywall + transactional emails.
const GROUPS = ["Invite registration", "Sign in / sign up", "Verify-email gate", "Set password / verify link"] as const;
const FIELDS_BY_GROUP = GROUPS.map((g) => ({ group: g, fields: TEXT_FIELDS.filter((f) => f.group === g) }));
const KEYS = new Set(FIELDS_BY_GROUP.flatMap((g) => g.fields.map((f) => f.key)));

// Paywall / email copy lives in config/admin (lib/server/grants.ts).
const CONFIG_FIELDS: { key: keyof AdminConfig; label: string; textarea?: boolean }[] = [
  { key: "paywallTitle", label: "Paywall — title" },
  { key: "paywallBody", label: "Paywall — body", textarea: true },
  { key: "paywallCtaLabel", label: "Paywall — CTA label" },
  { key: "paywallCtaUrl", label: "Paywall — CTA URL" },
  { key: "pwResetSubject", label: "Password email — subject" },
  { key: "pwResetBody", label: "Password email — body", textarea: true },
  { key: "emailVerifySubject", label: "Email verification — subject" },
  { key: "emailVerifyBody", label: "Email verification — body", textarea: true },
];

interface LinkRow { token: string; status: string; expiresAt: number; accessDurationDays: number; uses: number; maxUses: number; email?: string | null }

export default function RegistrationAccess({ inviteUrl, onUseAsInvite }: { inviteUrl: string; onUseAsInvite?: (url: string) => Promise<void> }) {
  return (
    <div className="space-y-8">
      <LinkGenerator inviteUrl={inviteUrl} onUseAsInvite={onUseAsInvite} />
      <AccessCopy />
    </div>
  );
}

/* ---------------- invite-link generator ---------------- */
function LinkGenerator({ inviteUrl, onUseAsInvite }: { inviteUrl: string; onUseAsInvite?: (url: string) => Promise<void> }) {
  const [expiryHours, setExpiryHours] = useState(48);
  const [accessDurationDays, setAccessDurationDays] = useState(60);
  const [maxUses, setMaxUses] = useState(1);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [using, setUsing] = useState<string | null>(null);

  async function load() {
    const res = await authed("/api/admin/registration-link");
    if (res.ok) setLinks((await res.json()).links ?? []);
  }
  useEffect(() => { load(); }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const res = await postJson("/api/admin/registration-link", { expiryHours, accessDurationDays, maxUses, email: email || null });
    if (res.ok) { setEmail(""); await load(); }
    setBusy(false);
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urlFor = (t: string) => `${origin}/register/${t}`;
  async function copy(t: string) { await navigator.clipboard.writeText(urlFor(t)); setCopied(t); setTimeout(() => setCopied(null), 1500); }
  async function applyToFunnel(t: string) { if (!onUseAsInvite) return; setUsing(t); try { await onUseAsInvite(urlFor(t)); } finally { setUsing(null); } }
  const fmt = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const isCurrent = (t: string) => !!inviteUrl && inviteUrl.includes(`/register/${t}`);

  return (
    <Section title="Registration links" help="A temporary sign-up link that grants timed access. The link the thank-you page continues to is marked “in funnel”." >
      <form onSubmit={generate} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <NumberField label="Link valid (hours)" min={1} value={expiryHours} onChange={setExpiryHours} />
        <NumberField label="Access (days)" min={1} value={accessDurationDays} onChange={setAccessDurationDays} />
        <NumberField label="Max uses" min={1} value={maxUses} onChange={setMaxUses} />
        <Field label="Lock to email" value={email} onChange={setEmail} placeholder="anyone" />
        <button disabled={busy} className="btn-primary disabled:opacity-60 h-[46px]"><LinkIcon className="h-4 w-4" /> {busy ? "Generating…" : "Generate"}</button>
      </form>

      {links.length > 0 && (
        <ul className="divide-y divide-jh-line border border-jh-line rounded-md overflow-hidden">
          {links.map((l) => (
            <li key={l.token} className="py-3 px-4 flex items-center gap-3 bg-white">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono text-jh-ink truncate">/register/{l.token.slice(0, 12)}…
                  {isCurrent(l.token) && <span className="pill bg-jh-red-soft text-jh-red ml-2 align-middle">in funnel</span>}
                </p>
                <p className="text-xs text-jh-mute">{l.accessDurationDays}d access · {l.uses}/{l.maxUses} used · {l.email ? `${l.email} · ` : ""}
                  <span className={l.status === "active" ? "text-rb-green-dark" : "text-jh-mute"}>{l.status === "active" ? `valid till ${fmt(l.expiresAt)}` : l.status}</span></p>
              </div>
              {onUseAsInvite && (
                <button type="button" onClick={() => applyToFunnel(l.token)} disabled={l.status !== "active" || isCurrent(l.token) || using !== null}
                  className="btn-secondary text-xs px-3 py-2 disabled:opacity-40 whitespace-nowrap" title="Point the thank-you CTA at this link">
                  <CornerDownRight className="h-4 w-4" /> {using === l.token ? "Saving…" : "Use in funnel"}
                </button>
              )}
              <button type="button" onClick={() => copy(l.token)} disabled={l.status !== "active"} className="btn-secondary text-xs px-3 py-2 disabled:opacity-40" aria-label="Copy link">
                {copied === l.token ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ---------------- sign-in / verify / set-password copy + paywall & emails ---------------- */
function AccessCopy() {
  const [cfg, setCfg] = useState<ContentConfig | null>(null);
  const [adminCfg, setAdminCfg] = useState<Partial<AdminConfig>>({});
  const [meta, setMeta] = useState<{ updatedAt: number | null; updatedBy: string | null } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    authed("/api/admin/content").then((r) => r.json()).then((d) => { if (d.ok) { setCfg(d.content); setMeta(d.meta ?? null); } });
    authed("/api/admin/config").then((r) => r.json()).then((d) => d.ok && setAdminCfg(d.config));
  }, []);

  const setText = (key: string, value: string) => { setCfg((c) => (c ? { ...c, text: { ...c.text, [key]: value } } : c)); setDirty(true); setNotice(null); };
  const setAdmin = (key: keyof AdminConfig, value: string) => { setAdminCfg((a) => ({ ...a, [key]: value })); setDirty(true); setNotice(null); };

  async function save() {
    if (!cfg) return;
    setBusy(true); setNotice(null);
    const text: Record<string, string> = {};
    for (const k of KEYS) text[k] = cfg.text[k] ?? "";
    try {
      const [rc, ra] = await Promise.all([postJson("/api/admin/content", { content: { text } }), postJson("/api/admin/config", adminCfg)]);
      const dc = await rc.json();
      if (rc.ok && ra.ok) { setCfg(dc.content); setMeta(dc.meta ?? null); setDirty(false); setNotice({ kind: "ok", text: "Saved — live now." }); }
      else setNotice({ kind: "err", text: "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(false); }
  }

  if (!cfg) return <Loading>Loading access copy…</Loading>;

  return (
    <div className="space-y-6">
      {FIELDS_BY_GROUP.map((g) => (
        <Section key={g.group} title={g.group}>
          <TextFields fields={g.fields} text={cfg.text} onChange={setText} idPrefix="acc" />
        </Section>
      ))}
      <Section title="Paywall & transactional emails" help="Copy for the expired-access paywall and the password / verification emails.">
        <div className="grid sm:grid-cols-2 gap-4">
          {CONFIG_FIELDS.map((f) => (
            <Field key={f.key} id={`cfg-${f.key}`} label={f.label} textarea={f.textarea} className={f.textarea ? "sm:col-span-2" : ""}
              value={(adminCfg[f.key] as string) ?? ""} onChange={(v) => setAdmin(f.key, v)} />
          ))}
        </div>
      </Section>
      <SaveBar onSave={save} busy={busy} dirty={dirty} notice={notice} label="Save access copy"
        audit={<AuditLine updatedAt={meta?.updatedAt} updatedBy={meta?.updatedBy} />} />
    </div>
  );
}
