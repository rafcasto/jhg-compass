"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Search, RefreshCw, Bot } from "lucide-react";
import { authed, postJson, fmtDateTime, Empty, Loading, NumberField, Section, type Notice } from "@/components/admin/shared";
import {
  ACCESS_FILTERS, DEFAULT_RENEWAL_DAYS, countByStatus, filterRows, memberName,
  type AccessFilter, type MemberAccessRow,
} from "@/lib/access";
import type { GrantStatus } from "@/lib/types";

const STATUS_PILL: Record<GrantStatus, string> = {
  active:  "bg-rb-green-light/30 text-rb-green-dark",
  expired: "bg-jh-red-soft text-jh-red",
  pending: "bg-rb-yellow/30 text-jh-ink",
  revoked: "bg-jh-mist text-jh-mute",
};

// Admin → TOFU → Access renewals. Lists every member's grant (effective status —
// lapsed members show as expired even if they haven't logged in since), lets the
// admin tick one or many and grant a fresh period. Members still active are
// extended from their current end date.
export default function AccessRenewals() {
  const [rows, setRows] = useState<MemberAccessRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<AccessFilter>("expired");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(DEFAULT_RENEWAL_DAYS);
  const [busy, setBusy] = useState(false);
  const [featBusy, setFeatBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function load() {
    try {
      const d = await (await authed("/api/admin/access")).json();
      if (d.ok) { setRows(d.rows); setLoadError(false); } else setLoadError(true);
    } catch { setLoadError(true); }
  }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => filterRows(rows ?? [], filter, q), [rows, filter, q]);
  const counts = useMemo(() => countByStatus(rows ?? []), [rows]);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.uid));
  const selectedRows = (rows ?? []).filter((r) => selected.has(r.uid));

  function toggle(uid: string) {
    setSelected((s) => { const n = new Set(s); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  }
  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allVisibleSelected) visible.forEach((r) => n.delete(r.uid)); else visible.forEach((r) => n.add(r.uid));
      return n;
    });
  }

  async function grant() {
    if (!selectedRows.length) return;
    const who = selectedRows.length === 1 ? (memberName(selectedRows[0]) || selectedRows[0].email) : `${selectedRows.length} members`;
    if (!confirm(`Grant ${days} days of Compass access to ${who}?`)) return;
    setBusy(true); setNotice(null);
    try {
      const r = await postJson("/api/admin/access", { uids: selectedRows.map((x) => x.uid), durationDays: days });
      const d = await r.json();
      if (r.ok && d.ok) {
        setRows(d.rows);
        setSelected(new Set());
        const n = d.renewed.length;
        const until = n === 1 ? ` — access until ${fmtDateTime(d.renewed[0].expiresAt)}` : "";
        setNotice({ kind: "ok", text: `Access granted to ${n} member${n === 1 ? "" : "s"}${until}.${d.missing?.length ? ` ${d.missing.length} had no grant and were skipped.` : ""}` });
      } else setNotice({ kind: "err", text: d.error ? `Couldn't grant access: ${d.error}` : "Couldn't grant access." });
    } catch { setNotice({ kind: "err", text: "Couldn't grant access." }); }
    finally { setBusy(false); }
  }

  // CareerOps portal (career-ops agents on the Pi) — switch on/off for the selected members.
  async function setAgents(on: boolean) {
    if (!selectedRows.length) return;
    const who = selectedRows.length === 1 ? (memberName(selectedRows[0]) || selectedRows[0].email) : `${selectedRows.length} members`;
    if (!confirm(`${on ? "Enable" : "Disable"} the CareerOps portal for ${who}?`)) return;
    setFeatBusy(true); setNotice(null);
    try {
      const r = await postJson("/api/admin/access/features", { uids: selectedRows.map((x) => x.uid), careerOps: on });
      const d = await r.json();
      if (r.ok && d.ok) {
        setRows(d.rows); setSelected(new Set());
        setNotice({ kind: "ok", text: `CareerOps ${on ? "enabled" : "disabled"} for ${d.updated.length} member${d.updated.length === 1 ? "" : "s"}. They'll see the change on their next page load.` });
      } else setNotice({ kind: "err", text: d.error ? `Couldn't update CareerOps access: ${d.error}` : "Couldn't update CareerOps access." });
    } catch { setNotice({ kind: "err", text: "Couldn't update CareerOps access." }); }
    finally { setFeatBusy(false); }
  }

  const period = (r: MemberAccessRow) => {
    if (r.status === "pending") return r.redeemBy ? `Redeem by ${fmtDateTime(r.redeemBy)}` : "Awaiting redemption";
    if (r.startsAt && r.expiresAt) return `${fmtDateTime(r.startsAt)} → ${fmtDateTime(r.expiresAt)}`;
    if (r.expiresAt) return `Until ${fmtDateTime(r.expiresAt)}`;
    return "—";
  };

  return (
    <div className="space-y-6">
      <Section title="Grant access" help="Tick the members below, choose how many days, and grant. Expired, pending and revoked members start a fresh period from now; members who are still active are extended from their current end date. They'll see the change on their next page load — no email is sent."
        aside={<button type="button" onClick={load} className="btn-secondary text-xs px-3 py-2" aria-label="Refresh list"><RefreshCw className="h-4 w-4" /></button>}>
        <div className="flex flex-wrap items-end gap-3">
          <NumberField id="renew-days" label="Access (days)" min={1} max={3650} value={days} onChange={setDays} className="w-36" />
          <button type="button" onClick={grant} disabled={busy || selectedRows.length === 0}
            className="btn-primary h-[46px] disabled:opacity-60">
            <KeyRound className="h-4 w-4" />
            {busy ? "Granting…" : selectedRows.length === 0 ? "Select members below" : `Grant ${days} days to ${selectedRows.length} member${selectedRows.length === 1 ? "" : "s"}`}
          </button>
          {selectedRows.length > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="btn-ghost text-sm">Clear selection</button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-jh-line">
          <span className="inline-flex items-center gap-1.5 text-sm text-jh-mute"><Bot className="h-4 w-4" /> CareerOps portal (switch via the logo)</span>
          <button type="button" onClick={() => setAgents(true)} disabled={featBusy || selectedRows.length === 0} className="btn-secondary text-xs px-3 py-2 disabled:opacity-40">
            {featBusy ? "Saving…" : `Enable for ${selectedRows.length || "selected"}`}
          </button>
          <button type="button" onClick={() => setAgents(false)} disabled={featBusy || selectedRows.length === 0} className="btn-ghost text-xs disabled:opacity-40">Disable</button>
        </div>
        {notice && (
          <p role="status" className={`text-sm ${notice.kind === "ok" ? "text-rb-green-dark" : "text-jh-red"}`}>{notice.text}</p>
        )}
      </Section>

      <Section title="Members" help="Every member with an access grant. Status is what's true right now, even if the member hasn't signed in since it lapsed.">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Access status filter" className="inline-flex flex-wrap gap-1 rounded-pill bg-jh-mist p-1">
            {ACCESS_FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <button key={f.key} type="button" role="tab" aria-selected={active} onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-pill text-sm font-display font-semibold transition-colors ${active ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute hover:text-jh-ink"}`}>
                  {f.label} <span className="ml-1 text-xs tabular-nums opacity-70">{counts[f.key]}</span>
                </button>
              );
            })}
          </div>
          <label className="relative flex-1 min-w-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-jh-mute-2" />
            <input aria-label="Search members" className="field py-2 pl-9 text-sm" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>

        {loadError ? <p className="text-jh-red">Couldn&apos;t load members.</p>
        : rows === null ? <Loading>Loading members…</Loading>
        : visible.length === 0 ? <Empty>{rows.length === 0 ? "No access grants yet." : "No members match."}</Empty>
        : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-jh-mute border-b border-jh-line">
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" aria-label="Select all shown" checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 accent-jh-red" />
                  </th>
                  {["Member", "Status", "CareerOps", "Access period", "Plan · source", "Last change"].map((h) => (
                    <th key={h} className="font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const name = memberName(r);
                  const checked = selected.has(r.uid);
                  return (
                    <tr key={r.uid} onClick={() => toggle(r.uid)}
                      className={`border-b border-jh-line last:border-0 cursor-pointer ${checked ? "bg-jh-red-soft/30" : "hover:bg-jh-mist/50"}`}>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${name || r.email}`} checked={checked} onChange={() => toggle(r.uid)} className="h-4 w-4 accent-jh-red" />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-jh-ink">{name || "—"}</p>
                        <p className="text-xs text-jh-mute">{r.email}</p>
                      </td>
                      <td className="px-3 py-2.5"><span className={`pill capitalize ${STATUS_PILL[r.status]}`}>{r.status}</span></td>
                      <td className="px-3 py-2.5">{r.careerOps ? <span className="pill bg-rb-green-light/30 text-rb-green-dark">on</span> : <span className="text-xs text-jh-mute-2">off</span>}</td>
                      <td className="px-3 py-2.5 text-jh-mute whitespace-nowrap">{period(r)}</td>
                      <td className="px-3 py-2.5 text-jh-mute whitespace-nowrap">{[r.plan, r.source].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 py-2.5 text-jh-mute whitespace-nowrap">
                        {r.renewedAt ? <>Renewed {fmtDateTime(r.renewedAt)}{r.renewedBy ? <span className="block text-xs text-jh-mute-2">by {r.renewedBy}</span> : null}</>
                          : r.updatedAt ? fmtDateTime(r.updatedAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
