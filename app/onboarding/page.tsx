"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Compass, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import CountrySelect from "@/components/CountrySelect";
import { useLiveDoc, paths, setDoc } from "@/lib/firestore/db";
import {
  HIDDEN_CATEGORIES, VISIBLE_CATEGORIES, DEFAULT_WEEKLY_TARGETS,
} from "@/lib/categories";
import type { CompassFormula, Profile } from "@/lib/types";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

const COMPANY_TYPES = ["startup", "small", "mid-size", "large"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, emailVerified } = useAuth();
  const { data: profile, loading: profileLoading } =
    useLiveDoc<Profile>(user ? paths.profile(user.uid) : null);
  const { data: targetDoc } =
    useLiveDoc<{ targets: Record<string, number> }>(user ? paths.settingsTargets(user.uid) : null);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 1 — identity
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");

  // Step 2 — compass formula
  const [compass, setCompass] = useState<CompassFormula>({});

  // Step 3 — weekly targets
  const [targets, setTargets] = useState<Record<string, number>>({});

  // Route guards + prefill from any existing profile.
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (!emailVerified) { router.replace("/compass"); return; }
  }, [loading, user, emailVerified, router]);

  useEffect(() => {
    if (profile?.onboardedAt) { router.replace("/compass"); return; }
    if (profile) {
      setFirstName((p) => p || profile.firstName || "");
      setLastName((p) => p || profile.lastName || "");
      setCountry((p) => p || profile.country || "");
      if (profile.compass) setCompass((c) => ({ ...profile.compass, ...c }));
    }
  }, [profile, router]);

  useEffect(() => {
    setTargets((t) => (Object.keys(t).length ? t : { ...DEFAULT_WEEKLY_TARGETS, ...(targetDoc?.targets ?? {}) }));
  }, [targetDoc]);

  const sentence = useMemo(() => buildSentence(compass), [compass]);
  const step1Valid = firstName.trim() && lastName.trim() && country.trim();
  const step2Valid = compass.jobTitle?.trim();

  async function finish() {
    if (!user) return;
    setBusy(true);
    try {
      await setDoc(paths.settingsTargets(user.uid), { targets }, { merge: true });
      await setDoc(paths.profile(user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: country.trim(),
        compass,
        onboardedAt: Date.now(),
      }, { merge: true });
      track(TAGS.ONBOARDED, { stage: "activation" });
      router.replace("/compass");
    } catch {
      setBusy(false);
    }
  }

  if (loading || !user || profileLoading) {
    return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-jh-paper px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex flex-col items-center mb-6">
          <Image src="/assets/logo-jobhackers.png" alt="JobHackers" width={140} height={38} className="mb-3" />
          <Stepper step={step} />
        </div>

        {step === 0 && (
          <Card title="Welcome aboard 👋" subtitle="Let's set up your Compass. First, the basics.">
            <Field label="First name" value={firstName} onChange={setFirstName} />
            <Field label="Last name" value={lastName} onChange={setLastName} />
            <div>
              <label className="label">Country</label>
              <CountrySelect value={country} onChange={setCountry} />
            </div>
            <Nav onNext={() => setStep(1)} nextDisabled={!step1Valid} />
          </Card>
        )}

        {step === 1 && (
          <CompassCard sentence={sentence}>
            <p className="text-sm text-jh-mute mb-4">
              Your Compass keeps you pointed at the right target. Fill in the blanks — be specific.
            </p>
            <Field label="Job title / function" value={compass.jobTitle ?? ""}
              onChange={(v) => setCompass((c) => ({ ...c, jobTitle: v }))} placeholder="e.g. Product Marketing Manager" />
            <Field label="Industry" value={compass.industry ?? ""}
              onChange={(v) => setCompass((c) => ({ ...c, industry: v }))} placeholder="e.g. FinTech" />
            <Field label="Geography" value={compass.geography ?? ""}
              onChange={(v) => setCompass((c) => ({ ...c, geography: v }))} placeholder="e.g. London or remote-EU" />
            <div>
              <label className="label">Type of company</label>
              <select className="field" value={compass.companyType ?? ""}
                onChange={(e) => setCompass((c) => ({ ...c, companyType: e.target.value }))}>
                <option value="">Select…</option>
                {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Compensation</label>
              <div className="grid grid-cols-2 gap-3">
                <input className="field" placeholder="Target salary" value={compass.targetSalary ?? ""}
                  onChange={(e) => setCompass((c) => ({ ...c, targetSalary: e.target.value }))} />
                <input className="field" placeholder="Minimum (deal-breaker)" value={compass.minSalary ?? ""}
                  onChange={(e) => setCompass((c) => ({ ...c, minSalary: e.target.value }))} />
              </div>
              <p className="text-[11px] text-jh-mute mt-1">Target = what you&apos;re aiming for. Minimum = the lowest you&apos;d accept.</p>
            </div>
            <Nav onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!step2Valid} />
          </CompassCard>
        )}

        {step === 2 && (
          <Card title="Set your weekly targets 🎯"
            subtitle="How much will you do each week? You can fine-tune these any time in Performance.">
            <TargetGroup title="🧊 Hidden market — below the waterline" cats={HIDDEN_CATEGORIES} targets={targets} setTargets={setTargets} />
            <TargetGroup title="🌊 Visible market — above the waterline" cats={VISIBLE_CATEGORIES} targets={targets} setTargets={setTargets} />
            <Nav onBack={() => setStep(1)}
              onNext={finish} nextLabel={busy ? "Setting up…" : "Finish & enter Compass"}
              nextDisabled={busy} nextIcon={<Check className="h-4 w-4" />} />
          </Card>
        )}
      </div>
    </div>
  );
}

function buildSentence(c: CompassFormula) {
  const title = c.jobTitle?.trim() || "________";
  const industry = c.industry?.trim() ? ` in the ${c.industry.trim()} industry` : "";
  const geo = c.geography?.trim() ? `, based in ${c.geography.trim()}` : "";
  const company = c.companyType?.trim() ? `, at a ${c.companyType.trim()} company` : "";
  return `In the next 60–90 days, I will land a fulfilling job as a ${title}${industry}${geo}${company}.`;
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-2 rounded-pill transition-all ${i === step ? "w-8 bg-jh-red" : i < step ? "w-8 bg-jh-red/40" : "w-2 bg-jh-line-2"}`} />
      ))}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 space-y-4">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {subtitle && <p className="text-jh-mute text-sm mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function CompassCard({ sentence, children }: { sentence: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      {/* Compass-branded formula recap with a faint compass icon behind it */}
      <div className="relative overflow-hidden rounded-lg bg-jh-ink text-white p-6">
        <Compass className="absolute -right-6 -bottom-6 h-40 w-40 text-white/5" strokeWidth={1} />
        <div className="relative">
          <span className="eyebrow text-white/60">Your Compass</span>
          <p className="mt-2 font-display font-semibold text-lg leading-snug">{sentence}</p>
        </div>
      </div>
      <div className="card p-6 space-y-4">{children}</div>
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

function TargetGroup({ title, cats, targets, setTargets }: {
  title: string;
  cats: typeof HIDDEN_CATEGORIES;
  targets: Record<string, number>;
  setTargets: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-display font-semibold text-jh-ink mb-2">{title}</h3>
      <ul className="space-y-2">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            <span className="text-lg shrink-0">{c.emoji}</span>
            <span className="text-sm text-jh-ink flex-1 leading-snug">{c.label}</span>
            <input type="number" min={0}
              value={targets[c.id] ?? 0}
              onChange={(e) => setTargets((t) => ({ ...t, [c.id]: Math.max(0, Number(e.target.value)) }))}
              className="w-16 rounded-[8px] border border-jh-line px-2 py-1 text-center text-jh-ink" />
            <span className="text-[11px] text-jh-mute w-10">/ wk</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Nav({ onBack, onNext, nextDisabled, nextLabel = "Continue", nextIcon }:
  { onBack?: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string; nextIcon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {onBack && (
        <button type="button" onClick={onBack} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Back</button>
      )}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="btn-primary flex-1 disabled:opacity-50">
        {nextLabel} {nextIcon ?? <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
