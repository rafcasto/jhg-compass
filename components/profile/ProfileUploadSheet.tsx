"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { setDoc } from "firebase/firestore";
import { Download, Equal, Lock, Plus, RefreshCw, TriangleAlert, Upload, X } from "lucide-react";
import { Sheet, SheetFooter } from "@/components/tracker/Sheet";
import { paths } from "@/lib/firestore/db";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import { PROFILE_ACCEPT, PROFILE_MAX_BYTES, mergeProfile, parseProfileFile, profileToSetupPatch, type ProfileFile, type ProfileFileParse } from "@/lib/careerops/profile-file";

const diffReplaces = (rows: ReviewRow[]): boolean => rows.some((d) => d.kind === "replace");
import { profileDiff, type DiffKind } from "@/lib/careerops/profile-diff";
import { FILE_SECTIONS, type FileSectionKey } from "@/lib/profile-sections";
import { JH_FILES, detectJhFile, findJhFile, jhFilePreview, shapeJhFile, type JhgFileKey } from "@/lib/jobhacking/profile-files";
import type { CareerOpsSetupV2, ProfileFileRecord } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// Upload the profile: pick → review the diff → unpack. docs/UX_PROFILE.md §2,
// docs/UX_JOBHACKING.md §4.
//
// Since 2026-11-07 the Packer writes the profile as FOUR files (narrative ·
// true-north · target-companies · artefacts), so the sheet takes one file or
// several at once. Each is validated on its own (Step 0 — a wrong shape is
// refused with its paths, and the rest still go through), named for the slot
// it fills (its own jhg.progress stamp, else its filename), and merged KEY BY
// KEY onto what is stored and onto the files before it: a field a file does
// not mention is never dropped. The review lists, for each of the four files,
// EXACTLY the sections of the page it fills — one row per section, the page's
// labels, nothing more, nothing less (decision 2026-11-07) — and what the
// file would do to each. One Unpack writes the lot. A whole profile.yml still
// works, reviewed by its storage sections as before.
//
// The files are untrusted. Read in the browser, strings extracted, nothing obeyed.

const MAX_ERRORS = 8;
const KIND_ICON: Record<DiffKind, typeof Plus> = { add: Plus, replace: RefreshCw, keep: Equal };
const KIND_TONE: Record<DiffKind, string> = { add: "text-rb-green-dark", replace: "text-jh-ink", keep: "text-jh-mute" };

interface Taken {
  id: number;
  filename: string;
  raw: string;
  parse: ProfileFileParse;
  /** Which of the four it is; null for a whole profile.yml. */
  file: JhgFileKey | null;
}

/** One row of the review — a page section (one of the four files) or a storage section (a whole profile.yml). */
export interface ReviewRow { key: string; label: string; href: string | null; inFile: boolean; kind: DiffKind; headline: string; detail?: string }

export default function ProfileUploadSheet({ uid, setup, profile, current, initialFiles, expect, fileSectionHref, onClose, onDone, onDownloadCurrent }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  profile: Profile | null | undefined;
  /** What is stored now, in file shape — the left side of the diff. */
  current: ProfileFile;
  /** Files dropped on the page before the sheet opened. */
  initialFiles?: File[] | null;
  /** The slot the member opened the sheet from (JobHacking → Settings); a file for another slot is said, not refused. */
  expect?: JhgFileKey | null;
  /** Where a whole profile.yml's storage section is edited on this portal — the status line's links. */
  fileSectionHref: (key: FileSectionKey) => string | null;
  onClose: () => void;
  /** The sections the unpack changed, with their links, and which of the four files were unpacked. */
  onDone: (changed: { label: string; href: string | null }[], files: JhgFileKey[]) => void;
  onDownloadCurrent: () => void;
}) {
  const [taken, setTaken] = useState<Taken[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  function take(files: ArrayLike<File> | null | undefined) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setErr(null);
    for (const file of list) {
      const id = nextId.current++;
      if (file.size > PROFILE_MAX_BYTES) { setErr(`${file.name} is ${Math.round(file.size / 1024)} kB — the limit is ${PROFILE_MAX_BYTES / 1024} kB.`); continue; }
      file.text()
        .then((text) => {
          const parse = parseProfileFile(text, file.name);
          if (parse.error) { setErr(parse.error); return; }
          const which = parse.ok ? detectJhFile(parse.profile, file.name) : null;
          // The same slot twice: the later file wins, so a corrected drop replaces the first.
          setTaken((cur) => [...cur.filter((t) => !(which && t.file === which) && t.filename !== file.name), { id, filename: file.name, raw: text, parse, file: which }]);
        })
        .catch(() => setErr(`Couldn't read ${file.name}.`));
    }
  }

  useEffect(() => { take(initialFiles); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [initialFiles]);

  const valid = taken.filter((t) => t.parse.ok);
  const broken = taken.filter((t) => !t.parse.ok && t.parse.errors.length);
  const review = valid.length > 0 ? valid : null;

  // Each file is shaped for its page, merged onto what is stored PLUS the files before it, and reviewed as
  // the sections of its page — so the rows read exactly as the write will happen.
  const steps = useMemo(() => {
    let baseProfile = current;
    let baseSetup: Partial<CareerOpsSetupV2> = setup ?? {};
    let patch: Partial<CareerOpsSetupV2> = {};
    const out = valid.map((t) => {
      const shaped = shapeJhFile(t.file, t.parse.profile, baseProfile);
      const merged = mergeProfile(baseProfile, shaped);
      const step = profileToSetupPatch(merged).setup;
      const afterSetup = { ...baseSetup, ...step };
      const rows: ReviewRow[] = t.file
        ? jhFilePreview(t.file, shaped, baseSetup, afterSetup, profile)
        : profileDiff(baseProfile, merged).map((d) => ({ key: d.key, label: FILE_SECTIONS[d.key].label, href: fileSectionHref(d.key), inFile: d.inFile, kind: d.kind, headline: d.headline, detail: d.detail }));
      baseProfile = { ...baseProfile, ...merged };
      baseSetup = afterSetup;
      patch = { ...patch, ...step };
      return { t, rows };
    });
    return { steps: out, patch };
  }, [current, setup, profile, valid, fileSectionHref]);
  const { steps: reviewSteps, patch: combinedPatch } = steps;
  const allRows = reviewSteps.flatMap((s) => s.rows.filter((d) => d.inFile));
  const replaces = allRows.filter((d) => d.kind === "replace");

  async function unpack() {
    if (!reviewSteps.length) return;
    setBusy(true);
    setErr(null);
    try {
      const patch = combinedPatch;
      const now = Date.now();
      const profileFiles: Partial<Record<JhgFileKey, ProfileFileRecord>> = { ...(setup?.profileFiles ?? {}) };
      for (const s of reviewSteps) {
        if (s.t.file) profileFiles[s.t.file] = { filename: s.t.filename, at: now };
        else for (const f of JH_FILES) profileFiles[f.key] = { filename: s.t.filename, at: now };
      }
      await setDoc(
        paths.careerOpsSetup(uid),
        { ...patch, profileFiles, profileYaml: buildSetupProfileYaml({ profile, setup, overrides: patch }), updatedAt: now },
        { merge: true },
      );
      const seen = new Set<string>();
      const changed = allRows.filter((d) => d.kind !== "keep" && !seen.has(d.key) && seen.add(d.key)).map((d) => ({ label: d.label, href: d.href }));
      onDone(changed, reviewSteps.map((s) => s.t.file).filter((f): f is JhgFileKey => !!f));
    } catch {
      setErr("Couldn't save that — check your connection and try again.");
      setBusy(false);
    }
  }

  const footer = review ? (
    <SheetFooter
      primary={{ label: review.length === 1 ? "Unpack it" : `Unpack ${review.length} files`, onClick: unpack, busy, busyLabel: "Unpacking…" }}
      secondary={{ label: "Start again", onClick: () => { setTaken([]); setErr(null); }, disabled: busy }}
    />
  ) : undefined;

  const expected = findJhFile(expect);
  const title = expected ? `Upload your ${expected.label} file` : "Upload your profile";

  return (
    <Sheet
      title={title}
      eyebrow={review ? "Step 2 of 2 · Review" : "Step 1 of 2 · Pick a file"}
      description={review ? undefined : expected ? `${expected.filename} from your coach's Packer. It is read in your browser and nothing is saved until you confirm.` : "One of the four files your coach's Packer writes — or all four at once. Read in your browser; nothing is saved until you confirm."}
      size="lg"
      onClose={onClose}
      dirty={!!review}
      footer={footer}
      viewKey={review ? "review" : "pick"}
    >
      {err && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-sm border border-jh-red/30 bg-jh-red/5 px-3 py-2.5 text-sm text-jh-red">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" /> {err}
        </p>
      )}

      {broken.map((b) => (
        <div key={b.id} role="alert" className="mb-4 rounded-sm border border-jh-red/30 bg-jh-red/5 px-3 py-2.5 text-sm">
          <p className="flex items-start justify-between gap-2 font-semibold text-jh-red">
            <span className="flex items-start gap-2"><TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" /> <code className="font-mono text-xs">{b.filename}</code>&nbsp;doesn&apos;t match the profile shape</span>
            <button type="button" onClick={() => setTaken((cur) => cur.filter((t) => t.id !== b.id))} className="icon-btn icon-btn-tight" aria-label={`Forget ${b.filename}`}><X className="h-4 w-4" aria-hidden /></button>
          </p>
          <ul className="mt-2 space-y-1 pl-6">
            {b.parse.errors.slice(0, MAX_ERRORS).map((e, i) => (
              <li key={i} className="text-jh-ink">
                <code className="font-mono text-xs text-jh-red">{e.path || "file"}</code> — {e.message}
              </li>
            ))}
            {b.parse.errors.length > MAX_ERRORS && <li className="text-jh-mute">and {b.parse.errors.length - MAX_ERRORS} more</li>}
          </ul>
          <p className="mt-2 pl-6 text-jh-mute">
            Data can be missing; the shape can&apos;t be wrong. Fix the file and drop it again, or download an example:{" "}
            {JH_FILES.map((f, i) => <span key={f.key}>{i > 0 && " · "}<a href={`/${f.filename.replace(/\.yml$/, ".example.yml")}`} download className="link text-sm">{f.filename}</a></span>)}.
          </p>
        </div>
      ))}

      {!review ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
          className={`rounded-sm border-[1.5px] border-dashed p-8 text-center transition-colors ${over ? "border-jh-red bg-jh-red/5" : "border-jh-line-2"}`}
        >
          <p className="text-sm text-jh-ink">{expected ? `Drop ${expected.filename} here` : "Drop your files here"}</p>
          <p className="text-xs text-jh-mute mt-1">.yml · up to {PROFILE_MAX_BYTES / 1024} kB each{expected ? "" : " · one file or all four"}</p>
          <label className="btn-secondary mt-4 inline-flex text-xs px-3 py-2 cursor-pointer">
            <Upload className="h-3.5 w-3.5" /> {expected ? "Choose the file" : "Choose files"}
            <input ref={fileRef} type="file" accept={PROFILE_ACCEPT} multiple={!expected} className="sr-only" onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
          </label>
          <p className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-jh-mute"><Lock className="h-3 w-3" /> Read in your browser. Nothing is saved until you confirm.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {reviewSteps.map(({ t, rows }) => {
            const slot = findJhFile(t.file);
            // The four files: every section of the page, always. A whole profile: only the storage sections it carries.
            const shown = slot ? rows : rows.filter((d) => d.inFile);
            const elsewhere = expected && t.file && t.file !== expected.key;
            return (
              <section key={t.id} aria-labelledby={`up-${t.id}`} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p id={`up-${t.id}`} className="text-sm font-semibold text-jh-ink">
                      {slot ? `${slot.label} file` : "Whole profile"} · <code className="font-mono text-xs font-normal">{t.filename}</code>
                    </p>
                    <p className="text-xs text-jh-mute mt-0.5">
                      {slot ? `The ${slot.label} page, section by section.` : "Fills every section it carries."} Anything it doesn&apos;t mention is left exactly as it is.
                    </p>
                    {elsewhere && <p className="mt-1 text-xs text-jh-ink">This is your {slot!.label} file, not {expected!.label} — it goes to {slot!.label}, which is fine.</p>}
                  </div>
                  {reviewSteps.length > 1 && (
                    <button type="button" onClick={() => setTaken((cur) => cur.filter((x) => x.id !== t.id))} disabled={busy} className="icon-btn" aria-label={`Leave out ${t.filename}`}><X className="h-4 w-4" aria-hidden /></button>
                  )}
                </div>
                <ul className="card divide-y divide-jh-line">
                  {shown.map((d) => <DiffRow key={d.key} d={d} />)}
                </ul>
                {slot && <p className="text-xs text-jh-mute">Also kept for the agents, not shown on the page: {slot.alsoKept}.</p>}
                {t.parse.warnings.length > 0 && (
                  <ul className="space-y-1">
                    {t.parse.warnings.map((w) => (
                      <li key={w} className="flex items-start gap-2 text-xs text-jh-mute">
                        <TriangleAlert className="h-3 w-3 shrink-0 mt-0.5 text-jh-red" /> {w}
                      </li>
                    ))}
                  </ul>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-jh-mute hover:text-jh-ink">Show the raw file</summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-sm border border-jh-line bg-jh-mist/40 p-3 font-mono text-xs text-jh-ink whitespace-pre-wrap">{t.raw}</pre>
                </details>
              </section>
            );
          })}

          {!expected && reviewSteps.length < JH_FILES.length && (
            <label className="btn-secondary btn-sm inline-flex cursor-pointer">
              <Plus className="h-4 w-4" aria-hidden /> Add another file
              <input type="file" accept={PROFILE_ACCEPT} multiple className="sr-only" onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
            </label>
          )}

          {diffReplaces(allRows) && (
            <div className="rounded-sm bg-jh-mist px-4 py-3 text-sm">
              <p className="text-jh-ink">
                Replacing {replaces.length} {replaces.length === 1 ? "section" : "sections"}. Want a copy of what you have now?
              </p>
              <button type="button" onClick={onDownloadCurrent} className="link mt-1 inline-flex items-center gap-1 text-sm">
                <Download className="h-3.5 w-3.5" /> Download current profile
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function DiffRow({ d }: { d: ReviewRow }) {
  const Icon = KIND_ICON[d.kind];
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${KIND_TONE[d.kind]}`} strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display font-semibold text-[15px] text-jh-ink">{d.label}</span>
          <span className="text-sm text-jh-mute">{d.headline}</span>
        </span>
        {d.detail && <span className="block truncate text-sm text-jh-ink">{d.detail}</span>}
        <span className="sr-only">{d.kind === "add" ? "adds" : d.kind === "replace" ? "replaces" : "unchanged"}</span>
      </span>
    </li>
  );
}
