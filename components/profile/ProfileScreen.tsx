"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Download, FileUp } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import ContactPolicy from "@/components/careerops/ContactPolicy";
import NorthStarSource from "@/components/careerops/NorthStarSource";
import Personalization from "@/components/careerops/Personalization";
import ProofBankPanel from "./ProofBankPanel";
import StoriesPanel from "./StoriesPanel";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { PROFILE_FILENAME, profileFromSetup, profileToYaml } from "@/lib/careerops/profile-file";
import { FILE_SECTIONS, PAGE_HREF, findSection, parseSection, rowsFor, sectionHref, sectionSummaries, sectionsFor, type FileSectionKey } from "@/lib/profile-sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import ProfileUploadSheet from "./ProfileUploadSheet";
import SectionsPage from "./SectionsPage";

// The Profile page — docs/UX_PROFILE.md. Who am I · What's my target · What value do I create, with
// the whole profile.yml exported from and uploaded to here (the file also
// carries what Settings edits — a section's page is where it is edited, not
// where it is stored).
//
// Not gated on CareerOps: the setup document is read directly, not through
// useCareerOps(), whose `allowed` check belongs to the portal.

const SECTIONS = sectionsFor("profile");

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
  const { data: profile, loading: profileLoading } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup, loading: setupLoading } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const params = useSearchParams();
  const active = parseSection(params.get("section"), SECTIONS);

  const [sheet, setSheet] = useState<{ open: boolean; file: File | null }>({ open: false, file: null });
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<{ text: string; keys: FileSectionKey[] } | null>(null);
  // Bumped after an unpack so the mounted panel re-reads its initial state.
  const [stamp, setStamp] = useState(0);

  const rows = useMemo(() => rowsFor(SECTIONS, sectionSummaries({ setup, profile })), [setup, profile]);
  const current = useMemo(() => profileFromSetup({ profile, setup }), [profile, setup]);

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const email = profile?.email ?? user?.email ?? "";
  const initials = (fullName || email || "?").split(/[\s@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

  const exportProfile = () => download(PROFILE_FILENAME, profileToYaml(current));

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
        {/* One fact per line: in the 232px desktop rail a joined "email · country" always lost the country to the ellipsis. */}
        {email && <p className="truncate text-sm text-jh-mute" title={email}>{email}</p>}
        {profile?.country && <p className="truncate text-sm text-jh-mute">{profile.country}</p>}
      </div>
    </div>
  );

  const statusLine = status && (
    <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-jh-line bg-jh-mist/40 px-4 py-3 text-sm text-jh-ink">
      <Check className="h-4 w-4 shrink-0 text-rb-green-dark" aria-hidden /> {status.text}
      {status.keys.map((k) => (
        <Link key={k} href={sectionHref(FILE_SECTIONS[k].edit)} className="link text-sm">{FILE_SECTIONS[k].label}</Link>
      ))}
    </p>
  );

  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files?.length) return; e.preventDefault(); setOver(false); setSheet({ open: true, file: e.dataTransfer.files[0] }); }}
    >
      <SectionsPage
        page="profile"
        eyebrow="Account"
        title="Profile"
        intro="Who you are and what you're aiming at. Upload a profile.yml, or edit any section here — your master CV, target companies and portal accounts are under Settings."
        actions={actions}
        identity={identity}
        sections={SECTIONS}
        rows={rows}
        active={active}
        loading={!uid || setupLoading || profileLoading}
        panelKey={stamp}
        status={statusLine}
        panel={(key) => {
          if (!uid) return null;
          switch (key) {
            case "contact": return <ContactPolicy uid={uid} setup={setup} profile={profile} part="contact" />;
            case "headline": return <ContactPolicy uid={uid} setup={setup} profile={profile} part="headline" />;
            case "story": return <Personalization uid={uid} setup={setup} profile={profile} only={["exitNarrative"]} saveLabel="Save exit story" />;
            case "northstar": return (
              <div className="space-y-4">
                <NorthStarSource uid={uid} setup={setup} profile={profile} />
                <p className="text-xs text-jh-mute border-t border-jh-line pt-3">
                  The companies you&apos;re targeting, and the careers pages the Scout watches, live under{" "}
                  <Link href={sectionHref("companies")} className="link text-xs">Settings → Target companies</Link>.
                </p>
              </div>
            );
            case "logistics": return <ContactPolicy uid={uid} setup={setup} profile={profile} part="policy" />;
            case "targeting": return <Personalization uid={uid} setup={setup} profile={profile} only={["compTargets", "negotiationScripts", "locationPolicy"]} saveLabel="Save policy" />;
            case "stories": return <StoriesPanel uid={uid} setup={setup} profile={profile} />;
            case "proof": return <ProofBankPanel uid={uid} setup={setup} profile={profile} />;
            default: return <p className="text-sm text-jh-mute">{findSection(key)?.label} is edited under <Link href={PAGE_HREF.settings} className="link text-sm">Settings</Link>.</p>;
          }
        }}
      />

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
