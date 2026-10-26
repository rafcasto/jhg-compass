"use client";

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { Check, Save, TriangleAlert } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// The `notes` section of the profile — free text every agent reads. Until the
// Profile page existed it was only editable inside the full Setup screen.
// Same recipe as WatchlistPanel: local draft, one Save, merge write.

export default function NotesPanel({ uid, setup, profile }: { uid: string; setup: CareerOpsSetupV2 | null; profile: Profile | null | undefined }) {
  const [notes, setNotes] = useState(setup?.notes ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const next = notes.trim();
      await setDoc(
        paths.careerOpsSetup(uid),
        { notes: next, profileYaml: buildSetupProfileYaml({ profile, setup, overrides: { notes: next } }), updatedAt: Date.now() },
        { merge: true },
      );
      setDirty(false);
      setMsg("Saved. Every agent reads these on its next run.");
    } catch {
      setMsg("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-jh-mute text-sm max-w-2xl">
        One line per rule works best. Hard no&apos;s, culture must-haves, companies you will never apply to, how your CV must be written.
      </p>
      <label className="block">
        <span className="label">Notes</span>
        <textarea
          className="field text-sm min-h-[10rem]"
          value={notes}
          placeholder={"Hard no's (do not apply): on-site 5 days; defence or gambling\nNotice period: 28 days\nNever apply: Rapid Freight Systems\nCV house rules: numbers never rounded; one page when tailored"}
          onChange={(e) => { setNotes(e.target.value); setDirty(true); setMsg(null); }}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save notes"}
        </button>
        {msg && (
          <p role="status" className={`flex items-start gap-1.5 text-sm ${msg.startsWith("Saved") ? "text-rb-green-dark" : "text-jh-red"}`}>
            {msg.startsWith("Saved") ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />} {msg}
          </p>
        )}
      </div>
    </div>
  );
}
