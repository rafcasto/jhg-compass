"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Building2, Check, CircleDashed, Download, Lock, Navigation, Sparkles, Upload, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import FeedbackModal from "@/components/FeedbackModal";
import ProfileUploadSheet from "@/components/profile/ProfileUploadSheet";
import { useFeedbackConfig, useFeedbackSubmission } from "@/lib/firestore/feedback";
import { lockedSlots, slotLocked, uploadLockLine } from "@/lib/feedback-lock";
import { PROFILE_FILENAME, PROFILE_MAX_BYTES, profileFromSetup, profileToYaml } from "@/lib/careerops/profile-file";
import type { FileSectionKey } from "@/lib/profile-sections";
import { JH_FILES, jhFilePage, jhFileStatuses, jhFilesProgress, type JhgFileKey } from "@/lib/jobhacking/profile-files";
import { BASE_OF, jhFileEditHref, jhPageHref, type ProfilePortal } from "@/lib/jobhacking/sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// The four Packer files — docs/UX_JOBHACKING.md §4, docs/UX_SETTINGS_HUB.md §2.
//
// One card, used by JobHacking → Settings and by the Compass Settings hub: a
// slot per file (what it fills, whether it has been uploaded and when, one
// Upload — the row's button is the only way in; no button above the rows,
// decision 2026-11-07), the drop zone, the examples and the whole-profile
// export. The sheet is the shared
// ProfileUploadSheet (pick → review → unpack), merging key by key; the links
// on the "unpacked" status line go to the sections of THIS portal.
//
// A page that takes drops anywhere passes them in through `dropped`; the panel
// opens the sheet with them.
//
// The upload lock (docs/UX_JOBHACKING.md §4c) is per slot: while the admin
// flag `config/feedback.uploadLock` is on, a row whose file the member has not
// answered the survey for shows a mute "Unlock" with a lock glyph that opens
// the survey for THAT file (the answer carries `unlocks: <key>`); the row
// turns into Upload / Replace live on submit. Drops wait until every slot is
// unlocked.

const ICONS: Record<JhgFileKey, ComponentType<LucideProps>> = { narrative: Sparkles, trueNorth: Navigation, targetCompanies: Building2, artefacts: BookOpen };

export function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "application/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface Dropped { files: File[]; at: number }

export default function ProfileFilesPanel({ uid, setup, profile, portal, careerOps = false, dropped = null, over = false }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  profile: Profile | null | undefined;
  portal: ProfilePortal;
  careerOps?: boolean;
  /** Files dropped on the page around the card — the panel opens the sheet with them. */
  dropped?: Dropped | null;
  /** A file is being dragged over the page — the drop zone shows it. */
  over?: boolean;
}) {
  const base = BASE_OF[portal];
  const current = useMemo(() => profileFromSetup({ profile, setup }), [profile, setup]);
  const statuses = useMemo(() => jhFileStatuses(setup), [setup]);
  const progress = jhFilesProgress(statuses);

  // The upload lock — admin flag + whether this member has answered.
  const feedback = useFeedbackConfig();
  const submission = useFeedbackSubmission(uid);
  const lockInput = useMemo(() => ({ uploadLock: feedback.uploadLock, unlocked: submission.unlocked, loading: submission.loading }), [feedback.uploadLock, submission.unlocked, submission.loading]);
  const stillLocked = useMemo(() => lockedSlots(lockInput, JH_FILES.map((f) => f.key)) as JhgFileKey[], [lockInput]);
  const anyLocked = stillLocked.length > 0;
  const [survey, setSurvey] = useState<JhgFileKey | null>(null);

  const [sheet, setSheet] = useState<{ open: boolean; files: File[] | null; expect: JhgFileKey | null }>({ open: false, files: null, expect: null });
  const [status, setStatus] = useState<{ text: string; links: { label: string; href: string | null }[] } | null>(null);
  const fileSectionHref = useCallback((k: FileSectionKey) => jhFileEditHref(k, portal), [portal]);
  const open = useCallback((expect: JhgFileKey | null, files: File[] | null = null) => {
    setStatus(null);
    if (expect ? slotLocked(lockInput, expect) : anyLocked) { setSurvey(expect ?? stillLocked[0]); return; }
    setSheet({ open: true, files, expect });
  }, [lockInput, anyLocked, stillLocked]);
  // A drop lands in whichever slot the file names, so it waits until every slot is unlocked.
  useEffect(() => { if (dropped && !anyLocked) open(null, dropped.files); }, [dropped, anyLocked, open]);
  // The slot unlocked (the member answered, or the admin turned the lock off) while its survey was up.
  useEffect(() => { if (survey && !slotLocked(lockInput, survey)) setSurvey(null); }, [survey, lockInput]);

  const exportAll = () => downloadText(PROFILE_FILENAME, profileToYaml(current));

  return (
    <>
      {status && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-jh-line bg-jh-mist/40 px-4 py-3 text-sm text-jh-ink">
          <Check className="h-4 w-4 shrink-0 text-rb-green-dark" aria-hidden /> {status.text}
          {status.links.map((l) => l.href
            ? <Link key={l.label} href={l.href} className="link text-sm">{l.label}</Link>
            : <span key={l.label} className="text-sm text-jh-mute">{l.label}</span>)}
        </p>
      )}

      <section className="card p-5 md:p-7 space-y-5" aria-labelledby="jh-files-title">
        <div>
          <h2 id="jh-files-title" className="text-lg">Your profile files</h2>
          <p className="mt-1 text-sm text-jh-mute">{progress.done} of {progress.total} uploaded. {anyLocked ? uploadLockLine(feedback) : "Each file fills one area; together they are your whole profile."}</p>
        </div>

        {/* One slot per file — the row grammar of the rest of the portal: a glyph, one heavy name, a mute line, one action. */}
        <ol className="divide-y divide-jh-line border-t border-jh-line">
          {JH_FILES.map((f) => {
            const s = statuses.find((x) => x.key === f.key)!;
            const Icon = ICONS[f.key];
            const page = jhFilePage(f.key);
            const locked = slotLocked(lockInput, f.key);
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
                    <Link href={jhPageHref(page.key, base)} className="link text-sm">Open {page.label}</Link>
                  </p>
                </div>
                {locked
                  ? <button type="button" onClick={() => setSurvey(f.key)} className="btn btn-sm border-jh-line bg-transparent text-jh-mute hover:border-jh-line-2 hover:text-jh-ink" aria-label={`Unlock ${f.filename} — answer a short survey`} title="Answer a short survey to unlock this file">
                      <Lock className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Unlock
                    </button>
                  : <button type="button" onClick={() => open(f.key)} className="btn-secondary btn-sm" aria-label={`Upload ${f.filename}`}>
                      <Upload className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {s.uploaded ? "Replace" : "Upload"}
                    </button>}
              </li>
            );
          })}
        </ol>

        <div className={`rounded-sm border-[1.5px] border-dashed p-6 text-center transition-colors ${over ? "border-jh-red bg-jh-red/5" : "border-jh-line-2"}`}>
          {anyLocked
            ? <p className="inline-flex items-center gap-1.5 text-sm text-jh-mute"><Lock className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Dropping files works once every file is unlocked</p>
            : <p className="text-sm text-jh-ink">Drop one file — or all four — anywhere on this page</p>}
          <p className="text-xs text-jh-mute mt-1">.yml · up to {PROFILE_MAX_BYTES / 1024} kB each · each lands in its own slot</p>
          <p className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-jh-mute"><Lock className="h-3 w-3" aria-hidden /> Read in your browser. Nothing is saved until you confirm.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-jh-line pt-4 text-sm">
          <p className="text-jh-mute">
            Examples: {JH_FILES.map((f, i) => <span key={f.key}>{i > 0 && " · "}<a href={`/${f.filename.replace(/\.yml$/, ".example.yml")}`} download className="link text-sm">{f.filename}</a></span>)}
          </p>
          <button type="button" onClick={exportAll} className="btn-secondary btn-sm" disabled={!setup}>
            <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Download everything as one profile.yml
          </button>
        </div>
      </section>

      {survey && (
        <FeedbackModal
          cfg={feedback}
          uid={uid}
          profile={profile ?? null}
          source="lock"
          unlocks={{ key: survey, label: JH_FILES.find((f) => f.key === survey)!.label }}
          onDone={() => setSurvey(null)}
          onDismiss={() => setSurvey(null)}
        />
      )}

      {sheet.open && (
        <ProfileUploadSheet
          uid={uid}
          setup={setup}
          profile={profile}
          current={current}
          initialFiles={sheet.files}
          expect={sheet.expect}
          portal={portal}
          careerOps={careerOps}
          fileSectionHref={fileSectionHref}
          onClose={() => setSheet({ open: false, files: null, expect: null })}
          onDownloadCurrent={exportAll}
          onDone={(links, files) => {
            setSheet({ open: false, files: null, expect: null });
            const which = files.map((k) => JH_FILES.find((f) => f.key === k)!.label);
            const lead = which.length ? `Unpacked ${which.join(", ")}` : "Unpacked";
            setStatus({ text: links.length ? `${lead} — ${links.length} ${links.length === 1 ? "section" : "sections"} updated:` : `${lead} — nothing changed.`, links });
          }}
        />
      )}
    </>
  );
}
