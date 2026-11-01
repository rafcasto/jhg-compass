"use client";

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { Check, Save, TriangleAlert } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsContact, CareerOpsPolicy, CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// The candidate.* / compensation.* / location.* fields career-ops' profile.yml
// carries and the Pi worker already reads — they land in the generated CV PDF
// header, the cover-letter contact block and the application-form autofill.
// Until this card existed, Compass emitted none of them, so every generated CV
// went out with no LinkedIn, no portfolio and no phone.
//
// `part` splits it across the Profile page (docs/UX_PROFILE.md §7):
//   contact   WHO AM I · Contact details — name · phone · email · LinkedIn · location · portfolio
//   headline  WHO AM I · Headline — the lane statement (candidate.title)
//   policy    WHAT'S MY TARGET · Salary floor & location
//   both      the intake wizard: all of it in one card
// Each part saves only what it shows, over what is stored, so no panel can
// wipe another's fields. The name lives on the account (users/{uid}); the rest
// on the CareerOps setup document. Email is the sign-in email — shown, not edited.

export type ContactPolicyPart = "contact" | "headline" | "policy" | "both";

interface Field { key: keyof CareerOpsContact; label: string; placeholder: string; hint?: string; optional?: boolean }

const HEADLINE: Field = { key: "title", label: "Headline", placeholder: "e.g. Product leader for climate-tech scale-ups", hint: "One line under your name on the CV — what you do and for whom. Previously the lane statement." };

const CONTACT: Field[] = [
  { key: "phone", label: "Phone", placeholder: "+64 21 000 0000" },
  { key: "linkedin", label: "LinkedIn URL", placeholder: "linkedin.com/in/yourname" },
  { key: "location", label: "Location", placeholder: "Wellington, New Zealand", hint: "City and country, as it should read on your CV." },
  { key: "portfolio", label: "Portfolio URL", placeholder: "https://yoursite.dev", optional: true },
];

const SAVE_LABEL: Record<ContactPolicyPart, string> = { both: "Save details", contact: "Save contact details", headline: "Save headline", policy: "Save logistics" };
const INTRO: Record<ContactPolicyPart, string> = {
  both: "These go straight onto your generated CV and cover letter, and into application forms the agents fill for you. All optional — but anything you leave blank is simply missing from those documents.",
  contact: "These go straight onto your generated CV and cover letter, and into application forms the agents fill for you. Anything you leave blank is simply missing from those documents.",
  headline: "The agents put this under your name on every CV and open every summary with it. One line — the lane you're in, not a list of skills.",
  policy: "Scoring weighs every offer against these. Anything blank is treated as unknown, never guessed.",
};
const SAVED: Record<ContactPolicyPart, string> = {
  both: "Saved. Your next generated CV, cover letter and form fill will use these.",
  contact: "Saved. Your next generated CV, cover letter and form fill will use these.",
  headline: "Saved. Your next generated CV and summary open with this.",
  policy: "Saved. Scoring weighs these from your next evaluation.",
};

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const trimmed = (s: string | undefined) => (s ?? "").trim();

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs text-jh-mute mt-1">{children}</span>;
}

export default function ContactPolicy({ uid, setup, profile, part = "both" }: {
  uid: string;
  setup: CareerOpsSetupV2 | null;
  profile: Profile | null | undefined;
  part?: ContactPolicyPart;
}) {
  const [contact, setContact] = useState<CareerOpsContact>(setup?.contact ?? {});
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [policy, setPolicy] = useState<CareerOpsPolicy>(setup?.policy ?? {});
  const [authorized, setAuthorized] = useState((setup?.policy?.authorizedIn ?? []).join(", "));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const showHeadline = part === "headline" || part === "both";
  const showContact = part === "contact" || part === "both";
  const showPolicy = part === "policy" || part === "both";
  const touch = () => { setDirty(true); setMsg(null); };
  const email = profile?.email ?? "";

  const setField = (key: keyof CareerOpsContact, value: string) => { setContact((c) => ({ ...c, [key]: value })); touch(); };

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const patch: Pick<CareerOpsSetupV2, "contact" | "policy"> = {};
      if (showHeadline || showContact) {
        // Only the shown fields change; the stored ones this part does not show survive.
        const shown = [...(showHeadline ? [HEADLINE] : []), ...(showContact ? CONTACT : [])];
        const next: CareerOpsContact = { ...(setup?.contact ?? {}) };
        for (const f of shown) {
          const v = trimmed(contact[f.key]);
          if (v) next[f.key] = v; else delete next[f.key];
        }
        patch.contact = next;
      }
      if (showPolicy) {
        const list = splitList(authorized);
        patch.policy = {
          ...(policy.minimumSalary?.trim() ? { minimumSalary: policy.minimumSalary.trim() } : {}),
          ...(policy.locationFlexibility?.trim() ? { locationFlexibility: policy.locationFlexibility.trim() } : {}),
          ...(policy.visaStatus?.trim() ? { visaStatus: policy.visaStatus.trim() } : {}),
          ...(policy.needsSponsorship ? { needsSponsorship: true } : {}),
          ...(list.length ? { authorizedIn: list } : {}),
        };
      }
      const name = showContact ? { firstName: firstName.trim(), lastName: lastName.trim() } : {};
      const nameChanged = showContact && (name.firstName !== (profile?.firstName ?? "") || name.lastName !== (profile?.lastName ?? ""));
      const nextProfile = (profile ? { ...profile, ...name } : profile) as Profile | null | undefined;

      await setDoc(
        paths.careerOpsSetup(uid),
        {
          ...patch,
          // Rebuilt from the one place that knows every field — with the name as it will be.
          profileYaml: buildSetupProfileYaml({ profile: nextProfile, setup, overrides: patch }),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      if (nameChanged) await setDoc(paths.profile(uid), name, { merge: true });
      setDirty(false);
      setMsg(SAVED[part]);
    } catch {
      setMsg("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  const textField = (f: Field, className = "block") => (
    <label key={f.key} className={className}>
      <span className="label">{f.label}{f.optional && <span className="font-normal normal-case tracking-normal text-jh-mute"> · optional</span>}</span>
      <input className="field" value={contact[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setField(f.key, e.target.value)} />
      {f.hint && <Hint>{f.hint}</Hint>}
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="text-jh-mute text-sm max-w-2xl">{INTRO[part]}</p>

      {showHeadline && (
        <div className="max-w-2xl">{textField(HEADLINE)}</div>
      )}

      {showContact && (
        <div className={`grid gap-4 sm:grid-cols-2 ${showHeadline ? "border-t border-jh-line pt-4" : ""}`}>
          <label className="block">
            <span className="label">First name</span>
            <input className="field" value={firstName} placeholder="Ana" autoComplete="given-name" onChange={(e) => { setFirstName(e.target.value); touch(); }} />
          </label>
          <label className="block">
            <span className="label">Last name</span>
            <input className="field" value={lastName} placeholder="Reyes" autoComplete="family-name" onChange={(e) => { setLastName(e.target.value); touch(); }} />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input className="field text-jh-mute" value={email} readOnly aria-readonly="true" />
            <Hint>Your sign-in email — the agents use it on every application.</Hint>
          </label>
          {CONTACT.map((f) => textField(f, f.key === "portfolio" ? "block sm:col-span-2" : "block"))}
        </div>
      )}

      {showPolicy && (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 ${showContact || showHeadline ? "border-t border-jh-line pt-4" : ""}`}>
            <label className="block">
              <span className="label">Walk-away salary</span>
              <input
                className="field"
                value={policy.minimumSalary ?? ""}
                placeholder="e.g. 160,000"
                onChange={(e) => { setPolicy((p) => ({ ...p, minimumSalary: e.target.value })); touch(); }}
              />
              <Hint>The number below which you walk. Scoring weighs an offer against it.</Hint>
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
              <Hint>Comma-separated. Defaults to your profile country.</Hint>
            </label>
          </div>

          <label className="flex items-start gap-3 text-sm text-jh-ink">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 rounded-xs accent-jh-red"
              checked={!!policy.needsSponsorship}
              onChange={(e) => { setPolicy((p) => ({ ...p, needsSponsorship: e.target.checked })); touch(); }}
            />
            <span>
              I need visa sponsorship for roles outside those countries
              <span className="block text-xs text-jh-mute">When a posting says it won&apos;t sponsor, scoring treats that as a hard blocker.</span>
            </span>
          </label>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" aria-hidden /> {busy ? "Saving…" : SAVE_LABEL[part]}
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
