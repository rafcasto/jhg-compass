"use client";

import { useEffect, useMemo, useState } from "react";
import { setDoc } from "firebase/firestore";
import { Save } from "lucide-react";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { useAuth } from "@/components/AuthProvider";
import { buildProfileYaml } from "@/lib/careerops/profile-yaml";
import { buildPortalsYaml, suggestKeywords, DEFAULT_NEGATIVE } from "@/lib/careerops/portals-yaml";
import type { CareerOpsPortals, CareerOpsSetupV2, PortalsStatusDoc } from "@/lib/careerops/types";
import Portals from "./Portals";
import StandardAnswers from "./StandardAnswers";
import type { Profile } from "@/lib/types";

// Agents → Setup. The CV is the one thing the Evaluator cannot work without;
// profile.yml is generated from the Compass goal so it never has to be typed.
export default function Setup({ onReady }: { onReady?: () => void }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: setup, loading } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: portalsStatus } = useLiveDoc<PortalsStatusDoc>(uid ? paths.careerOpsPortalsStatus(uid) : null);
  const [cv, setCv] = useState("");
  const [notes, setNotes] = useState("");
  const [portals, setPortals] = useState<CareerOpsPortals>({ companies: [], positive: [], negative: DEFAULT_NEGATIVE });
  const [portalsSeeded, setPortalsSeeded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showYaml, setShowYaml] = useState(false);

  useEffect(() => {
    if (setup && !dirty) { setCv(setup.cvMarkdown ?? ""); setNotes(setup.notes ?? ""); if (setup.portals) { setPortals(setup.portals); setPortalsSeeded(true); } }
  }, [setup, dirty]);
  // First time: seed the include keywords from the Compass goal role.
  useEffect(() => {
    if (portalsSeeded || !profile || setup?.portals) return;
    const positive = suggestKeywords(profile.goal?.role);
    if (positive.length) { setPortals((p) => ({ ...p, positive })); setPortalsSeeded(true); }
  }, [profile, setup, portalsSeeded]);

  const yaml = useMemo(() => buildProfileYaml({ profile, goal: profile?.goal, notes }), [profile, notes]);

  async function save() {
    if (!uid || !cv.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const doc: CareerOpsSetupV2 = { cvMarkdown: cv.trim(), profileYaml: yaml, notes: notes.trim(), portals, portalsYaml: buildPortalsYaml(portals), updatedAt: Date.now() };
      await setDoc(paths.careerOpsSetup(uid), doc);
      setDirty(false); setMsg("Saved. The agents will use this CV from your next evaluation.");
      onReady?.();
    } catch { setMsg("Couldn't save — try again."); }
    finally { setBusy(false); }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    const text = await f.text();
    setCv(text); setDirty(true);
  }

  if (loading) return <p className="text-jh-mute animate-pulse">Loading your setup…</p>;
  const words = cv.trim() ? cv.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-5">
      <section className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg">Your CV</h2>
            <p className="text-jh-mute text-sm mt-1 max-w-2xl">Paste your CV as plain text or Markdown (headings, bullets). The Evaluator quotes lines from it as evidence, so keep the detail — dates, numbers, tools. It stays on our own hardware.</p>
          </div>
          <label className="btn-secondary text-xs px-3 py-2 cursor-pointer">Upload .md / .txt<input type="file" accept=".md,.txt,.markdown,text/plain,text/markdown" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} /></label>
        </div>
        <textarea aria-label="Your CV" className="field font-mono text-xs min-h-[22rem]" placeholder={"# Jane Smith\nSenior Product Owner · Auckland\n\n## Experience\n**Acme — Product Owner (2021–2025)**\n- Led …"} value={cv} onChange={(e) => { setCv(e.target.value); setDirty(true); setMsg(null); }} />
        <p className="text-xs text-jh-mute-2">{words} words{setup?.updatedAt ? ` · last saved ${new Date(setup.updatedAt).toLocaleString()}` : ""}</p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg">Profile for the agents</h2>
        <p className="text-jh-mute text-sm max-w-2xl">Built from your Compass goal — role <strong className="text-jh-ink">{profile?.goal?.role || "—"}</strong>, industry <strong className="text-jh-ink">{profile?.goal?.subsector || "—"}</strong>, geography <strong className="text-jh-ink">{profile?.goal?.city || "—"}</strong>, salary <strong className="text-jh-ink">{profile?.goal?.salary || "—"}</strong>. Change those on the Compass tab.</p>
        <label className="block">
          <span className="label">Anything else the agents should know <span className="font-normal text-jh-mute">(optional)</span></span>
          <textarea className="field text-sm min-h-[5rem]" placeholder="e.g. Need visa sponsorship outside NZ. Remote only. Walk-away salary 150k. Avoid agencies." value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); setMsg(null); }} />
        </label>
        <button type="button" onClick={() => setShowYaml((v) => !v)} className="btn-ghost text-xs">{showYaml ? "Hide" : "Show"} generated profile.yml</button>
        {showYaml && <pre className="text-xs bg-jh-mist rounded-md p-3 overflow-auto max-h-64">{yaml}</pre>}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg">Standard answers</h2>
        <p className="text-jh-mute text-sm max-w-2xl">The questions every application form asks and the agents must never guess. Answer once; the Apply screen fills them in on every form and tells you which answer it reused. Anything you type into an answer box on the Apply screen is remembered the same way.</p>
        {uid && <StandardAnswers uid={uid} />}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg">Company watchlist for the Scout</h2>
        <p className="text-jh-mute text-sm max-w-2xl">Companies whose careers pages the Scout checks for new postings that match your title keywords. Zero AI tokens — job boards are read directly; other careers pages are opened in the Pi&apos;s browser. Paste the careers page you&apos;d find on Google: if it hides a job board, the Scout finds it and offers it on the row.{portalsStatus?.at ? ` Last scan ${new Date(portalsStatus.at).toLocaleString()}.` : ""}</p>
        <Portals value={portals} onChange={(v) => { setPortals(v); setDirty(true); setMsg(null); }} status={portalsStatus?.companies ?? []} suggested={suggestKeywords(profile?.goal?.role)} />
      </section>

      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={save} disabled={busy || !cv.trim() || !dirty} className="btn-primary disabled:opacity-60"><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save setup"}</button>
        {msg && <p role="status" className={`text-sm ${msg.startsWith("Saved") ? "text-rb-green-dark" : "text-jh-red"}`}>{msg}</p>}
      </div>
    </div>
  );
}
