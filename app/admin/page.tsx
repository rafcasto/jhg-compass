"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings, Copy, Check, Link as LinkIcon, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase/client";
import type { AdminConfig, Activity, ContentConfig } from "@/lib/types";
import { DEFAULT_CONTENT, TEXT_FIELDS, newActivityId } from "@/lib/content";

const TABS = ["Dashboard", "Registration links", "Content", "Event tracking"] as const;
type Tab = (typeof TABS)[number];

// Paywall / email / coaching copy (stored separately in config/admin) — now edited
// inside the Content tab alongside all other static text.
const CONFIG_FIELDS: { key: keyof AdminConfig; label: string; textarea?: boolean }[] = [
  { key: "paywallTitle", label: "Paywall — title" },
  { key: "paywallBody", label: "Paywall — body", textarea: true },
  { key: "paywallCtaLabel", label: "Paywall — CTA label" },
  { key: "paywallCtaUrl", label: "Paywall — CTA URL" },
  { key: "pwResetSubject", label: "Password email — subject" },
  { key: "pwResetBody", label: "Password email — body", textarea: true },
  { key: "emailVerifySubject", label: "Email verification — subject" },
  { key: "emailVerifyBody", label: "Email verification — body", textarea: true },
  { key: "coachingTitle", label: "Coaching — title" },
  { key: "coachingBody", label: "Coaching — body", textarea: true },
  { key: "coachingCtaLabel", label: "Coaching — CTA label" },
  { key: "coachingCtaUrl", label: "Coaching — CTA URL" },
];

async function token() { return auth.currentUser!.getIdToken(); }
async function authedFetch(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${await token()}` } });
}

export default function AdminPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("Dashboard");

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
    <div className="min-h-screen bg-jh-paper">
      {/* dark header */}
      <header className="bg-jh-ink text-white">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold text-lg"><Settings className="h-5 w-5" /> Compass Admin</div>
          <div className="flex items-center gap-5 text-sm">
            <span className="text-white/70 hidden sm:inline">{user?.email}</span>
            <Link href="/compass" className="inline-flex items-center gap-1 underline underline-offset-2">View site <ExternalLink className="h-3.5 w-3.5" /></Link>
            <button onClick={() => signOut()} className="font-semibold">Sign out</button>
          </div>
        </div>
      </header>

      {/* tabs */}
      <div className="bg-jh-paper border-b border-jh-line">
        <nav className="mx-auto max-w-6xl px-5 flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 text-sm font-display font-semibold whitespace-nowrap border-b-2 -mb-px transition ${tab === t ? "border-jh-red text-jh-red" : "border-transparent text-jh-mute hover:text-jh-ink"}`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {tab === "Dashboard" && <DashboardTab />}
        {tab === "Registration links" && <RegistrationLinks />}
        {tab === "Content" && <ContentTab />}
        {tab === "Event tracking" && <EventTracking />}
      </main>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function DashboardTab() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { authedFetch("/api/admin/stats").then((r) => r.json()).then((d) => d.ok && setS(d)); }, []);
  if (!s) return <p className="text-jh-mute animate-pulse">Loading stats…</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={s.users} label="Users" />
        <StatCard value={s.eventsTotal} label="Events tracked" />
        <StatCard value={s.activeGrants} label="Active access" />
        <StatCard value={s.activeLinks} label="Active invite links" />
      </div>

      <div>
        <h2 className="text-xl mb-3">Recent activity</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-jh-mute border-b border-jh-line">
                {["Name", "Email", "Stage", "Event tag", "Source", "Score", "Date"].map((h) => <th key={h} className="font-semibold px-4 py-3 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(s.recent ?? []).map((r: any, i: number) => (
                <tr key={i} className="border-b border-jh-line last:border-0">
                  <td className="px-4 py-3">{r.first_name ?? "—"}</td>
                  <td className="px-4 py-3 text-jh-mute">{r.email}</td>
                  <td className="px-4 py-3"><span className="pill bg-jh-mist text-jh-ink capitalize">{r.stage}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-jh-ink">{r.tag}</td>
                  <td className="px-4 py-3 text-jh-mute">{r.source}</td>
                  <td className="px-4 py-3 font-semibold">{r.score}</td>
                  <td className="px-4 py-3 text-jh-mute whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</td>
                </tr>
              ))}
              {(!s.recent || s.recent.length === 0) && <tr><td colSpan={7} className="px-4 py-8 text-center text-jh-mute">No events yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="card p-5">
      <div className="font-display font-extrabold text-3xl text-jh-ink">{value ?? 0}</div>
      <div className="text-sm text-jh-mute mt-1">{label}</div>
    </div>
  );
}

/* ---------------- Content (static text + activities + paywall/email copy) ---------------- */
function ContentTab() {
  const [cfg, setCfg] = useState<ContentConfig | null>(null);
  const [adminCfg, setAdminCfg] = useState<Partial<AdminConfig>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authedFetch("/api/admin/content").then((r) => r.json()).then((d) => d.ok && setCfg(d.content));
    authedFetch("/api/admin/config").then((r) => r.json()).then((d) => d.ok && setAdminCfg(d.config));
  }, []);

  function patch(p: Partial<ContentConfig>) { setCfg((c) => ({ ...(c as ContentConfig), ...p })); setSaved(false); }
  function setText(key: string, value: string) {
    setCfg((c) => ({ ...(c as ContentConfig), text: { ...(c as ContentConfig).text, [key]: value } }));
    setSaved(false);
  }
  function setAdmin(key: keyof AdminConfig, value: string) { setAdminCfg((a) => ({ ...a, [key]: value })); setSaved(false); }
  function setEffort(market: "hidden" | "visible", value: number) {
    patch({ effortSplit: { ...(cfg as ContentConfig).effortSplit, [market]: value } });
  }

  function updateActivity(id: string, p: Partial<Activity>) {
    patch({ activities: (cfg as ContentConfig).activities.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  }
  function removeActivity(id: string) {
    patch({ activities: (cfg as ContentConfig).activities.filter((a) => a.id !== id) });
  }
  function addActivity(market: "hidden" | "visible") {
    const a: Activity = { id: newActivityId(""), market, emoji: "•", label: "New activity", defaultWeekly: 1 };
    patch({ activities: [...(cfg as ContentConfig).activities, a] });
  }

  async function save() {
    if (!cfg) return;
    setBusy(true); setSaved(false);
    const [rContent, rConfig] = await Promise.all([
      authedFetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: cfg }) }),
      authedFetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adminCfg) }),
    ]);
    if (rContent.ok) setCfg((await rContent.json()).content);
    if (rConfig.ok) setAdminCfg((await rConfig.json()).config);
    if (rContent.ok && rConfig.ok) setSaved(true);
    setBusy(false);
  }
  function resetDefaults() {
    if (confirm("Reset the text & activity lists to the built-in defaults? (Paywall/email copy is left as-is.) Applied when you Save.")) {
      setCfg(structuredClone(DEFAULT_CONTENT)); setSaved(false);
    }
  }

  if (!cfg) return <p className="text-jh-mute animate-pulse">Loading content…</p>;

  const hidden = cfg.activities.filter((a) => a.market === "hidden");
  const visible = cfg.activities.filter((a) => a.market === "visible");

  // Group text fields preserving catalogue order.
  const groups: { name: string; fields: typeof TEXT_FIELDS }[] = [];
  for (const f of TEXT_FIELDS) {
    let g = groups.find((x) => x.name === f.group);
    if (!g) { g = { name: f.group, fields: [] }; groups.push(g); }
    g.fields.push(f);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl">App content</h2>
          <p className="text-jh-mute text-sm mt-1">Edit every static label, the job-market activity lists, and the paywall / email / coaching copy. Changes go live across the app and onboarding the moment you save.</p>
        </div>
        <button onClick={resetDefaults} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap">Reset to defaults</button>
      </div>

      {/* ---- Activities ---- */}
      <section className="space-y-4">
        <div>
          <h3 className="font-display font-bold text-jh-ink">Job-market activities</h3>
          <p className="text-jh-mute text-sm">Add or remove the activities shown on Performance and in onboarding. “Default / wk” is the suggested weekly target until a user changes it.</p>
        </div>

        <div className="card p-4 grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="label">Hidden — % of success</label>
            <input type="number" min={0} max={100} className="field" value={cfg.effortSplit.hidden}
              onChange={(e) => setEffort("hidden", +e.target.value)} />
          </div>
          <div>
            <label className="label">Visible — % of success</label>
            <input type="number" min={0} max={100} className="field" value={cfg.effortSplit.visible}
              onChange={(e) => setEffort("visible", +e.target.value)} />
          </div>
        </div>

        <ActivityList title="👀 Hidden Job Market" items={hidden} market="hidden"
          onChange={updateActivity} onRemove={removeActivity} onAdd={() => addActivity("hidden")} />
        <ActivityList title="✅ Visible Job Market" items={visible} market="visible"
          onChange={updateActivity} onRemove={removeActivity} onAdd={() => addActivity("visible")} />
      </section>

      {/* ---- Static text ---- */}
      <section className="space-y-5">
        <h3 className="font-display font-bold text-jh-ink">Static text</h3>
        {groups.map((g) => (
          <div key={g.name} className="card p-5 space-y-4">
            <p className="font-display font-semibold text-jh-ink">{g.name}</p>
            {g.fields.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {f.textarea
                  ? <textarea className="field min-h-20" value={cfg.text[f.key] ?? ""} onChange={(e) => setText(f.key, e.target.value)} />
                  : <input className="field" value={cfg.text[f.key] ?? ""} onChange={(e) => setText(f.key, e.target.value)} />}
                {f.help && <p className="text-[11px] text-jh-mute mt-1">{f.help}</p>}
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* ---- Paywall, email & coaching copy ---- */}
      <section className="space-y-5">
        <div>
          <h3 className="font-display font-bold text-jh-ink">Paywall, email &amp; coaching</h3>
          <p className="text-jh-mute text-sm">Copy for the expired-access paywall, transactional emails, and the coaching upsell modal.</p>
        </div>
        <div className="card p-5 space-y-4">
          {CONFIG_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              {f.textarea
                ? <textarea className="field min-h-24" value={(adminCfg[f.key] as string) ?? ""} onChange={(e) => setAdmin(f.key, e.target.value)} />
                : <input className="field" value={(adminCfg[f.key] as string) ?? ""} onChange={(e) => setAdmin(f.key, e.target.value)} />}
            </div>
          ))}
        </div>
      </section>

      {/* sticky save */}
      <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-jh-paper/90 backdrop-blur border-t border-jh-line flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save content"}</button>
        {saved && <span className="text-sm text-rb-green-dark">Saved ✓ — live now</span>}
      </div>
    </div>
  );
}

function ActivityList({ title, items, market, onChange, onRemove, onAdd }: {
  title: string;
  items: Activity[];
  market: "hidden" | "visible";
  onChange: (id: string, p: Partial<Activity>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-jh-line font-display font-semibold text-jh-ink text-sm">{title}</div>
      <div className="divide-y divide-jh-line">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-2 px-3 py-2.5">
            <input value={a.emoji} onChange={(e) => onChange(a.id, { emoji: e.target.value })}
              className="field py-2 text-center w-12 shrink-0" aria-label="Emoji" />
            <input value={a.label} onChange={(e) => onChange(a.id, { label: e.target.value })}
              className="field py-2 flex-1 text-sm" placeholder="Activity label" />
            <div className="shrink-0 w-24">
              <input type="number" min={0} value={a.defaultWeekly}
                onChange={(e) => onChange(a.id, { defaultWeekly: Math.max(0, +e.target.value) })}
                className="field py-2 text-sm" aria-label="Default weekly target" title="Default weekly target" />
            </div>
            <button onClick={() => onRemove(a.id)} className="shrink-0 grid place-items-center h-9 w-9 rounded-[10px] text-jh-mute hover:text-jh-red hover:bg-jh-red-soft" aria-label="Remove activity">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="px-4 py-6 text-center text-jh-mute text-sm">No activities yet.</div>}
      </div>
      <div className="px-3 py-3 border-t border-jh-line">
        <button onClick={onAdd} className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add activity
        </button>
      </div>
    </div>
  );
}

/* ---------------- Event tracking ---------------- */
function EventTracking() {
  const [cfg, setCfg] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { authedFetch("/api/admin/events").then((r) => r.json()).then((d) => d.ok && setCfg(d.config)); }, []);

  function update(key: string, patch: any) { setCfg((c) => ({ ...c!, [key]: { ...c![key], ...patch } })); setSaved(false); }

  async function save() {
    setBusy(true); setSaved(false);
    const r = await authedFetch("/api/admin/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: cfg }) });
    if (r.ok) { setCfg((await r.json()).config); setSaved(true); }
    setBusy(false);
  }

  if (!cfg) return <p className="text-jh-mute animate-pulse">Loading events…</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl">Event tracking</h2>
        <p className="text-jh-mute text-sm mt-1">Switch which events are sent to Supabase and rename their tags. Disabled events are skipped entirely.</p>
      </div>
      <div className="card divide-y divide-jh-line">
        {Object.entries(cfg).map(([key, e]: [string, any]) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
            <div className="sm:w-44 shrink-0">
              <p className="font-display font-semibold text-jh-ink text-sm">{e.label}</p>
              <p className="text-[11px] text-jh-mute-2 font-mono">{key}</p>
            </div>
            <input value={e.tag} onChange={(ev) => update(key, { tag: ev.target.value })}
              className="field py-2 text-xs font-mono flex-1" />
            <select value={e.stage} onChange={(ev) => update(key, { stage: ev.target.value })} className="field py-2 w-auto text-sm">
              <option value="acquisition">acquisition</option>
              <option value="activation">activation</option>
              <option value="retention">retention</option>
            </select>
            <Toggle on={e.enabled} onChange={(v) => update(key, { enabled: v })} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saving…" : "Save event settings"}</button>
        {saved && <span className="text-sm text-rb-green-dark">Saved ✓</span>}
      </div>
    </div>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-pill transition shrink-0 ${on ? "bg-rb-green-dark" : "bg-jh-line-2"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/* ---------------- Registration links ---------------- */
function RegistrationLinks() {
  const [expiryHours, setExpiryHours] = useState(48);
  const [accessDurationDays, setAccessDurationDays] = useState(90);
  const [maxUses, setMaxUses] = useState(1);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const res = await authedFetch("/api/admin/registration-link");
    if (res.ok) setLinks((await res.json()).links ?? []);
  }
  useEffect(() => { load(); }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const res = await authedFetch("/api/admin/registration-link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiryHours, accessDurationDays, maxUses, email: email || null }),
    });
    if (res.ok) { setEmail(""); await load(); }
    setBusy(false);
  }
  const urlFor = (t: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/register/${t}`;
  async function copy(t: string) { await navigator.clipboard.writeText(urlFor(t)); setCopied(t); setTimeout(() => setCopied(null), 1500); }
  const fmt = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2"><LinkIcon className="h-5 w-5 text-jh-red" /><h2 className="text-xl">Registration links</h2></div>
      <p className="text-sm text-jh-mute">Generate a temporary signup link that grants timed access.</p>
      <form onSubmit={generate} className="card p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div><label className="label">Link valid (hours)</label><input type="number" min={1} className="field" value={expiryHours} onChange={(e) => setExpiryHours(+e.target.value)} /></div>
        <div><label className="label">Access (days)</label><input type="number" min={1} className="field" value={accessDurationDays} onChange={(e) => setAccessDurationDays(+e.target.value)} /></div>
        <div><label className="label">Max uses</label><input type="number" min={1} className="field" value={maxUses} onChange={(e) => setMaxUses(+e.target.value)} /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label">Lock to email</label><input className="field" placeholder="anyone" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="col-span-2 sm:col-span-4"><button disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Generating…" : "Generate link"}</button></div>
      </form>
      {links.length > 0 && (
        <ul className="card divide-y divide-jh-line">
          {links.map((l) => (
            <li key={l.token} className="py-3 px-4 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono text-jh-ink truncate">/register/{l.token.slice(0, 12)}…</p>
                <p className="text-xs text-jh-mute">{l.accessDurationDays}d access · {l.uses}/{l.maxUses} used · {l.email ? `${l.email} · ` : ""}
                  <span className={l.status === "active" ? "text-rb-green-dark" : "text-jh-mute"}>{l.status === "active" ? `valid till ${fmt(l.expiresAt)}` : l.status}</span></p>
              </div>
              <button onClick={() => copy(l.token)} disabled={l.status !== "active"} className="btn-secondary text-xs px-3 py-2 disabled:opacity-40">
                {copied === l.token ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
