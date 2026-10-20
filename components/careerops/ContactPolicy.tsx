"use client";

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { Check, Link2, Save, TriangleAlert } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsContact, CareerOpsPolicy, CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// The candidate.* / compensation.* / location.* fields career-ops' profile.yml
// carries and the Pi worker already reads — they land in the generated CV PDF
// header, the cover-letter contact block and the application-form autofill.
// Until this card existed, Compass emitted none of them, so every generated CV
// went out with no LinkedIn, no GitHub, no portfolio and no phone.

const TEXT: { key: keyof CareerOpsContact; label: string; placeholder: string; hint?: string }[] = [
  { key: "title", label: "Professional headline", placeholder: "e.g. Product leader, climate tech", hint: "Sits under your name on the generated CV." },
  { key: "phone", label: "Phone", placeholder: "+64 21 000 0000" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/yourname" },
  { key: "portfolio", label: "Portfolio / website", placeholder: "https://yoursite.dev" },
  { key: "github", label: "GitHub", placeholder: "github.com/yourname" },
];

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function ContactPolicy({ uid, setup, profile }: { uid: string; setup: CareerOpsSetupV2 | null; profile: Profile | null | undefined }) {
  const [contact, setContact] = useState<CareerOpsContact>(setup?.contact ?? {});
  const [policy, setPolicy] = useState<CareerOpsPolicy>(setup?.policy ?? {});
  const [authorized, setAuthorized] = useState((setup?.policy?.authorizedIn ?? []).join(", "));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const touch = () => { setDirty(true); setMsg(null); };

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const nextContact: CareerOpsContact = Object.fromEntries(
        TEXT.map((f) => [f.key, (contact[f.key] ?? "").trim()]).filter(([, v]) => v),
      );
      const list = splitList(authorized);
      const nextPolicy: CareerOpsPolicy = {
        ...(policy.minimumSalary?.trim() ? { minimumSalary: policy.minimumSalary.trim() } : {}),
        ...(policy.locationFlexibility?.trim() ? { locationFlexibility: policy.locationFlexibility.trim() } : {}),
        ...(policy.visaStatus?.trim() ? { visaStatus: policy.visaStatus.trim() } : {}),
        ...(policy.needsSponsorship ? { needsSponsorship: true } : {}),
        ...(list.length ? { authorizedIn: list } : {}),
      };
      await setDoc(
        paths.careerOpsSetup(uid),
        {
          contact: nextContact,
          policy: nextPolicy,
          // Rebuilt from the one place that knows every field.
          profileYaml: buildSetupProfileYaml({ profile, setup, overrides: { contact: nextContact, policy: nextPolicy } }),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      setDirty(false);
      setMsg("Saved. Your next generated CV, cover letter and form fill will use these.");
    } catch {
      setMsg("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg"><Link2 className="h-4 w-4 text-jh-red" /> Contact details and logistics</h2>
        <p className="text-jh-mute text-sm mt-1 max-w-2xl">
          These go straight onto your generated CV and cover letter, and into application forms the agents fill for you.
          All optional — but anything you leave blank is simply missing from those documents.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT.map((f) => (
          <label key={f.key} className="block">
            <span className="label">{f.label}</span>
            <input
              className="field"
              value={contact[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => { setContact((c) => ({ ...c, [f.key]: e.target.value })); touch(); }}
            />
            {f.hint && <span className="block text-xs text-jh-mute-2 mt-1">{f.hint}</span>}
          </label>
        ))}
      </div>

      <div className="border-t border-jh-line pt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Walk-away salary</span>
          <input
            className="field"
            value={policy.minimumSalary ?? ""}
            placeholder="e.g. 160,000"
            onChange={(e) => { setPolicy((p) => ({ ...p, minimumSalary: e.target.value })); touch(); }}
          />
          <span className="block text-xs text-jh-mute-2 mt-1">The number below which you walk. Scoring weighs an offer against it.</span>
        </label>
        <label className="block">
          <span className="label">Location flexibility</span>
          <input
            className="field"
            value={policy.locationFlexibility ?? ""}
            placeholder="e.g. Remote, 1 week/month on-site"
            onChange={(e) => { setPolicy((p) => ({ ...p, locationFlexibility: e.target.value })); touch(); }}
          />
        </label>
        <label className="block">
          <span className="label">Visa / right to work</span>
          <input
            className="field"
            value={policy.visaStatus ?? ""}
            placeholder="e.g. NZ citizen — no sponsorship needed"
            onChange={(e) => { setPolicy((p) => ({ ...p, visaStatus: e.target.value })); touch(); }}
          />
        </label>
        <label className="block">
          <span className="label">Already authorised to work in</span>
          <input
            className="field"
            value={authorized}
            placeholder="New Zealand, Australia"
            onChange={(e) => { setAuthorized(e.target.value); touch(); }}
          />
          <span className="block text-xs text-jh-mute-2 mt-1">Comma-separated. Defaults to your profile country.</span>
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-jh-ink">
        <input
          type="checkbox"
          className="mt-1 accent-jh-red"
          checked={!!policy.needsSponsorship}
          onChange={(e) => { setPolicy((p) => ({ ...p, needsSponsorship: e.target.checked })); touch(); }}
        />
        <span>
          I need visa sponsorship for roles outside those countries
          <span className="block text-xs text-jh-mute">When a posting says it won&apos;t sponsor, scoring treats that as a hard blocker.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save details"}
        </button>
        {msg && (
          <p role="status" className={`flex items-start gap-1.5 text-sm ${msg.startsWith("Saved") ? "text-rb-green-dark" : "text-jh-red"}`}>
            {msg.startsWith("Saved") ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />} {msg}
          </p>
        )}
      </div>
    </section>
  );
}
