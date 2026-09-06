"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Compass, ArrowRight, ArrowLeft, Check, Plus, Minus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import CountrySelect from "@/components/CountrySelect";
import CompassSentence from "@/components/CompassSentence";
import { useLiveDoc, paths, setDoc } from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import { fillTemplate } from "@/lib/content";
import { scaleTarget, toWeekly } from "@/lib/period";
import { resolveWeeklyTarget, withTargetEdits } from "@/lib/targets";
import type { Activity, CompassFormula, Profile } from "@/lib/types";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

const COMPANY_TYPES = ["startup", "small", "mid-size", "large"] as const;

// Design tokens shared with the Performance tab (JobHackers design system).
const C = {
  ink: "#191c27", mute: "#6b7280", muteLight: "#9aa0ad", slash: "#c5c9d2",
  disabled: "#d4d8e2", line: "#eef0f5", circle: "#e6e8ef",
  bannerBlue: "#e2ebfb", bannerRed: "#fbe3e6",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, emailVerified } = useAuth();
  const content = useContent();
  const { t, hidden, visible, weeklyTargets, effortSplit } = content;
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

  // Step 3 — targets. Only the rows the user actually touches live here (as the
  // canonical WEEKLY base). Everything else is derived live from the same rule the
  // Performance tab uses: user override -> admin default -> 0. No local copy, so
  // admin-set defaults show up even if config/content loads after first render.
  const [edits, setEdits] = useState<Record<string, number>>({});

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

  const userTargets = targetDoc?.targets ?? {};
  const weekly = (id: string) => edits[id] ?? resolveWeeklyTarget(id, userTargets, weeklyTargets);

  // Per-day view of the weekly target — identical maths to Performance in "day" mode.
  const daily = (id: string) => scaleTarget(weekly(id), "day", new Date());
  const setDaily = (id: string, d: number) =>
    setEdits((e) => ({ ...e, [id]: toWeekly(Math.max(0, d), "day", new Date()) }));

  const step1Valid = firstName.trim() && lastName.trim() && country.trim();
  const step2Valid = compass.jobTitle?.trim();

  async function finish() {
    if (!user) return;
    setBusy(true);
    try {
      // Same write shape as Performance's setGoal: existing overrides + edited rows.
      // Untouched rows are NOT written, so admin default changes keep reaching this user.
      if (Object.keys(edits).length) {
        await setDoc(paths.settingsTargets(user.uid), { targets: withTargetEdits(userTargets, edits) }, { merge: true });
      }
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

  if (loading || !user || profileLoading || content.loading) {
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
          <Card title={t("onb.welcomeTitle")} subtitle={t("onb.welcomeSubtitle")}>
            <Field label={t("onb.firstName")} value={firstName} onChange={setFirstName} />
            <Field label={t("onb.lastName")} value={lastName} onChange={setLastName} />
            <div>
              <label className="label">{t("onb.country")}</label>
              <CountrySelect value={country} onChange={setCountry} />
            </div>
            <Nav onNext={() => setStep(1)} nextDisabled={!step1Valid} />
          </Card>
        )}

        {step === 1 && (
          <CompassCard sentence={<CompassSentence c={compass} />} eyebrow={t("onb.goalEyebrow")}>
            <p className="text-sm text-jh-mute mb-4">{t("onb.goalIntro")}</p>
            <Field label="Job title / function" value={compass.jobTitle ?? ""}
              onChange={(v) => setCompass((c) => ({ ...c, jobTitle: v }))} placeholder="e.g. Product Marketing Manager" />
            <Field label="Industry" value={compass.industry ?? ""}
              onChange={(v) => setCompass((c) => ({ ...c, industry: v }))} placeholder="e.g. FinTech" />
            <Field label="Location" value={compass.geography ?? ""}
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
              <p className="text-[11px] text-jh-mute mt-1">{t("onb.salaryHelp")}</p>
            </div>
            <Nav onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!step2Valid} />
          </CompassCard>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="card p-6">
              <h1 className="text-2xl">{t("onb.targetsTitle")}</h1>
              <p className="text-jh-mute text-sm mt-1">{t("onb.targetsSubtitle")}</p>
            </div>

            <TargetSection emoji={t("perf.hiddenEmoji")} main={t("perf.hiddenTitle")}
              subtitle={fillTemplate(t("perf.effortNote"), { pct: effortSplit.hidden })} bg={C.bannerRed}
              cats={hidden} perDayLabel={t("onb.perDay")} daily={daily} setDaily={setDaily} />
            <TargetSection emoji={t("perf.visibleEmoji")} main={t("perf.visibleTitle")}
              subtitle={fillTemplate(t("perf.effortNote"), { pct: effortSplit.visible })} bg={C.bannerBlue}
              cats={visible} perDayLabel={t("onb.perDay")} daily={daily} setDaily={setDaily} />

            <Nav onBack={() => setStep(1)}
              onNext={finish} nextLabel={busy ? "Setting up…" : t("onb.finish")}
              nextDisabled={busy} nextIcon={<Check className="h-4 w-4" />} />
          </div>
        )}
      </div>
    </div>
  );
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

function CompassCard({ sentence, eyebrow, children }: { sentence: React.ReactNode; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      {/* Goal-statement recap with a faint compass icon behind it */}
      <div className="relative overflow-hidden rounded-lg bg-jh-ink text-white p-6">
        <Compass className="absolute -right-6 -bottom-6 h-40 w-40 text-white/5" strokeWidth={1} />
        <div className="relative">
          <span className="eyebrow text-white/60">{eyebrow}</span>
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

function TargetSection({ emoji, main, subtitle, bg, cats, perDayLabel, daily, setDaily }: {
  emoji: string; main: string; subtitle: string; bg: string;
  cats: Activity[]; perDayLabel: string;
  daily: (id: string) => number;
  setDaily: (id: string, d: number) => void;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3" style={{ background: bg, padding: "15px 18px" }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>{emoji}</span>
        <div>
          <div className="font-display font-bold" style={{ fontSize: 16, lineHeight: 1.2, color: C.ink }}>{main}</div>
          <div style={{ fontSize: 13, color: C.mute, marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      <div className="px-5">
        {cats.map((c) => <TargetRow key={c.id} label={c.label} perDayLabel={perDayLabel} value={daily(c.id)} onChange={(d) => setDaily(c.id, d)} />)}
      </div>
    </section>
  );
}

function TargetRow({ label, perDayLabel, value, onChange }: { label: string; perDayLabel: string; value: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-4 items-center" style={{ padding: "14px 0", borderBottom: `1px solid ${C.line}` }}>
      <div className="flex-1 min-w-0 font-display font-semibold" style={{ fontSize: 15, lineHeight: 1.3, color: C.ink }}>{label}</div>
      <div className="flex-none text-center">
        <div className="font-display font-semibold uppercase" style={{ fontSize: 10.5, letterSpacing: ".07em", color: C.muteLight }}>{perDayLabel}</div>
        <div className="flex items-center justify-end" style={{ gap: 11, marginTop: 6 }}>
          <button type="button" onClick={() => onChange(value - 1)} className="grid place-items-center rounded-full"
            style={{ width: 36, height: 36, border: `1.5px solid ${C.circle}`, background: "#fff", color: value > 0 ? C.mute : C.disabled }}>
            <Minus className="h-5 w-5" />
          </button>
          <span className="font-display font-bold" style={{ fontSize: 24, color: value > 0 ? C.ink : C.slash, width: 24, textAlign: "center" }}>{value}</span>
          <button type="button" onClick={() => onChange(value + 1)} className="grid place-items-center rounded-full text-white"
            style={{ width: 36, height: 36, background: C.ink, boxShadow: "0 4px 12px rgba(25,28,39,.20)" }}>
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
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
