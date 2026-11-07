"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import ProfileFilesPanel, { downloadText, type Dropped } from "@/components/jobhacking/ProfileFilesPanel";
import { JH_PAGE_ICONS } from "@/components/jobhacking/pageIcons";
import PageHeader from "@/components/shell/PageHeader";
import { useAccess } from "@/lib/firestore/access";
import { paths, useLiveCollection, useLiveDoc } from "@/lib/firestore/db";
import { PROFILE_FILENAME, profileFromSetup, profileToYaml } from "@/lib/careerops/profile-file";
import { SETTINGS_BASE, jhAreaRows, jhPageHref, jhPagesFor, jhRowsFor, jhSectionSummaries, jhSectionsFor, type JhPageKey } from "@/lib/jobhacking/sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { VaultAccount } from "@/lib/careerops/vault";
import type { Profile } from "@/lib/types";
import Identity from "./Identity";
import SectionList, { type SectionItem, type SectionRow } from "./SectionList";
import { sectionsProgress } from "./SectionsPage";

// Compass → Settings — the hub (docs/UX_SETTINGS_HUB.md §2). Everything the
// agents work from, in one place: who this is, the five areas (each row quotes
// the member's data, tap to open), and the four Packer files. The left column
// is the 232px the areas use for their rail, so the hub and its areas share
// one geometry. Not gated on CareerOps: the setup document is read directly;
// only Agents · Portal accounts needs the worker, and the registry hides it
// without one.

const PORTAL = "compass" as const;

export default function SettingsHub() {
  const { user, isAdmin } = useAuth();
  const uid = user?.uid;
  const { agentsEnabled, loading: accessLoading } = useAccess(uid);
  const careerOps = agentsEnabled || isAdmin;
  const { data: profile, loading: profileLoading } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup, loading: setupLoading } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const { data: vault } = useLiveCollection<VaultAccount>(careerOps ? uid : undefined, paths.careerOpsVault);

  const pages = useMemo(() => jhPagesFor(PORTAL), []);
  const items = useMemo<SectionItem<JhPageKey>[]>(
    () => pages.map((p) => ({ key: p.key, label: p.label, title: p.title, ask: p.intro, href: jhPageHref(p.key, SETTINGS_BASE), icon: JH_PAGE_ICONS[p.key] })),
    [pages],
  );
  const signals = useMemo(() => ({ setup, profile, accounts: vault.length }), [setup, profile, vault.length]);
  const areaRows = useMemo<SectionRow<JhPageKey>[]>(() => jhAreaRows(signals, { portal: PORTAL, careerOps }), [signals, careerOps]);
  // Over every section of every area — the whole picture.
  const progress = useMemo(() => {
    const all = jhSectionSummaries(signals);
    return sectionsProgress(pages.flatMap((p) => jhRowsFor(jhSectionsFor(p.key, { portal: PORTAL, careerOps }), all)));
  }, [signals, pages, careerOps]);

  const [dropped, setDropped] = useState<Dropped | null>(null);
  const [over, setOver] = useState(false);
  const email = profile?.email ?? user?.email ?? "";
  const loading = !uid || setupLoading || profileLoading || accessLoading;

  const exportProfile = () => downloadText(PROFILE_FILENAME, profileToYaml(profileFromSetup({ profile, setup })));
  const exportButton = (
    <button type="button" onClick={exportProfile} className="btn-secondary btn-sm" disabled={!setup}>
      <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Export profile.yml
    </button>
  );

  const progressBar = (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-jh-mute">{progress.done} of {progress.total} sections</span>
        <span className="font-mono text-xs text-jh-mute" aria-hidden>{progress.pct}%</span>
      </div>
      {/* Information, not a call to action — ink, not red. */}
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-pill bg-jh-mist" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total} aria-label="Settings sections filled in">
        <div className="h-full rounded-pill bg-jh-ink transition-[width]" style={{ width: `${progress.pct}%` }} />
      </div>
    </div>
  );

  return (
    <div
      className="space-y-6"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files?.length) return; e.preventDefault(); setOver(false); setDropped({ files: Array.from(e.dataTransfer.files), at: Date.now() }); }}
    >
      <PageHeader
        eyebrow="Account"
        title="Settings"
        intro="Everything the agents work from. Upload your coach's files, or open any area and fill it in."
        actions={<div className="hidden md:flex items-center gap-2">{exportButton}</div>}
      />

      <div className="md:grid md:grid-cols-[232px_minmax(0,1fr)] md:items-start md:gap-8">
        {/* ---- Left column: who this is, and how far along ---- */}
        <aside className="hidden md:block md:sticky md:top-11 space-y-5">
          <Identity profile={profile} email={email} />
          <div className="border-t border-jh-line pt-4">{progressBar}</div>
        </aside>

        <div className="min-w-0 space-y-8">
          {/* ---- Mobile: identity, export, progress ---- */}
          <div className="md:hidden space-y-6">
            <section className="card p-4"><Identity profile={profile} email={email} /></section>
            <div className="[&>button]:w-full">{exportButton}</div>
            {progressBar}
          </div>

          {/* ---- The areas ---- */}
          <section aria-labelledby="settings-areas">
            <p id="settings-areas" className="section-label mb-2">Your profile</p>
            {loading
              ? <p className="text-jh-mute animate-pulse">Loading…</p>
              : <SectionList items={items} rows={areaRows} variant="rows" label="Settings areas" />}
          </section>

          {/* ---- The files ---- */}
          <section aria-labelledby="settings-files" className="space-y-2">
            <p id="settings-files" className="section-label">Your profile files</p>
            {uid && <ProfileFilesPanel uid={uid} setup={setup} profile={profile} portal={PORTAL} careerOps={careerOps} dropped={dropped} over={over} />}
          </section>
        </div>
      </div>
    </div>
  );
}
