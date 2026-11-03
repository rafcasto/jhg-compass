"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, FileUp, Lock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import ProfileUploadSheet from "@/components/profile/ProfileUploadSheet";
import PageHeader from "@/components/shell/PageHeader";
import { PROFILE_FILENAME, PROFILE_MAX_BYTES, profileFromSetup, profileToYaml } from "@/lib/careerops/profile-file";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { FILE_SECTIONS, type FileSectionKey } from "@/lib/profile-sections";
import { JH_FILE_EDIT, JH_PAGES, jhSectionHref } from "@/lib/jobhacking/sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// JobHacking · Settings — docs/UX_JOBHACKING.md §4. One thing: upload a
// profile.yml. The sheet is the Profile page's (pick → review the diff →
// unpack), untouched; the file is read in the browser and nothing is written
// until the member confirms. What the file carries overrides what the sections
// hold (decision H) — the review says exactly what, section by section.

// The review step offers "Download current profile" before anything is replaced.
// Not an Export button (this page has none, by decision) — the safety copy the sheet promises.
function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function JobHackingSettings() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const current = useMemo(() => profileFromSetup({ profile, setup }), [profile, setup]);

  const [sheet, setSheet] = useState<{ open: boolean; file: File | null }>({ open: false, file: null });
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<{ text: string; keys: FileSectionKey[] } | null>(null);

  return (
    <div
      className="space-y-6"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files?.length) return; e.preventDefault(); setOver(false); setSheet({ open: true, file: e.dataTransfer.files[0] }); }}
    >
      <PageHeader eyebrow="JobHacking" title="Settings" intro="Upload your profile.yml and every section of this portal fills in from it. Upload it again any time — what the file carries replaces what's here; anything it doesn't mention is left as it is." />

      {status && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-jh-line bg-jh-mist/40 px-4 py-3 text-sm text-jh-ink">
          <Check className="h-4 w-4 shrink-0 text-rb-green-dark" aria-hidden /> {status.text}
          {status.keys.map((k) => {
            const edit = JH_FILE_EDIT[k];
            return edit
              ? <Link key={k} href={jhSectionHref(edit)} className="link text-sm">{FILE_SECTIONS[k].label}</Link>
              : <span key={k} className="text-sm text-jh-mute">{FILE_SECTIONS[k].label}</span>;
          })}
        </p>
      )}

      <section className="card p-5 md:p-7 max-w-2xl space-y-5" aria-labelledby="jh-upload-title">
        <div>
          <h2 id="jh-upload-title" className="text-lg">Your profile</h2>
          <p className="mt-1 text-sm text-jh-mute">One .yml with everything in it — contact details, headline, bridge story, core competencies, your True North, your target companies.</p>
        </div>
        <div className={`rounded-sm border-[1.5px] border-dashed p-8 text-center transition-colors ${over ? "border-jh-red bg-jh-red/5" : "border-jh-line-2"}`}>
          <p className="text-sm text-jh-ink">Drop your profile here</p>
          <p className="text-xs text-jh-mute mt-1">.yml · up to {PROFILE_MAX_BYTES / 1024} kB</p>
          <button type="button" onClick={() => setSheet({ open: true, file: null })} className="btn-primary btn-sm mt-4">
            <FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Upload profile
          </button>
          <p className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-jh-mute"><Lock className="h-3 w-3" aria-hidden /> Read in your browser. Nothing is saved until you confirm.</p>
        </div>
        <div className="border-t border-jh-line pt-4">
          <p className="section-label mb-2">What it fills in</p>
          <ul className="divide-y divide-jh-line">
            {JH_PAGES.map((p) => (
              <li key={p.key}>
                <Link href={p.href} className="flex items-center justify-between gap-3 py-2.5 min-h-[44px] text-sm">
                  <span className="font-display font-semibold text-jh-ink">{p.label}</span>
                  <span className="text-jh-mute truncate">{p.intro.split(".")[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {sheet.open && uid && (
        <ProfileUploadSheet
          uid={uid}
          setup={setup}
          profile={profile}
          current={current}
          initialFile={sheet.file}
          onClose={() => setSheet({ open: false, file: null })}
          onDownloadCurrent={() => download(PROFILE_FILENAME, profileToYaml(current))}
          onDone={(keys) => {
            setSheet({ open: false, file: null });
            setStatus({ text: keys.length ? `Unpacked — ${keys.length} ${keys.length === 1 ? "section" : "sections"} updated:` : "Unpacked — nothing changed.", keys });
          }}
        />
      )}
    </div>
  );
}
