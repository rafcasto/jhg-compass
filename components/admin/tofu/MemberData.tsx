"use client";

import { useEffect, useState } from "react";
import { Eraser, Trash2 } from "lucide-react";
import { authed, postJson, Section, type Notice } from "@/components/admin/shared";
import { memberName, type MemberAccessRow } from "@/lib/access";
import { fmtDateTime } from "@/components/admin/shared";
import { MEMBER_COLLECTIONS, actLine, summaryLine, unknownCollections, type MemberDataSummary, type ResetScope } from "@/lib/member-data";

// Admin → TOFU → Access renewals → Member data: with exactly one member ticked, what they have
// stored and three destructive acts — reset the coach (conversations, jobs, meter); reset to a
// new member (state zero: every collection goes and the account keeps only what registration
// wrote — email, name, createdAt — so onboarding shows again; the grant, its feature switches
// and the sign-in stay); delete the member (everything, the grant and the sign-in). Each
// confirms against the real counts; delete asks for the member's email typed out.
export default function MemberData({ member, onDeleted }: { member: MemberAccessRow; onDeleted: () => void }) {
  const [summary, setSummary] = useState<MemberDataSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<ResetScope | "delete" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const who = memberName(member) || member.email;

  async function load(uid: string) {
    setSummary(null); setLoadError(false);
    try {
      const d = await (await authed(`/api/admin/members/${uid}`)).json();
      if (d.ok) setSummary(d.summary); else setLoadError(true);
    } catch { setLoadError(true); }
  }
  useEffect(() => { setNotice(null); load(member.uid); }, [member.uid]);

  async function reset(scope: ResetScope) {
    if (!summary) return;
    const what = scope === "coach" ? "the coach's conversations, jobs and meter" : "them to a NEW member — state zero: profile, goal, onboarding, coach, tracker, agents output and share links all go; they see onboarding again";
    if (!confirm(`Reset ${what} for ${who}?\n\nRemoves: ${summaryLine(summary, scope)}.\n\nTheir access, its switches and their sign-in stay. This cannot be undone.`)) return;
    setBusy(scope); setNotice(null);
    try {
      const r = await postJson(`/api/admin/members/${member.uid}/reset`, { scope });
      const d = await r.json();
      if (d.summary) setSummary(d.summary);
      if (r.ok && d.ok) {
        const removed: string[] = d.result.removed ?? [];
        setNotice({ kind: "ok", text: `${scope === "coach" ? "Coach reset" : "Reset to a new member"} for ${who} — ${removed.length ? `removed ${removed.join(", ")}` : "no collection held anything"}${scope === "all" ? `; account ${d.result.accountReset ? "back to email, name and created date" : "document was already absent"}; ${d.result.shareLinks} share link${d.result.shareLinks === 1 ? "" : "s"} revoked. They start at onboarding next time they sign in.` : "."}` });
      } else setNotice({ kind: "err", text: d.error ? `Couldn't reset: ${d.error}` : "Couldn't reset." });
    } catch { setNotice({ kind: "err", text: "Couldn't reset." }); }
    finally { setBusy(null); }
  }

  async function remove() {
    if (!summary) return;
    const typed = prompt(`Delete ${who} entirely — ${summaryLine(summary)}, their access grant and their sign-in?\n\nType the member's email to confirm:`);
    if (typed === null) return;
    setBusy("delete"); setNotice(null);
    try {
      const r = await authed(`/api/admin/members/${member.uid}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: typed }) });
      const d = await r.json();
      if (r.ok && d.ok) { setNotice({ kind: "ok", text: `${who} deleted.` }); onDeleted(); }
      else setNotice({ kind: "err", text: d.error ? `Couldn't delete: ${d.error}` : "Couldn't delete." });
    } catch { setNotice({ kind: "err", text: "Couldn't delete." }); }
    finally { setBusy(null); }
  }

  const stored = summary ? MEMBER_COLLECTIONS.filter((c) => (summary.counts[c.key] ?? 0) > 0) : [];
  const extras = summary?.accountExtras ?? [];
  const present = summary?.present ?? [];
  const unknown = unknownCollections(present);

  return (
    <Section title={`Member data · ${who}`} help="Reset coach clears the six conversations and the meter. Reset to new member is state zero — everything they ever entered goes, the account keeps only what registration wrote (email, name), and they see onboarding again; their access, its switches and their sign-in stay. Delete removes the member entirely. Every act is written to the admin audit log.">
      {loadError ? <p className="text-jh-red">Couldn&apos;t load this member&apos;s data.</p>
      : !summary ? <p className="text-jh-mute animate-pulse">Counting…</p>
      : (
        <>
          <p className="text-sm text-jh-mute">
            Account document: {!summary.hasAccount ? "absent" : extras.length ? <>identity + <span className="text-jh-ink">{extras.join(", ")}</span></> : "identity only — a new member"}
            {" · "}uid <span className="font-mono text-xs">{summary.uid}</span>
            {summary.email && <>{" · "}<span className="font-mono text-xs">{summary.email}</span></>}
          </p>
          <p className="text-sm text-jh-mute">
            Subcollections under it: {present.length === 0 ? <span className="text-jh-ink">none — this uid holds no data at all</span> : <span className="font-mono text-xs text-jh-ink">{present.join(" · ")}</span>}
            {unknown.length > 0 && <>{" · "}<span className="text-jh-red">a reset does not know {unknown.join(", ")}</span></>}
          </p>
          {stored.length === 0 ? <p className="text-sm text-jh-mute">No subcollection holds anything.</p> : (
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 text-sm" aria-label="What this member has stored">
              {stored.map((c) => (
                <li key={c.key} className="flex items-baseline justify-between gap-3 border-b border-jh-line py-1.5">
                  <span className="text-jh-ink">{c.label}</span>
                  <span className="font-mono text-xs text-jh-mute">{summary.counts[c.key]}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-jh-line">
            <button type="button" onClick={() => reset("coach")} disabled={!!busy} className="btn-secondary text-xs px-3 py-2 disabled:opacity-40">
              <Eraser className="h-4 w-4" aria-hidden /> {busy === "coach" ? "Resetting…" : "Reset coach"}
            </button>
            <button type="button" onClick={() => reset("all")} disabled={!!busy} className="btn-secondary text-xs px-3 py-2 disabled:opacity-40">
              <Eraser className="h-4 w-4" aria-hidden /> {busy === "all" ? "Resetting…" : "Reset to new member"}
            </button>
            <button type="button" onClick={remove} disabled={!!busy} className="btn-ghost text-xs disabled:opacity-40">
              <Trash2 className="h-4 w-4" aria-hidden /> {busy === "delete" ? "Deleting…" : "Delete member"}
            </button>
          </div>
          {notice && <p role="status" className={`text-sm ${notice.kind === "ok" ? "text-rb-green-dark" : "text-jh-red"}`}>{notice.text}</p>}
          {summary.acts.length > 0 && (
            <div className="pt-3 border-t border-jh-line">
              <p className="section-label mb-1">History</p>
              <ul className="space-y-0.5 text-sm text-jh-mute" aria-label="Recent admin acts on this member">
                {summary.acts.map((a, i) => <li key={i}><span className="text-jh-ink">{actLine(a)}</span> · {fmtDateTime(a.at)} · {a.by}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
