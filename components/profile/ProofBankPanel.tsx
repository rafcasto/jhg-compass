"use client";

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { Check, Plus, Save, TriangleAlert, X } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { ARTEFACT_CAPS, PROOF_COPY, coerceProofPoints, type ProofPoint } from "@/lib/careerops/artefacts";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// Artefacts · Proof bank — docs/UX_PROFILE.md §8. One card per proof point:
// name and hero metric side by side, the CV line, the interview version, an
// optional link. Reaches career-ops as narrative.proof_points (name · url ·
// hero_metric), so the agents can quote a number instead of an adjective.

const blank = (): ProofPoint => ({ name: "" });

export default function ProofBankPanel({ uid, setup, profile }: { uid: string; setup: CareerOpsSetupV2 | null; profile: Profile | null | undefined }) {
  const [points, setPoints] = useState<ProofPoint[]>(setup?.proofPoints?.length ? setup.proofPoints : [blank()]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const touch = () => { setDirty(true); setMsg(null); };
  const update = (i: number, patch: Partial<ProofPoint>) => { setPoints(points.map((p, j) => (j === i ? { ...p, ...patch } : p))); touch(); };
  const remove = (i: number) => { setPoints(points.filter((_, j) => j !== i)); touch(); };
  const badUrl = (u: string | undefined) => !!u?.trim() && !/^https?:\/\//i.test(u.trim());

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const next = coerceProofPoints(points);
      await setDoc(
        paths.careerOpsSetup(uid),
        { proofPoints: next, profileYaml: buildSetupProfileYaml({ profile, setup, overrides: { proofPoints: next } }), updatedAt: Date.now() },
        { merge: true },
      );
      setPoints(next.length ? next : [blank()]);
      setDirty(false);
      setMsg(`Saved — ${next.length} proof ${next.length === 1 ? "point" : "points"}. Your next generated CV and cover letter can quote them.`);
    } catch {
      setMsg("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-jh-mute text-sm max-w-2xl">
        One card per proof point. The hero metric is the number a recruiter remembers; the CV line is how it reads on paper; the interview version is the telling behind it.
      </p>

      <ol className="space-y-4">
        {points.map((p, i) => (
          <li key={i} className="card space-y-4 p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_40px] items-start">
              <label className="block">
                <span className="label">Proof point {i + 1} · name</span>
                <input className="field" value={p.name} placeholder="e.g. Release-cadence programme" onChange={(e) => update(i, { name: e.target.value })} />
              </label>
              <label className="block">
                <span className="label">{PROOF_COPY.metric.label}</span>
                <input aria-label={`${PROOF_COPY.metric.label} ${i + 1}`} className="field" value={p.metric ?? ""} placeholder={PROOF_COPY.metric.placeholder} onChange={(e) => update(i, { metric: e.target.value })} />
              </label>
              <button type="button" aria-label={`Remove proof point ${i + 1}`} onClick={() => remove(i)} className="icon-btn icon-btn-danger justify-self-end sm:justify-self-auto sm:mt-5"><X className="h-4 w-4" aria-hidden /></button>
            </div>
            <label className="block">
              <span className="label">{PROOF_COPY.short.label}</span>
              <input aria-label={`${PROOF_COPY.short.label} ${i + 1}`} className="field text-sm" value={p.short ?? ""} placeholder={PROOF_COPY.short.placeholder} onChange={(e) => update(i, { short: e.target.value })} />
              <span className="block text-xs text-jh-mute mt-1">{PROOF_COPY.short.hint}</span>
            </label>
            <label className="block">
              <span className="label">{PROOF_COPY.long.label}</span>
              <textarea aria-label={`${PROOF_COPY.long.label} ${i + 1}`} className="field text-sm min-h-[5.5rem]" value={p.long ?? ""} placeholder={PROOF_COPY.long.placeholder} onChange={(e) => update(i, { long: e.target.value })} />
              <span className="block text-xs text-jh-mute mt-1">{PROOF_COPY.long.hint}</span>
            </label>
            <label className="block">
              <span className="label">{PROOF_COPY.url.label}<span className="font-normal normal-case tracking-normal text-jh-mute"> · optional</span></span>
              <input aria-label={`${PROOF_COPY.url.label} ${i + 1}`} className="field text-sm" value={p.url ?? ""} placeholder={PROOF_COPY.url.placeholder} onChange={(e) => update(i, { url: e.target.value })} />
              {badUrl(p.url) && <span role="alert" className="mt-1 flex items-center gap-1 text-xs text-jh-red"><TriangleAlert className="h-3 w-3" aria-hidden /> Needs to start with http:// or https:// — otherwise the link is left out and the proof point kept.</span>}
            </label>
          </li>
        ))}
      </ol>

      {points.length < ARTEFACT_CAPS.proofPoints && (
        <button type="button" onClick={() => { setPoints([...points, blank()]); touch(); }} className="btn-secondary btn-sm"><Plus className="h-4 w-4" aria-hidden /> Add proof point</button>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" aria-hidden /> {busy ? "Saving…" : "Save proof bank"}
        </button>
        {msg && (
          <p role="status" className={`flex items-start gap-1.5 text-sm ${msg.startsWith("Saved") ? "text-rb-green-dark" : "text-jh-red"}`}>
            {msg.startsWith("Saved") ? <Check className="h-4 w-4 shrink-0 mt-0.5" aria-hidden /> : <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />} {msg}
          </p>
        )}
      </div>
    </div>
  );
}
