"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { setDoc } from "firebase/firestore";
import { Download, Equal, Lock, Plus, RefreshCw, TriangleAlert, Upload } from "lucide-react";
import { Sheet, SheetFooter } from "@/components/tracker/Sheet";
import { paths } from "@/lib/firestore/db";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import { PROFILE_ACCEPT, PROFILE_MAX_BYTES, parseProfileFile, profileToSetupPatch, type ProfileFile, type ProfileFileParse } from "@/lib/careerops/profile-file";
import { diffReplaces, profileDiff, type DiffKind, type SectionDiff } from "@/lib/careerops/profile-diff";
import { findSection, type ActiveSectionKey } from "@/lib/profile-sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// Upload a profile.yml: pick → review the diff → unpack. docs/UX_PROFILE.md §2.
//
// Step 0 happens inside parseProfileFile: a file whose shape is wrong never
// reaches the review — the errors are listed with their paths and the drop
// zone is ready for the next file. What does reach the review is a valid
// file, and the review says per section what it would add, replace or keep.
// When anything would be replaced, "Download current profile" is offered
// right there: the member decides before the destructive step.
//
// The file is untrusted. Read in the browser, strings extracted, nothing obeyed.

const MAX_ERRORS = 8;
const KIND_ICON: Record<DiffKind, typeof Plus> = { add: Plus, replace: RefreshCw, keep: Equal };
const KIND_TONE: Record<DiffKind, string> = { add: "text-rb-green-dark", replace: "text-jh-ink", keep: "text-jh-mute" };

export default function ProfileUploadSheet({ uid, setup, profile, current, initialFile, onClose, onDone, onDownloadCurrent }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  profile: Profile | null | undefined;
  /** What is stored now, in file shape — the left side of the diff. */
  current: ProfileFile;
  /** A file dropped on the page before the sheet opened. */
  initialFile?: File | null;
  onClose: () => void;
  onDone: (changed: ActiveSectionKey[]) => void;
  onDownloadCurrent: () => void;
}) {
  const [parsed, setParsed] = useState<ProfileFileParse | null>(null);
  const [filename, setFilename] = useState("");
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function take(file: File | undefined | null) {
    if (!file) return;
    setErr(null);
    setParsed(null);
    setFilename(file.name);
    if (file.size > PROFILE_MAX_BYTES) { setErr(`That file is ${Math.round(file.size / 1024)} kB — the limit is ${PROFILE_MAX_BYTES / 1024} kB.`); return; }
    file.text()
      .then((text) => {
        const result = parseProfileFile(text, file.name);
        setRaw(text);
        if (result.error) { setErr(result.error); return; }
        setParsed(result);
      })
      .catch(() => setErr("Couldn't read that file."));
  }

  useEffect(() => { take(initialFile); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [initialFile]);

  const review = parsed?.ok ? parsed : null;
  const diff = useMemo(() => (review ? profileDiff(current, review.profile) : []), [current, review]);
  const inFile = diff.filter((d) => d.inFile);
  const leftAlone = diff.filter((d) => !d.inFile);
  const replaces = diff.filter((d) => d.kind === "replace");
  const schemaErrors = parsed && !parsed.ok && parsed.errors.length ? parsed.errors : [];

  async function unpack() {
    if (!review) return;
    setBusy(true);
    setErr(null);
    try {
      const { setup: patch } = profileToSetupPatch(review.profile);
      await setDoc(
        paths.careerOpsSetup(uid),
        { ...patch, profileYaml: buildSetupProfileYaml({ profile, setup, overrides: patch }), updatedAt: Date.now() },
        { merge: true },
      );
      onDone(inFile.filter((d) => d.kind !== "keep").map((d) => d.key));
    } catch {
      setErr("Couldn't save that — check your connection and try again.");
      setBusy(false);
    }
  }

  const footer = review ? (
    <SheetFooter
      primary={{ label: "Unpack it", onClick: unpack, busy, busyLabel: "Unpacking…" }}
      secondary={{ label: "Pick a different file", onClick: () => { setParsed(null); setErr(null); }, disabled: busy }}
    />
  ) : undefined;

  return (
    <Sheet
      title="Upload your profile"
      eyebrow={review ? "Step 2 of 2 · Review" : "Step 1 of 2 · Pick a file"}
      description={review ? undefined : "One .yml with everything in it. It is read in your browser and nothing is saved until you confirm."}
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

      {schemaErrors.length > 0 && (
        <div role="alert" className="mb-4 rounded-sm border border-jh-red/30 bg-jh-red/5 px-3 py-2.5 text-sm">
          <p className="flex items-start gap-2 font-semibold text-jh-red">
            <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" /> <code className="font-mono text-xs">{filename}</code>&nbsp;doesn&apos;t match the profile shape
          </p>
          <ul className="mt-2 space-y-1 pl-6">
            {schemaErrors.slice(0, MAX_ERRORS).map((e, i) => (
              <li key={i} className="text-jh-ink">
                <code className="font-mono text-xs text-jh-red">{e.path || "file"}</code> — {e.message}
              </li>
            ))}
            {schemaErrors.length > MAX_ERRORS && <li className="text-jh-mute">and {schemaErrors.length - MAX_ERRORS} more</li>}
          </ul>
          <p className="mt-2 pl-6 text-jh-mute">
            Data can be missing; the shape can&apos;t be wrong. Fix the file and drop it again, or{" "}
            <a href="/profile.example.yml" download className="link text-sm">download the example</a>.
          </p>
        </div>
      )}

      {!review ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
          className={`rounded-sm border-[1.5px] border-dashed p-8 text-center transition-colors ${over ? "border-jh-red bg-jh-red/5" : "border-jh-line-2"}`}
        >
          <p className="text-sm text-jh-ink">Drop your profile here</p>
          <p className="text-xs text-jh-mute mt-1">.yml · up to {PROFILE_MAX_BYTES / 1024} kB</p>
          <label className="btn-secondary mt-4 inline-flex text-xs px-3 py-2 cursor-pointer">
            <Upload className="h-3.5 w-3.5" /> Choose a file
            <input ref={fileRef} type="file" accept={PROFILE_ACCEPT} className="sr-only" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <p className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-jh-mute"><Lock className="h-3 w-3" /> Read in your browser. Nothing is saved until you confirm.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-jh-ink">Found in <code className="font-mono text-xs">{filename}</code></p>
            <p className="text-xs text-jh-mute mt-0.5">Anything the file doesn&apos;t mention is left exactly as it is.</p>
          </div>

          <ul className="card divide-y divide-jh-line">
            {inFile.map((d) => <DiffRow key={d.key} d={d} />)}
          </ul>

          {leftAlone.length > 0 && (
            <p className="text-xs text-jh-mute">
              Not in the file, left as it is: {leftAlone.map((d) => findSection(d.key)?.label.toLowerCase()).join(", ")}.
            </p>
          )}

          {review.warnings.length > 0 && (
            <ul className="space-y-1">
              {review.warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 text-xs text-jh-mute">
                  <TriangleAlert className="h-3 w-3 shrink-0 mt-0.5 text-jh-red" /> {w}
                </li>
              ))}
            </ul>
          )}

          {diffReplaces(diff) && (
            <div className="rounded-sm bg-jh-mist px-4 py-3 text-sm">
              <p className="text-jh-ink">
                Replacing {replaces.length} {replaces.length === 1 ? "section" : "sections"}. Want a copy of what you have now?
              </p>
              <button type="button" onClick={onDownloadCurrent} className="link mt-1 inline-flex items-center gap-1 text-sm">
                <Download className="h-3.5 w-3.5" /> Download current profile
              </button>
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-jh-mute hover:text-jh-ink">Show the raw file</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-sm border border-jh-line bg-jh-mist/40 p-3 font-mono text-xs text-jh-ink whitespace-pre-wrap">{raw}</pre>
          </details>
        </div>
      )}
    </Sheet>
  );
}

function DiffRow({ d }: { d: SectionDiff }) {
  const Icon = KIND_ICON[d.kind];
  const label = findSection(d.key)?.label ?? d.key;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${KIND_TONE[d.kind]}`} strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display font-semibold text-[15px] text-jh-ink">{label}</span>
          <span className="text-sm text-jh-mute">{d.headline}</span>
        </span>
        {d.detail && <span className="block truncate text-sm text-jh-ink">{d.detail}</span>}
        <span className="sr-only">{d.kind === "add" ? "adds" : d.kind === "replace" ? "replaces" : "unchanged"}</span>
      </span>
    </li>
  );
}
