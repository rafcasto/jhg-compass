"use client";

import { useMemo, useState } from "react";
import { setDoc } from "firebase/firestore";
import { Check, Plus, Save, Target, TriangleAlert, X } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { buildSetupProfileMd, buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import {
  SECTION_COPY,
  coercePersonalization,
  personalizationProgress,
  type FramingRow,
  type Personalization as P,
  type TargetRoleRow,
} from "@/lib/careerops/personalization";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// The eight `## Your …` sections of career-ops' modes/_profile.md — the file
// evaluations score against. Upstream fills these conversationally through its
// assistant; Compass has no assistant in the portal, so this is the guided form
// equivalent. Field names, caps and rendered shapes all live in
// lib/careerops/personalization.ts, which is a direct port of upstream's module
// — this component only collects.

const MAX = { targetRoles: 8, adaptiveFraming: 8, negotiationScripts: 6, locationPolicy: 8 };

function Section({ id, children }: { id: keyof typeof SECTION_COPY; children: React.ReactNode }) {
  const { label, ask } = SECTION_COPY[id];
  return (
    <section className="space-y-3 border-t border-jh-line pt-5 first:border-0 first:pt-0">
      <div>
        <h3 className="font-display font-semibold text-jh-ink">{label}</h3>
        <p className="text-xs text-jh-mute mt-0.5 max-w-2xl">{ask}</p>
      </div>
      {children}
    </section>
  );
}

function Area({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder: string; rows?: number }) {
  return <textarea className="field text-sm" style={{ minHeight: `${rows * 1.8}rem` }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/** A repeatable list of single-line entries (scripts, location rules). */
function LineList({ label, value, onChange, max, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; max: number; placeholder: string }) {
  return (
    <div className="space-y-2">
      {value.map((line, i) => (
        <div key={i} className="flex items-start gap-2">
          <input aria-label={`${label} ${i + 1}`} className="field text-sm" value={line} placeholder={placeholder} onChange={(e) => onChange(value.map((l, j) => (j === i ? e.target.value : l)))} />
          <button type="button" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="btn-ghost px-2 py-2 text-jh-mute hover:text-jh-red">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {value.length < max && (
        <button type="button" onClick={() => onChange([...value, ""])} className="btn-secondary text-xs px-3 py-1.5">
          <Plus className="h-3.5 w-3.5" /> Add {label.toLowerCase()}
        </button>
      )}
      <p className="text-xs text-jh-mute-2">{value.length} of {max} added</p>
    </div>
  );
}

export default function Personalization({ uid, setup, profile }: { uid: string; setup: CareerOpsSetupV2 | null; profile: Profile | null | undefined }) {
  const saved = setup?.personalization ?? {};
  const [roles, setRoles] = useState<TargetRoleRow[]>(saved.targetRoles ?? []);
  const [framing, setFraming] = useState<FramingRow[]>(saved.adaptiveFraming ?? []);
  const [exitNarrative, setExit] = useState(saved.exitNarrative ?? "");
  const [cross, setCross] = useState(saved.crossCuttingAdvantage ?? "");
  const [portfolio, setPortfolio] = useState(saved.portfolio ?? { url: "", description: "", whenToShare: "" });
  const [compTargets, setComp] = useState(saved.compTargets ?? "");
  const [scripts, setScripts] = useState<string[]>(saved.negotiationScripts ?? []);
  const [locationPolicy, setLocation] = useState<string[]>(saved.locationPolicy ?? []);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const touch = () => { setDirty(true); setMsg(null); };

  // Validated through the same function that will be stored, so the counter
  // cannot say "filled" for something the writer will reject.
  const draft = useMemo<P>(
    () => coercePersonalization({ targetRoles: roles, adaptiveFraming: framing, exitNarrative, crossCuttingAdvantage: cross, portfolio, compTargets, negotiationScripts: scripts, locationPolicy }),
    [roles, framing, exitNarrative, cross, portfolio, compTargets, scripts, locationPolicy],
  );
  const progress = personalizationProgress(draft);
  const badUrl = !!portfolio.url?.trim() && !/^https?:\/\//i.test(portfolio.url.trim());

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await setDoc(
        paths.careerOpsSetup(uid),
        {
          personalization: draft,
          profileMd: buildSetupProfileMd({ setup, overrides: { personalization: draft } }),
          profileYaml: buildSetupProfileYaml({ profile, setup, overrides: { personalization: draft } }),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      setDirty(false);
      setMsg(`Saved — ${progress.done} of ${progress.total} sections filled in.`);
    } catch {
      setMsg("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="text-jh-mute text-sm max-w-2xl">
            Your CV says what you&apos;ve done. This says what you&apos;re going for and how to argue it — the agents score every
            posting against it. Leave a section blank and it is treated as unknown, never guessed.
          </p>
        </div>
        <span className="font-mono text-xs text-jh-mute" aria-label={`${progress.done} of ${progress.total} sections filled in`}>{progress.done}/{progress.total}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-pill bg-jh-mist">
        <div className="h-full rounded-pill bg-jh-red transition-[width]" style={{ width: `${progress.pct}%` }} />
      </div>

      <Section id="targetRoles">
        <div className="space-y-3">
          {roles.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-start">
              <input aria-label={`Archetype ${i + 1}`} className="field text-sm" placeholder="Archetype — e.g. AI Platform / LLMOps" value={r.archetype} onChange={(e) => { setRoles(roles.map((x, j) => (j === i ? { ...x, archetype: e.target.value } : x))); touch(); }} />
              <input aria-label={`Thematic axes ${i + 1}`} className="field text-sm" placeholder="Thematic axes" value={r.axes ?? ""} onChange={(e) => { setRoles(roles.map((x, j) => (j === i ? { ...x, axes: e.target.value } : x))); touch(); }} />
              <input aria-label={`What they buy ${i + 1}`} className="field text-sm" placeholder="What they buy" value={r.buys ?? ""} onChange={(e) => { setRoles(roles.map((x, j) => (j === i ? { ...x, buys: e.target.value } : x))); touch(); }} />
              <button type="button" aria-label={`Remove archetype ${i + 1}`} onClick={() => { setRoles(roles.filter((_, j) => j !== i)); touch(); }} className="btn-ghost px-2 py-2 text-jh-mute hover:text-jh-red"><X className="h-4 w-4" /></button>
            </div>
          ))}
          {roles.length < MAX.targetRoles && (
            <button type="button" onClick={() => { setRoles([...roles, { archetype: "" }]); touch(); }} className="btn-secondary text-xs px-3 py-1.5"><Plus className="h-3.5 w-3.5" /> Add archetype</button>
          )}
        </div>
      </Section>

      <Section id="adaptiveFraming">
        <div className="space-y-3">
          {framing.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-start">
              <input aria-label={`If the role is ${i + 1}`} className="field text-sm" placeholder="If the role is…" value={r.role} onChange={(e) => { setFraming(framing.map((x, j) => (j === i ? { ...x, role: e.target.value } : x))); touch(); }} />
              <input aria-label={`Emphasize ${i + 1}`} className="field text-sm" placeholder="Emphasize about you…" value={r.emphasize} onChange={(e) => { setFraming(framing.map((x, j) => (j === i ? { ...x, emphasize: e.target.value } : x))); touch(); }} />
              <input aria-label={`Proof ${i + 1}`} className="field text-sm" placeholder="Proof (defaults to cv.md)" value={r.proof ?? ""} onChange={(e) => { setFraming(framing.map((x, j) => (j === i ? { ...x, proof: e.target.value } : x))); touch(); }} />
              <button type="button" aria-label={`Remove framing ${i + 1}`} onClick={() => { setFraming(framing.filter((_, j) => j !== i)); touch(); }} className="btn-ghost px-2 py-2 text-jh-mute hover:text-jh-red"><X className="h-4 w-4" /></button>
            </div>
          ))}
          {framing.length < MAX.adaptiveFraming && (
            <button type="button" onClick={() => { setFraming([...framing, { role: "", emphasize: "" }]); touch(); }} className="btn-secondary text-xs px-3 py-1.5"><Plus className="h-3.5 w-3.5" /> Add framing</button>
          )}
        </div>
      </Section>

      <Section id="exitNarrative">
        <label className="block">
          <span className="sr-only">Exit narrative</span>
          <Area value={exitNarrative} onChange={(v) => { setExit(v); touch(); }} placeholder="e.g. Built and sold a SaaS after five years. Now focused on applied AI at scale." rows={4} />
        </label>
      </Section>

      <Section id="crossCuttingAdvantage">
        <label className="block">
          <span className="sr-only">Cross-cutting advantage</span>
          <Area value={cross} onChange={(v) => { setCross(v); touch(); }} placeholder="e.g. Technical builder with real-world proof — I ship and I can show the metrics." />
        </label>
      </Section>

      <Section id="portfolio">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">Demo or portfolio URL</span>
            <input className="field text-sm" placeholder="https://yoursite.dev/demo" value={portfolio.url ?? ""} onChange={(e) => { setPortfolio({ ...portfolio, url: e.target.value }); touch(); }} />
            {badUrl && <span role="alert" className="mt-1 flex items-center gap-1 text-xs text-jh-red"><TriangleAlert className="h-3 w-3" /> Needs to start with http:// or https:// — the agents have to be able to open it.</span>}
          </label>
          <label className="block">
            <span className="label">What it is</span>
            <input className="field text-sm" placeholder="e.g. Agent monitoring dashboard" value={portfolio.description ?? ""} onChange={(e) => { setPortfolio({ ...portfolio, description: e.target.value }); touch(); }} />
          </label>
          <label className="block">
            <span className="label">When to share it</span>
            <input className="field text-sm" placeholder="e.g. LLMOps and platform roles" value={portfolio.whenToShare ?? ""} onChange={(e) => { setPortfolio({ ...portfolio, whenToShare: e.target.value }); touch(); }} />
          </label>
        </div>
      </Section>

      <Section id="compTargets">
        <label className="block">
          <span className="sr-only">Comp targets</span>
          <Area value={compTargets} onChange={(v) => { setComp(v); touch(); }} placeholder="e.g. NZ$180–220k base for senior PO roles in Auckland. Contract rates 30–50% higher." />
        </label>
      </Section>

      <Section id="negotiationScripts">
        <LineList label="Script" value={scripts} onChange={(v) => { setScripts(v); touch(); }} max={MAX.negotiationScripts} placeholder="e.g. I'm targeting 200k. I'm flexible on structure — what matters is the total package." />
      </Section>

      <Section id="locationPolicy">
        <LineList label="Rule" value={locationPolicy} onChange={(v) => { setLocation(v); touch(); }} max={MAX.locationPolicy} placeholder="e.g. Auckland or fully remote; no relocation outside NZ" />
      </Section>

      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-4">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save personalization"}
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
