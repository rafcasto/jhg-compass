"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import PageHeader from "@/components/shell/PageHeader";
import CoachRail from "@/components/coach/CoachRail";
import ProfileFilesPanel, { downloadText, type Dropped } from "@/components/jobhacking/ProfileFilesPanel";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { useAccess } from "@/lib/firestore/access";
import { auth } from "@/lib/firebase/client";
import { PROFILE_FILENAME, profileFromSetup, profileToYaml } from "@/lib/careerops/profile-file";
import { RESET_CLEARS } from "@/lib/engine/coach/reset-data";
import { COACHES, coachStates, type CoachKey } from "@/lib/engine/coach/keys";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// JobHacking · Settings — docs/UX_JOBHACKING.md §4 and, for a member with the coach,
// docs/UX_COACH.md §5 / docs/UX_COACH_AGENTIC.md §5 (decision 2026-11-16, phase A).
//
// With the coach (features.coach, or an admin): the rail of six under the two menu
// headings, *Export profile.yml*, and under *Danger* a *Start a coach over* that clears
// that conversation and never the profile. The six upload slots do not render.
//
// Without it: the Packer writes the profile as six files, one per page of this portal,
// so Settings is the six slots (ProfileFilesPanel, shared with the Compass Settings hub).
// A file dropped anywhere on the page lands in the slot its stamp names.

export default function JobHackingSettings() {
  const { user, isAdmin } = useAuth();
  const uid = user?.uid;
  const { coachEnabled, agentsEnabled, loading: accessLoading } = useAccess(uid);
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const [over, setOver] = useState(false);
  const withCoach = coachEnabled || isAdmin;

  if (!uid || accessLoading) return <div className="space-y-6"><PageHeader eyebrow="JobHacking" title="Settings" intro="" /><p className="text-jh-mute animate-pulse">Loading…</p></div>;

  if (withCoach) return <CoachSettings uid={uid} setup={setup} profile={profile} jobSearch={agentsEnabled || isAdmin} />;

  return (
    <div
      className="space-y-6"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files?.length) return; e.preventDefault(); setOver(false); setDropped({ files: Array.from(e.dataTransfer.files), at: Date.now() }); }}
    >
      <PageHeader eyebrow="JobHacking" title="Settings" intro="Your coach's Packer writes your profile as six files — one for each page of this portal. Upload each one as it's ready, or all six at once. What a file carries replaces what's here, field by field; anything it doesn't mention is left as it is." />
      <div className="max-w-3xl space-y-6">
        <ProfileFilesPanel uid={uid} setup={setup} profile={profile} portal="jobhacking" dropped={dropped} over={over} />
      </div>
    </div>
  );
}

function CoachSettings({ uid, setup, profile, jobSearch }: {
  uid: string; setup: CareerOpsSetupV2 | null; profile: Profile | null;
  /** The member has the Job Search portal — only then may the rail say the search can start from the Master CV. */
  jobSearch: boolean;
}) {
  const states = useMemo(() => coachStates(setup?.jhg?.progress), [setup?.jhg?.progress]);
  const current = useMemo(() => profileFromSetup({ profile, setup }), [profile, setup]);
  const started = COACHES.filter((c) => states[c.key] !== "not_started");
  const [over, setOver] = useState<CoachKey | "">(started[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const chosen = COACHES.find((c) => c.key === over) ?? started[0];

  // Two resets (decision 2026-11-17): the conversation alone, or the conversation and what that coach wrote — its page sections
  // go back to empty (lib/engine/coach/reset-data.ts). Other coaches' sections never move.
  const startOver = async (data = false) => {
    if (!chosen) return;
    const ask = data
      ? `Start ${chosen.label} over and clear its data? The conversation goes, and so do ${RESET_CLEARS[chosen.key]}. Other pages are untouched. This cannot be undone.`
      : `Start ${chosen.label} over? The conversation is cleared. Everything on the ${chosen.label} page stays.`;
    if (!window.confirm(ask)) return;
    setBusy(true); setNotice(null);
    try {
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch(`/api/coach/turn?coach=${chosen.key}${data ? "&data=1" : ""}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      setNotice({ kind: "ok", text: data ? `${chosen.label} starts from nothing next time you open your coach there — its page is clear.` : `${chosen.label} starts fresh next time you open your coach there.` });
    } catch {
      setNotice({ kind: "err", text: data ? "Couldn't clear that coach — try again." : "Couldn't clear that conversation — try again." });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="JobHacking"
        title="Settings"
        intro="Your coach writes your profile. Six conversations, one for each page of this portal — open any row to pick up where you left off."
        actions={
          <div className="hidden md:flex items-center gap-2">
            <button type="button" onClick={() => downloadText(PROFILE_FILENAME, profileToYaml(current))} className="btn-secondary btn-sm"><Download className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Export profile.yml</button>
          </div>
        }
      />
      <div className="max-w-3xl space-y-8">
        <CoachRail states={states} portal="jobhacking" hasCv={!!setup?.cvMarkdown?.trim()} jobSearch={jobSearch} />

        <div className="md:hidden">
          <button type="button" onClick={() => downloadText(PROFILE_FILENAME, profileToYaml(current))} className="btn-secondary w-full"><Download className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Export profile.yml</button>
        </div>

        <section aria-labelledby="jh-settings-danger" className="space-y-3">
          <h2 id="jh-settings-danger" className="section-label">Danger</h2>
          {started.length === 0 ? (
            <p className="text-sm text-jh-mute">Nothing to start over yet — no coach has begun.</p>
          ) : (
            <div className="card p-4 space-y-3">
              <p className="text-sm text-jh-mute"><em>Start a coach over</em> clears one conversation so that coach starts from the page as it stands; your profile is never touched. <em>…and clear its data</em> also empties that coach&apos;s page sections — the other pages stay.</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-48 flex-1">
                  <span className="label">Coach</span>
                  <select className="field text-sm" value={chosen?.key ?? ""} onChange={(e) => setOver(e.target.value as CoachKey)} aria-label="Coach to start over">
                    {started.map((c) => <option key={c.key} value={c.key}>{c.n} · {c.label}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => void startOver(false)} disabled={busy || !chosen} className="btn-ghost disabled:opacity-60">{busy ? "Clearing…" : "Start a coach over"}</button>
                <button type="button" onClick={() => void startOver(true)} disabled={busy || !chosen} className="btn-ghost disabled:opacity-60">{busy ? "Clearing…" : "…and clear its data"}</button>
              </div>
              {notice && <p role="status" className={`text-sm ${notice.kind === "ok" ? "text-jh-ink" : "text-jh-red"}`}>{notice.text}</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
