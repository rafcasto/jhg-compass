"use client";

import { useRef, useState } from "react";
import { setDoc } from "firebase/firestore";
import { ArrowLeft, Check, FileUp, Lock, TriangleAlert, Upload } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import { MALETA_MAX_BYTES, maletaToSetupPatch, parseMaleta, type MaletaParse } from "@/lib/careerops/maleta";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// Path 3: upload la maleta. Accepts a maleta Compass exported, a career-ops
// config/profile.yml, or a modes/_profile.md.
//
// The file is untrusted. It is read in the browser, parsed into the maleta
// shape by lib/careerops/maleta.ts (which validates every field through the
// same functions the forms use), and shown back for confirmation before a
// single byte is written. Nothing in the file is ever executed or obeyed.

const ACCEPT = ".md,.markdown,.yml,.yaml,text/markdown,text/plain,application/yaml";
const READABLE = /\.(md|markdown|ya?ml)$/i;

export default function MaletaUpload({ uid, setup, profile, onDone, onBack }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  profile: Profile | null | undefined;
  onDone: () => void;
  onBack: () => void;
}) {
  const [parsed, setParsed] = useState<MaletaParse | null>(null);
  const [filename, setFilename] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function take(file: File | undefined) {
    if (!file) return;
    setErr(null);
    setParsed(null);
    if (!READABLE.test(file.name)) {
      setErr("La maleta is a .md or .yml file. Export yours from CareerOps, or bring a career-ops config/profile.yml or modes/_profile.md.");
      return;
    }
    if (file.size > MALETA_MAX_BYTES) {
      setErr(`That file is ${Math.round(file.size / 1024)} kB — the limit is ${MALETA_MAX_BYTES / 1024} kB.`);
      return;
    }
    file.text()
      .then((text) => {
        const result = parseMaleta(text, file.name);
        setFilename(file.name);
        if (!result.ok) { setErr(result.error ?? "Couldn't read that file."); return; }
        setParsed(result);
      })
      .catch(() => setErr("Couldn't read that file."));
  }

  async function apply() {
    if (!parsed?.ok) return;
    setBusy(true);
    setErr(null);
    try {
      const { setup: patch } = maletaToSetupPatch(parsed.maleta);
      await setDoc(
        paths.careerOpsSetup(uid),
        {
          ...patch,
          // Rebuilt from the one place that knows every field, with the patch
          // applied — so the agents get the unpacked maleta immediately.
          profileYaml: buildSetupProfileYaml({ profile, setup, overrides: patch }),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      onDone();
    } catch {
      setErr("Couldn't save that — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="flex items-center gap-2 text-lg"><FileUp className="h-4 w-4 text-jh-red" /> Upload la maleta</h2>
          <p className="text-jh-mute text-sm mt-1 max-w-2xl">
            Everything in one file. We&apos;ll read what&apos;s there and show you before saving anything — a maleta exported
            from here, a career-ops <code className="text-xs">config/profile.yml</code>, or a{" "}
            <code className="text-xs">modes/_profile.md</code>.
          </p>
        </div>
        <button type="button" onClick={onBack} className="btn-ghost text-xs"><ArrowLeft className="h-3.5 w-3.5" /> Other ways to start</button>
      </div>

      {err && (
        <p role="alert" className="flex items-start gap-2 rounded-[10px] border border-jh-red/30 bg-jh-red/5 px-3 py-2.5 text-sm text-jh-red">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" /> {err}
        </p>
      )}

      {!parsed ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
          className={`rounded-[10px] border-[1.5px] border-dashed p-8 text-center transition-colors ${over ? "border-jh-red bg-jh-red/5" : "border-jh-line-2"}`}
        >
          <p className="text-sm text-jh-ink">Drop your maleta here</p>
          <p className="text-xs text-jh-mute mt-1">.md or .yml · up to {MALETA_MAX_BYTES / 1024} kB</p>
          <label className="btn-secondary mt-4 inline-flex text-xs px-3 py-2 cursor-pointer">
            <Upload className="h-3.5 w-3.5" /> Choose a file
            <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
          </label>
          <p className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-jh-mute-2"><Lock className="h-3 w-3" /> Read in your browser. Nothing is saved until you confirm.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[10px] border border-jh-line bg-jh-mist/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-jh-ink">
              Found in <code className="text-xs">{filename}</code> <span className="font-normal text-jh-mute">({parsed.format})</span>
            </p>
            <ul className="space-y-1">
              {parsed.found.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-jh-ink">
                  <Check className="h-3.5 w-3.5 shrink-0 text-rb-green-dark" /> {f}
                </li>
              ))}
            </ul>
            {parsed.warnings.length > 0 && (
              <ul className="space-y-1 border-t border-jh-line pt-2">
                {parsed.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-xs text-jh-mute">
                    <TriangleAlert className="h-3 w-3 shrink-0 mt-0.5 text-jh-red" /> {w}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-jh-mute-2">
            Anything the file doesn&apos;t mention is left exactly as it is — unpacking a maleta never clears what you already had.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={apply} disabled={busy} className="btn-primary text-sm disabled:opacity-60">
              <Check className="h-4 w-4" /> {busy ? "Unpacking…" : "Unpack it"}
            </button>
            <button type="button" onClick={() => { setParsed(null); setErr(null); }} className="btn-ghost text-xs">Pick a different file</button>
          </div>
        </div>
      )}
    </section>
  );
}
