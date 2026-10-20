"use client";

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { Check, Save, TriangleAlert } from "lucide-react";
import Portals from "@/components/agents/Portals";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { buildPortalsYaml, suggestKeywords, DEFAULT_NEGATIVE } from "@/lib/careerops/portals-yaml";
import type { CareerOpsPortals, CareerOpsSetupV2, PortalsStatusDoc } from "@/lib/careerops/types";

// The watchlist step. Reuses the same Portals editor the Setup screen uses, so
// the two cannot drift — only the save differs: this writes with merge, where
// Setup replaces the whole document.

export default function WatchlistPanel({ uid, setup, goalRole }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  goalRole?: string | null;
}) {
  const { data: status } = useLiveDoc<PortalsStatusDoc>(uid ? paths.careerOpsPortalsStatus(uid) : null);
  const [portals, setPortals] = useState<CareerOpsPortals>(
    setup?.portals ?? { companies: [], positive: suggestKeywords(goalRole ?? undefined), negative: DEFAULT_NEGATIVE },
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await setDoc(
        paths.careerOpsSetup(uid),
        { portals, portalsYaml: buildPortalsYaml(portals), updatedAt: Date.now() },
        { merge: true },
      );
      setDirty(false);
      setMsg(portals.companies.length
        ? `Saved — the Scout will check ${portals.companies.length} ${portals.companies.length === 1 ? "company" : "companies"} on its next run.`
        : "Saved. Add at least one company and the Scout has somewhere to look.");
    } catch {
      setMsg("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-jh-mute text-sm max-w-2xl">
        Careers pages the Scout checks for new postings that match your North Star. Zero AI tokens — job boards are read
        directly, and other careers pages are opened in the Pi&apos;s browser.
        {status?.at ? ` Last scan ${new Date(status.at).toLocaleString()}.` : ""}
      </p>

      <Portals
        value={portals}
        onChange={(v) => { setPortals(v); setDirty(true); setMsg(null); }}
        status={status?.companies ?? []}
        suggested={suggestKeywords(goalRole ?? undefined)}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save watchlist"}
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
