"use client";

import { useEffect, useState } from "react";
import { Compass as CompassIcon, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useLiveDoc, paths, setDoc } from "@/lib/firestore/db";
import type { CompassFormula, Profile } from "@/lib/types";
import CompassSentence from "@/components/CompassSentence";

const COMPANY_TYPES = ["startup", "small", "mid-size", "large"] as const;

export default function CompassPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CompassFormula>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile?.compass && !editing) setDraft(profile.compass);
  }, [profile, editing]);

  async function save() {
    if (!uid) return;
    setBusy(true);
    await setDoc(paths.profile(uid), { compass: draft }, { merge: true });
    setBusy(false);
    setEditing(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><span className="eyebrow">Your north star</span><h1 className="mt-1">Compass</h1></div>
        {!editing && (
          <button onClick={() => { setDraft(profile?.compass ?? {}); setEditing(true); }} className="btn-secondary">
            <Pencil className="h-4 w-4" /> Edit
          </button>
        )}
      </div>

      {/* The formula recap */}
      <div className="relative overflow-hidden rounded-lg bg-jh-ink text-white p-7">
        <CompassIcon className="absolute -right-8 -bottom-8 h-48 w-48 text-white/5" strokeWidth={1} />
        <div className="relative">
          <span className="eyebrow text-white/60">Your Goal Statement</span>
          <p className="mt-2 font-display font-semibold text-xl leading-snug"><CompassSentence c={editing ? draft : profile?.compass ?? {}} /></p>
        </div>
      </div>

      {editing ? (
        <div className="card p-6 space-y-4">
          <p className="text-sm text-jh-mute">Refine your target. Be specific — clarity drives action.</p>
          <Field label="Job title / function" value={draft.jobTitle ?? ""} onChange={(v) => setDraft((c) => ({ ...c, jobTitle: v }))} placeholder="e.g. Product Marketing Manager" />
          <Field label="Industry" value={draft.industry ?? ""} onChange={(v) => setDraft((c) => ({ ...c, industry: v }))} placeholder="e.g. FinTech" />
          <Field label="Geography" value={draft.geography ?? ""} onChange={(v) => setDraft((c) => ({ ...c, geography: v }))} placeholder="e.g. London or remote-EU" />
          <div>
            <label className="label">Type of company</label>
            <select className="field" value={draft.companyType ?? ""} onChange={(e) => setDraft((c) => ({ ...c, companyType: e.target.value }))}>
              <option value="">Select…</option>
              {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Compensation</label>
            <div className="grid grid-cols-2 gap-3">
              <input className="field" placeholder="Target salary" value={draft.targetSalary ?? ""}
                onChange={(e) => setDraft((c) => ({ ...c, targetSalary: e.target.value }))} />
              <input className="field" placeholder="Minimum (deal-breaker)" value={draft.minSalary ?? ""}
                onChange={(e) => setDraft((c) => ({ ...c, minSalary: e.target.value }))} />
            </div>
            <p className="text-[11px] text-jh-mute mt-1">Target = what you&apos;re aiming for. Minimum = the lowest you&apos;d accept.</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={() => setEditing(false)} className="btn-ghost"><X className="h-4 w-4" /> Cancel</button>
            <button onClick={save} disabled={busy || !draft.jobTitle?.trim()} className="btn-primary flex-1 disabled:opacity-50">
              <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save Compass"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Job title / function" value={profile?.compass?.jobTitle} />
            <Detail label="Industry" value={profile?.compass?.industry} />
            <Detail label="Geography" value={profile?.compass?.geography} />
            <Detail label="Type of company" value={profile?.compass?.companyType} />
          </div>
          <CompCard target={profile?.compass?.targetSalary} min={profile?.compass?.minSalary} />
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-jh-mute">{label}</p>
      <p className="mt-1 font-display font-semibold text-jh-ink capitalize">{value || "—"}</p>
    </div>
  );
}

function CompCard({ target, min }: { target?: string; min?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-jh-mute mb-3">Compensation</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-jh-mute-2">Target salary</p>
          <p className="mt-1 font-display font-extrabold text-xl text-rb-green-dark">{target || "—"}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-jh-mute-2">Minimum · deal-breaker</p>
          <p className="mt-1 font-display font-extrabold text-xl text-jh-red">{min || "—"}</p>
        </div>
      </div>
    </div>
  );
}
