"use client";

import { useEffect, useMemo, useState } from "react";
import { setDoc } from "firebase/firestore";
import { Check, Plus, Save, TriangleAlert, X } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { goalWrites } from "@/lib/careerops/goal-save";
import { coercePersonalization, type FramingRow, type TargetRoleRow } from "@/lib/careerops/personalization";
import { FramingRows, LineList, MAX } from "@/components/careerops/Personalization";
import { buildSetupProfileMd, buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsPolicy, CareerOpsSetupV2 } from "@/lib/careerops/types";
import { COMPANY_TYPES, EMPTY_GOAL, type Goal } from "@/lib/goal";
import { jhGoal } from "@/lib/jobhacking/sections";
import type { Profile } from "@/lib/types";

// The six True North sections — docs/UX_JOBHACKING.md §3. Each one is a few
// fields from up to three stored objects (the goal, policy, personalization),
// and its Save writes ONLY those fields over what is stored, so no section can
// wipe another's. Target roles carries the adaptive framing per archetype and
// Salary range the negotiation scripts (decision 2026-11-07,
// docs/UX_SETTINGS_HUB.md §1): the field sits where its question is asked.
//
// The goal has two homes (lib/careerops/goal-save.ts): the Compass goal on
// users/{uid}, and the intake override on the setup document — which an
// uploaded true-north.yml sets. A save here edits whichever is in effect, so the
// statement, the Compass tab and the agents' profile.yml all move together —
// and while the member types, the draft goes up to the statement (`onDraft`)
// so it reads the new title before Save (2026-11-07).

export type TrueNorthSection = "industry" | "roles" | "seniority" | "salary" | "location" | "company-type";

const MAX_ROLES = 8;
const MAX_RULES = 8;

const SAVE_LABEL: Record<TrueNorthSection, string> = {
  industry: "Save target industry", roles: "Save target roles", seniority: "Save seniority", salary: "Save salary range", location: "Save location", "company-type": "Save company type",
};

const cleanRows = (rows: TargetRoleRow[]) => rows.map((r) => ({ archetype: r.archetype.trim(), axes: r.axes?.trim() || undefined, buys: r.buys?.trim() || undefined })).filter((r) => r.archetype);
const cleanLines = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);
const cleanFraming = (rows: FramingRow[]) => rows.map((r) => ({ role: r.role.trim(), emphasize: r.emphasize.trim(), proof: r.proof?.trim() || undefined })).filter((r) => r.role && r.emphasize);

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs text-jh-mute mt-1">{children}</span>;
}

export default function TrueNorthPanel({ uid, setup, profile, section, onDraft }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  profile: Profile | null | undefined;
  section: TrueNorthSection;
  /** The goal fields this section is editing, as typed — the statement previews them. Called with {} when the editor leaves. */
  onDraft?: (draft: Partial<Goal>) => void;
}) {
  const live = useMemo(() => jhGoal({ setup, profile }), [setup, profile]);
  const [goal, setGoal] = useState<Goal>({ ...EMPTY_GOAL, ...live });
  const [policy, setPolicy] = useState<CareerOpsPolicy>(setup?.policy ?? {});
  const [roles, setRoles] = useState<TargetRoleRow[]>(setup?.personalization?.targetRoles ?? []);
  const [framing, setFraming] = useState<FramingRow[]>(setup?.personalization?.adaptiveFraming ?? []);
  const [compTargets, setComp] = useState(setup?.personalization?.compTargets ?? "");
  const [scripts, setScripts] = useState<string[]>(setup?.personalization?.negotiationScripts ?? []);
  const [rules, setRules] = useState<string[]>(setup?.personalization?.locationPolicy ?? []);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const touch = () => { setDirty(true); setMsg(null); };
  const setG = (k: keyof Goal, v: string) => { setGoal((g) => { const next = { ...g, [k]: v }; onDraft?.(pickGoal(section, next)); return next; }); touch(); };
  // Leaving the section takes the preview with it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onDraft?.({}), []);
  const setP = (k: "minimumSalary" | "locationFlexibility", v: string) => { setPolicy((p) => ({ ...p, [k]: v })); touch(); };

  // A company type the list doesn't know (an uploaded "Scale-up") must stay selectable, not vanish.
  const typeOptions = useMemo(() => {
    const cur = goal.companyType?.trim();
    return cur && !(COMPANY_TYPES as readonly string[]).includes(cur) ? [cur, ...COMPANY_TYPES] : [...COMPANY_TYPES];
  }, [goal.companyType]);

  // Which stored objects this section touches (every section touches the goal).
  const touchesPolicy = section === "salary" || section === "location";
  const touchesPersonalization = section === "roles" || section === "salary" || section === "location";

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const now = Date.now();
      // The home in effect gets the goal; the other is never written over.
      const writes = goalWrites({ setup, profile }, { ...live, ...pickGoal(section, goal) }, now);
      const patch: Partial<CareerOpsSetupV2> = { ...writes.setupPatch };
      const nextProfile = writes.nextProfile;

      if (touchesPolicy) {
        const next: CareerOpsPolicy = { ...(setup?.policy ?? {}) };
        for (const k of section === "salary" ? (["minimumSalary"] as const) : (["locationFlexibility"] as const)) {
          const v = (policy[k] ?? "").trim();
          if (v) next[k] = v; else delete next[k];
        }
        patch.policy = next;
      }

      if (touchesPersonalization) {
        const next: Record<string, unknown> = { ...(setup?.personalization ?? {}) };
        if (section === "roles") { next.targetRoles = cleanRows(roles); next.adaptiveFraming = cleanFraming(framing); }
        if (section === "salary") { next.compTargets = compTargets.trim(); next.negotiationScripts = cleanLines(scripts); }
        if (section === "location") next.locationPolicy = cleanLines(rules);
        patch.personalization = coercePersonalization(next);
        patch.profileMd = buildSetupProfileMd({ setup, overrides: { personalization: patch.personalization } });
      }

      await setDoc(
        paths.careerOpsSetup(uid),
        { ...patch, profileYaml: buildSetupProfileYaml({ profile: nextProfile, setup, overrides: patch }), updatedAt: now },
        { merge: true },
      );
      if (writes.profilePatch) await setDoc(paths.profile(uid), writes.profilePatch, { merge: true });
      setDirty(false);
      setMsg("Saved. Your statement and the agents' profile follow it.");
    } catch {
      setMsg("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {section === "roles" && (
        <>
          <label className="block max-w-2xl">
            <span className="label">Job title</span>
            <input className="field" value={goal.role ?? ""} placeholder="e.g. Customer Success Manager" onChange={(e) => setG("role", e.target.value)} />
            <Hint>The title in your statement. Put the level under Seniority, not here.</Hint>
          </label>
          <div className="space-y-3 border-t border-jh-line pt-4">
            <div>
              <p className="font-display font-semibold text-jh-ink">Role archetypes</p>
              <p className="text-xs text-jh-mute mt-0.5 max-w-2xl">The kinds of role behind that title — what each one is really about, and what a company is buying when it hires for it.</p>
            </div>
            {roles.length > 0 && (
              <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1fr_40px] gap-2" aria-hidden>
                {["Archetype", "Thematic axes", "What they buy"].map((c) => <span key={c} className="label mb-0">{c}</span>)}
              </div>
            )}
            {roles.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_40px] sm:items-center rounded-sm border border-jh-line p-3 sm:border-0 sm:p-0">
                {([["archetype", "Archetype", "e.g. Customer Success Manager"], ["axes", "Thematic axes", "e.g. net revenue retention, health scoring"], ["buys", "What they buy", "e.g. Enterprise accounts kept and grown"]] as const).map(([k, label, ph]) => (
                  <label key={k} className="block">
                    <span className="label sm:sr-only">{label} {i + 1}</span>
                    <input className="field text-sm" placeholder={ph} value={r[k] ?? ""} onChange={(e) => { setRoles(roles.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x))); touch(); }} />
                  </label>
                ))}
                <button type="button" aria-label={`Remove archetype ${i + 1}`} onClick={() => { setRoles(roles.filter((_, j) => j !== i)); touch(); }} className="icon-btn icon-btn-danger justify-self-end sm:justify-self-auto"><X className="h-4 w-4" aria-hidden /></button>
              </div>
            ))}
            {roles.length < MAX_ROLES && (
              <button type="button" onClick={() => { setRoles([...roles, { archetype: "" }]); touch(); }} className="btn-secondary btn-sm"><Plus className="h-4 w-4" aria-hidden /> Add archetype</button>
            )}
            <p className="text-xs text-jh-mute">{roles.length} of {MAX_ROLES} added</p>
          </div>
          <div className="space-y-3 border-t border-jh-line pt-4">
            <div>
              <p className="font-display font-semibold text-jh-ink">Adaptive framing</p>
              <p className="text-xs text-jh-mute mt-0.5 max-w-2xl">For each archetype: what to emphasise about you, and which part of your CV proves it.</p>
            </div>
            <FramingRows value={framing} onChange={(v) => { setFraming(v); touch(); }} />
          </div>
        </>
      )}

      {section === "seniority" && (
        <label className="block max-w-md">
          <span className="label">Seniority level</span>
          <input className="field" value={goal.seniority ?? ""} placeholder="e.g. Senior" onChange={(e) => setG("seniority", e.target.value)} />
          <Hint>Goes in front of your job title in the statement. If the title already starts with it, it isn&apos;t repeated.</Hint>
        </label>
      )}

      {section === "salary" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Salary range</span>
            <input className="field" value={goal.salary ?? ""} placeholder="e.g. AUD 140,000–165,000" onChange={(e) => setG("salary", e.target.value)} />
            <Hint>The number in your statement, yearly before tax.</Hint>
          </label>
          <label className="block">
            <span className="label">Salary floor</span>
            <input className="field" value={policy.minimumSalary ?? ""} placeholder="e.g. AUD 130,000" onChange={(e) => setP("minimumSalary", e.target.value)} />
            <Hint>The number below which you walk. Scoring weighs an offer against it.</Hint>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Comp notes</span>
            <textarea className="field text-sm min-h-[5.4rem]" value={compTargets} placeholder="e.g. Target AUD 140,000–165,000; floor AUD 130,000. Up to 3 days in the CBD, floor unchanged." onChange={(e) => { setComp(e.target.value); touch(); }} />
            <Hint>What the market pays for your target roles and how you frame your own number.</Hint>
          </label>
          <div className="space-y-2 sm:col-span-2 border-t border-jh-line pt-4">
            <p className="label mb-0">Negotiation scripts</p>
            <LineList label="Script" value={scripts} onChange={(v) => { setScripts(v); touch(); }} max={MAX.negotiationScripts} placeholder="e.g. I'm targeting 150k. I'm flexible on structure — what matters is the total package." />
            <p className="text-xs text-jh-mute">What you actually say when the offer comes in low, or they push a location discount.</p>
          </div>
        </div>
      )}

      {section === "industry" && (
        <label className="block max-w-md">
          <span className="label">Industry / sub-sector</span>
          <input className="field" value={goal.subsector ?? ""} placeholder="e.g. HR tech SaaS" onChange={(e) => setG("subsector", e.target.value)} />
          <Hint>As specific as you can — the sub-sector, not just the sector: &ldquo;HR tech SaaS&rdquo;, not &ldquo;software&rdquo;. &ldquo;In …&rdquo; in your statement.</Hint>
        </label>
      )}

      {section === "company-type" && (
        <label className="block max-w-md">
          <span className="label">Company type</span>
          <select className="field" value={goal.companyType ?? ""} onChange={(e) => setG("companyType", e.target.value)}>
            <option value="">Select…</option>
            {typeOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Hint>&ldquo;I enjoy working for …&rdquo; in your statement.</Hint>
        </label>
      )}

      {section === "location" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Location</span>
              <input className="field" value={goal.city ?? ""} placeholder="e.g. Melbourne, Australia" onChange={(e) => setG("city", e.target.value)} />
              <Hint>Where you&apos;re based in your statement — country, region, city or area.</Hint>
            </label>
            <label className="block">
              <span className="label">Location flexibility</span>
              <input className="field" value={policy.locationFlexibility ?? ""} placeholder="e.g. Remote, AEST hours; hybrid up to 3 days" onChange={(e) => setP("locationFlexibility", e.target.value)} />
            </label>
          </div>
          <div className="space-y-2 border-t border-jh-line pt-4">
            <p className="label mb-0">Location rules</p>
            {rules.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <input aria-label={`Rule ${i + 1}`} className="field text-sm" value={line} placeholder="e.g. Remote: Y, AEST/AEDT hours" onChange={(e) => { setRules(rules.map((l, j) => (j === i ? e.target.value : l))); touch(); }} />
                <button type="button" aria-label={`Remove rule ${i + 1}`} onClick={() => { setRules(rules.filter((_, j) => j !== i)); touch(); }} className="icon-btn icon-btn-danger"><X className="h-4 w-4" aria-hidden /></button>
              </div>
            ))}
            {rules.length < MAX_RULES && (
              <button type="button" onClick={() => { setRules([...rules, ""]); touch(); }} className="btn-secondary btn-sm"><Plus className="h-4 w-4" aria-hidden /> Add rule</button>
            )}
            <p className="text-xs text-jh-mute">{rules.length} of {MAX_RULES} added — where you will work, what you&apos;ll travel, what&apos;s a hard no.</p>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" aria-hidden /> {busy ? "Saving…" : SAVE_LABEL[section]}
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

/** The goal fields a section owns — only those reach the stored goal. */
export function pickGoal(section: TrueNorthSection, draft: Goal): Partial<Goal> {
  switch (section) {
    case "roles": return { role: draft.role };
    case "seniority": return { seniority: draft.seniority };
    case "salary": return { salary: draft.salary };
    case "industry": return { subsector: draft.subsector };
    case "location": return { city: draft.city };
    case "company-type": return { companyType: draft.companyType };
  }
}
