"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Download, FileUp } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import PageHeader from "@/components/shell/PageHeader";
import ContactPolicy from "@/components/careerops/ContactPolicy";
import CvPanel from "@/components/careerops/CvPanel";
import NorthStarSource from "@/components/careerops/NorthStarSource";
import Personalization from "@/components/careerops/Personalization";
import WatchlistPanel from "@/components/careerops/WatchlistPanel";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { effectiveGoal } from "@/lib/careerops/intake";
import { PROFILE_FILENAME, profileFromSetup, profileToYaml } from "@/lib/careerops/profile-file";
import { ACTIVE_SECTIONS, DEFAULT_SECTION, findSection, parseSection, profileProgress, sectionSummaries, type ActiveSectionKey } from "@/lib/profile-sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import NotesPanel from "./NotesPanel";
import ProfileUploadSheet from "./ProfileUploadSheet";
import SectionList, { SECTION_ICONS, sectionHref } from "./SectionList";

// The Profile page — docs/UX_PROFILE.md.
//
// One list of sections (the registry in lib/profile-sections.ts), two
// densities: a sticky rail beside the content on desktop, the overview page
// itself on mobile with drill-in. The active section lives in ?section=;
// absent means the overview on mobile and the first section on desktop.
//
// Not gated on CareerOps: the setup document is read directly, not through
// useCareerOps(), whose `allowed` check belongs to the portal.

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup, loading: setupLoading } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const params = useSearchParams();
  const active = parseSection(params.get("section"));

  const [sheet, setSheet] = useState<{ open: boolean; file: File | null }>({ open: false, file: null });
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<{ text: string; keys: ActiveSectionKey[] } | null>(null);
  // Bumped after an unpack so the mounted panel re-reads its initial state.
  const [stamp, setStamp] = useState(0);

  const rows = useMemo(() => sectionSummaries({ setup, profile }), [setup, profile]);
  const progress = profileProgress(rows);
  const current = useMemo(() => profileFromSetup({ profile, setup }), [profile, setup]);
  const goal = useMemo(
    () => effectiveGoal({ source: setup?.goalSource, compassGoal: profile?.goal, intakeGoal: setup?.intakeGoal }),
    [setup?.goalSource, setup?.intakeGoal, profile?.goal],
  );

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const email = profile?.email ?? user?.email ?? "";
  const initials = (fullName || email || "?").split(/[\s@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

  const exportProfile = () => download(PROFILE_FILENAME, profileToYaml(current));
  const shown: ActiveSectionKey = active ?? DEFAULT_SECTION;
  const meta = findSection(shown)!;
  const Icon = SECTION_ICONS[shown];

  const actions = (
    <>
      <button type="button" onClick={exportProfile} className="btn-secondary btn-sm"><Download className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Export</button>
      <button type="button" onClick={() => setSheet({ open: true, file: null })} className={`btn-secondary btn-sm ${over ? "border-jh-red text-jh-red" : ""}`}>
        <FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Upload profile
      </button>
    </>
  );

  const identity = (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-jh-red-soft font-display font-bold text-sm text-jh-red" aria-hidden>{initials}</div>
      <div className="min-w-0">
        <p className="truncate font-display font-semibold text-jh-ink">{fullName || "Your profile"}</p>
        <p className="truncate text-sm text-jh-mute">{[email, profile?.country].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );

  const progressBar = (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-jh-mute">{progress.done} of {progress.total} sections</span>
        <span className="font-mono text-xs text-jh-mute" aria-hidden>{progress.pct}%</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-pill bg-jh-mist" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total} aria-label="Profile sections filled in">
        <div className="h-full rounded-pill bg-jh-ink transition-[width]" style={{ width: `${progress.pct}%` }} />
      </div>
    </div>
  );

  const panel = uid && !setupLoading ? (
    <div key={`${shown}-${stamp}`}>
      {shown === "northstar" && <NorthStarSource uid={uid} setup={setup} profile={profile} />}
      {shown === "contact" && <ContactPolicy uid={uid} setup={setup} profile={profile} />}
      {shown === "targeting" && <Personalization uid={uid} setup={setup} profile={profile} />}
      {shown === "watchlist" && <WatchlistPanel uid={uid} setup={setup} goalRole={goal.goal.role} />}
      {shown === "notes" && <NotesPanel uid={uid} setup={setup} profile={profile} />}
      {shown === "cv" && <CvPanel uid={uid} setup={setup} profile={profile} goalRole={goal.goal.role} />}
    </div>
  ) : <p className="text-jh-mute animate-pulse">Loading…</p>;

  return (
    <div
      className="space-y-6"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files?.length) return; e.preventDefault(); setOver(false); setSheet({ open: true, file: e.dataTransfer.files[0] }); }}
    >
      <PageHeader
        eyebrow="Account"
        title="Profile"
        intro="Everything the agents know about you, in one place. Upload a profile.yml, or edit any section here."
        actions={<div className="hidden md:flex items-center gap-2">{actions}</div>}
      />

      {status && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-jh-line bg-jh-mist/40 px-4 py-3 text-sm text-jh-ink">
          <Check className="h-4 w-4 shrink-0 text-rb-green-dark" aria-hidden /> {status.text}
          {status.keys.map((k) => (
            <Link key={k} href={sectionHref(k)} className="link text-sm">{findSection(k)?.label}</Link>
          ))}
        </p>
      )}

      <div className="md:grid md:grid-cols-[232px_minmax(0,1fr)] md:items-start md:gap-8">
        {/* ---- Desktop rail ---- */}
        <aside className="hidden md:block md:sticky md:top-11 space-y-5">
          {identity}
          <SectionList rows={rows} active={shown} variant="rail" />
          <div className="border-t border-jh-line pt-4">{progressBar}</div>
        </aside>

        <div className="min-w-0">
          {/* ---- Mobile overview ---- */}
          <div className={active ? "hidden" : "md:hidden space-y-6"}>
            <section className="card p-4">{identity}</section>
            <div className="grid grid-cols-2 gap-2 [&>button]:w-full">{actions}</div>
            {progressBar}
            <SectionList rows={rows} variant="rows" />
          </div>

          {/* ---- Section ---- */}
          <section className={`space-y-4 ${active ? "" : "hidden md:block"}`} aria-labelledby="profile-section-title">
            <Link href="/profile" className="md:hidden -ml-2 inline-flex min-h-[44px] items-center gap-1 px-2 font-display font-semibold text-sm text-jh-mute hover:text-jh-ink">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Profile
            </Link>
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="profile-section-title" className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-jh-red" strokeWidth={1.5} aria-hidden /> {meta.title}</h2>
                <p className="mt-1 max-w-prose text-sm text-jh-mute">{meta.ask}</p>
              </div>
              {rows.find((r) => r.key === shown)?.count && <span className="shrink-0 font-mono text-xs text-jh-mute pt-1.5">{rows.find((r) => r.key === shown)!.count}</span>}
            </header>
            <div className="card p-5">{panel}</div>
            <nav className="flex items-center justify-between gap-3 md:hidden" aria-label="Neighbouring sections">
              {(() => {
                const i = ACTIVE_SECTIONS.findIndex((s) => s.key === shown);
                const prev = ACTIVE_SECTIONS[i - 1], next = ACTIVE_SECTIONS[i + 1];
                return (
                  <>
                    {prev ? <Link href={sectionHref(prev.key)} className="btn-secondary btn-sm">← {prev.label}</Link> : <span />}
                    {next ? <Link href={sectionHref(next.key)} className="btn-secondary btn-sm">{next.label} →</Link> : <span />}
                  </>
                );
              })()}
            </nav>
          </section>
        </div>
      </div>

      {sheet.open && uid && (
        <ProfileUploadSheet
          uid={uid}
          setup={setup}
          profile={profile}
          current={current}
          initialFile={sheet.file}
          onClose={() => setSheet({ open: false, file: null })}
          onDownloadCurrent={exportProfile}
          onDone={(keys) => {
            setSheet({ open: false, file: null });
            setStamp((s) => s + 1);
            setStatus({ text: keys.length ? `Unpacked — ${keys.length} ${keys.length === 1 ? "section" : "sections"} updated:` : "Unpacked — nothing changed.", keys });
          }}
        />
      )}
    </div>
  );
}
