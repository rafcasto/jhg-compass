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
  const { coachEnabled, loading: accessLoading } = useAccess(uid);
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const [over, setOver] = useState(false);
  const withCoach = coachEnabled || isAdmin;

  if (!uid || accessLoading) return <div className="space-y-6"><PageHeader eyebrow="JobHacking" title="Settings" intro="" /><p className="text-jh-mute animate-pulse">Loading…</p></div>;

  if (withCoach) return <CoachSettings uid={uid} setup={setup} profile={profile} />;

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

function CoachSettings({ uid, setup, profile }: { uid: string; setup: CareerOpsSetupV2 | null; profile: Profile | null }) {
  const states = useMemo(() => coachStates(setup?.jhg?.progress), [setup?.jhg?.progress]);
  const current = useMemo(() => profileFromSetup({ profile, setup }), [profile, setup]);
  const started = COACHES.filter((c) => states[c.key] !== "not_started");
  const [over, setOver] = useState<CoachKey | "">(started[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const chosen = COACHES.find((c) => c.key === over) ?? started[0];

  const startOver = async () => {
    if (!chosen) return;
    if (!window.confirm(`Start ${chosen.label} over? The conversation is cleared. Everything on the ${chosen.label} page stays.`)) return;
    setBusy(true); setNotice(null);
    try {
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch(`/api/coach/turn?coach=${chosen.key}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      setNotice({ kind: "ok", text: `${chosen.label} starts fresh next time you open your coach there.` });
    } catch {
      setNotice({ kind: "err", text: "Couldn't clear that conversation — try again." });
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
        <CoachRail states={states} portal="jobhacking" hasCv={!!setup?.cvMarkdown?.trim()} />

        <div className="md:hidden">
          <button type="button" onClick={() => downloadText(PROFILE_FILENAME, profileToYaml(current))} className="btn-secondary w-full"><Download className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Export profile.yml</button>
        </div>

        <section aria-labelledby="jh-settings-danger" className="space-y-3">
          <h2 id="jh-settings-danger" className="section-label">Danger</h2>
          {started.length === 0 ? (
            <p className="text-sm text-jh-mute">Nothing to start over yet — no coach has begun.</p>
          ) : (
            <div className="card p-4 space-y-3">
              <p className="text-sm text-jh-mute">Clears one conversation so that coach starts from the page as it stands. Your profile is never touched.</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-48 flex-1">
                  <span className="label">Coach</span>
                  <select className="field text-sm" value={chosen?.key ?? ""} onChange={(e) => setOver(e.target.value as CoachKey)} aria-label="Coach to start over">
                    {started.map((c) => <option key={c.key} value={c.key}>{c.n} · {c.label}</option>)}
                  </select>
                </label>
                <button type="button" onClick={startOver} disabled={busy || !chosen} className="btn-ghost disabled:opacity-60">{busy ? "Clearing…" : "Start a coach over"}</button>
              </div>
              {notice && <p role="status" className={`text-sm ${notice.kind === "ok" ? "text-jh-ink" : "text-jh-red"}`}>{notice.text}</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
