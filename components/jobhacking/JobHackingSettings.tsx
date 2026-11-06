"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Building2, Check, CircleDashed, Download, FileUp, Lock, Navigation, Sparkles, Upload, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/components/AuthProvider";
import ProfileUploadSheet from "@/components/profile/ProfileUploadSheet";
import PageHeader from "@/components/shell/PageHeader";
import { PROFILE_FILENAME, PROFILE_MAX_BYTES, profileFromSetup, profileToYaml } from "@/lib/careerops/profile-file";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { FILE_SECTIONS, type FileSectionKey } from "@/lib/profile-sections";
import { JH_FILES, jhFilePage, jhFileStatuses, jhFilesProgress, type JhgFileKey } from "@/lib/jobhacking/profile-files";
import { JH_FILE_EDIT, jhSectionHref } from "@/lib/jobhacking/sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// JobHacking · Settings — docs/UX_JOBHACKING.md §4 (decision 2026-11-07).
//
// The Packer writes the profile as four files, one per page of this portal,
// so Settings is four slots: Narrative · True North · Target companies ·
// Artefacts. Each row says what the file fills, whether it has been uploaded
// (and when, from which filename, and the Packer's own stamp), and has one
// Upload. The page's one red button takes any of them, or all four at once —
// a dropped file lands in the slot its stamp names. The sheet is the Profile
// page's (pick → review → unpack); what a file carries is merged key by key
// onto what is here, so uploading the Artefacts file never wipes what the
// Narrative file brought. Nothing is written until the member confirms.

const ICONS: Record<JhgFileKey, ComponentType<LucideProps>> = { narrative: Sparkles, trueNorth: Navigation, targetCompanies: Building2, artefacts: BookOpen };

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
  const statuses = useMemo(() => jhFileStatuses(setup), [setup]);
  const progress = jhFilesProgress(statuses);

  const [sheet, setSheet] = useState<{ open: boolean; files: File[] | null; expect: JhgFileKey | null }>({ open: false, files: null, expect: null });
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<{ text: string; keys: FileSectionKey[] } | null>(null);

  const open = (expect: JhgFileKey | null, files: File[] | null = null) => { setStatus(null); setSheet({ open: true, files, expect }); };

  return (
    <div
      className="space-y-6"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files?.length) return; e.preventDefault(); setOver(false); open(null, Array.from(e.dataTransfer.files)); }}
    >
      <PageHeader eyebrow="JobHacking" title="Settings" intro="Your coach's Packer writes your profile as four files — one for each page of this portal. Upload each one as it's ready, or all four at once. What a file carries replaces what's here, field by field; anything it doesn't mention is left as it is." />

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

      <section className="card p-5 md:p-7 max-w-3xl space-y-5" aria-labelledby="jh-files-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="jh-files-title" className="text-lg">Your profile files</h2>
            <p className="mt-1 text-sm text-jh-mute">{progress.done} of {progress.total} uploaded. Each file fills one page; together they are your whole profile.</p>
          </div>
          <button type="button" onClick={() => open(null)} className="btn-primary btn-sm">
            <FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Upload files
          </button>
        </div>

        {/* One slot per file — the row grammar of the rest of the portal: a glyph, one heavy name, a mute line, one action. */}
        <ol className="divide-y divide-jh-line border-t border-jh-line">
          {JH_FILES.map((f) => {
            const s = statuses.find((x) => x.key === f.key)!;
            const Icon = ICONS[f.key];
            const page = jhFilePage(f.key);
            return (
              <li key={f.key} className="grid min-h-[44px] grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 py-3">
                <Icon className="mt-0.5 h-5 w-5 text-jh-mute" strokeWidth={1.5} aria-hidden />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 font-display text-[15px] font-semibold text-jh-ink">
                    {f.label}
                    <code className="font-mono text-xs font-normal text-jh-mute">{f.filename}</code>
                  </p>
                  <p className="text-sm text-jh-mute">{f.carries}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    {s.uploaded
                      ? <><Check className="h-4 w-4 shrink-0 text-rb-green-dark" aria-hidden /><span className="text-jh-ink">Uploaded{s.uploadedOn ? ` ${s.uploadedOn}` : ""}</span>{s.filename && <code className="font-mono text-xs text-jh-mute">{s.filename}</code>}{s.packer && <span className="text-jh-mute">· Packer: {s.packer}</span>}</>
                      : <><CircleDashed className="h-4 w-4 shrink-0 text-jh-mute" aria-hidden /><span className="text-jh-mute">Not uploaded yet</span></>}
                    <Link href={page.href} className="link text-sm">Open {page.label}</Link>
                  </p>
                </div>
                <button type="button" onClick={() => open(f.key)} className="btn-secondary btn-sm" aria-label={`Upload ${f.filename}`}>
                  <Upload className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {s.uploaded ? "Replace" : "Upload"}
                </button>
              </li>
            );
          })}
        </ol>

        <div className={`rounded-sm border-[1.5px] border-dashed p-6 text-center transition-colors ${over ? "border-jh-red bg-jh-red/5" : "border-jh-line-2"}`}>
          <p className="text-sm text-jh-ink">Drop one file — or all four — anywhere on this page</p>
          <p className="text-xs text-jh-mute mt-1">.yml · up to {PROFILE_MAX_BYTES / 1024} kB each · each lands in its own slot</p>
          <p className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-jh-mute"><Lock className="h-3 w-3" aria-hidden /> Read in your browser. Nothing is saved until you confirm.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-jh-line pt-4 text-sm">
          <p className="text-jh-mute">
            Examples: {JH_FILES.map((f, i) => <span key={f.key}>{i > 0 && " · "}<a href={`/${f.filename.replace(/\.yml$/, ".example.yml")}`} download className="link text-sm">{f.filename}</a></span>)}
          </p>
          <button type="button" onClick={() => download(PROFILE_FILENAME, profileToYaml(current))} className="btn-secondary btn-sm" disabled={!setup}>
            <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Download everything as one profile.yml
          </button>
        </div>
      </section>

      {sheet.open && uid && (
        <ProfileUploadSheet
          uid={uid}
          setup={setup}
          profile={profile}
          current={current}
          initialFiles={sheet.files}
          expect={sheet.expect}
          onClose={() => setSheet({ open: false, files: null, expect: null })}
          onDownloadCurrent={() => download(PROFILE_FILENAME, profileToYaml(current))}
          onDone={(keys, files) => {
            setSheet({ open: false, files: null, expect: null });
            const which = files.map((k) => JH_FILES.find((f) => f.key === k)!.label);
            const lead = which.length ? `Unpacked ${which.join(", ")}` : "Unpacked";
            setStatus({ text: keys.length ? `${lead} — ${keys.length} ${keys.length === 1 ? "section" : "sections"} updated:` : `${lead} — nothing changed.`, keys });
          }}
        />
      )}
    </div>
  );
}
