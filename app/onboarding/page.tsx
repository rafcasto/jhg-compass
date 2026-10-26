"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Compass, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { deleteField } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import CountrySelect from "@/components/CountrySelect";
import GoalStatement from "@/components/compass/GoalStatement";
import GoalFields from "@/components/compass/GoalFields";
import { useLiveDoc, paths, setDoc } from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import { MarketSection, marketSections } from "@/components/performance/MarketSection";
import TargetsSheet from "@/components/performance/TargetsSheet";
import { resolveWeeklyTarget, type WeeklyTargets } from "@/lib/targets";
import type { Profile } from "@/lib/types";
import { EMPTY_GOAL, goalFromProfile, normalizeGoal, type Goal } from "@/lib/goal";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

// Styling is brand tokens only. Step 3 ("Your weekly plan") is the Performance tab's
// market sections (components/performance/MarketSection) as a READ-ONLY list of the
// recommended weekly targets — one decision: "Use this plan", or "Adjust targets",
// which opens the same Targets sheet the Performance tab uses. 15 steppers → 1 choice.

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

  // Step 2 — goal statement (same model + form as the Compass tab)
  const [goal, setGoal] = useState<Goal>(EMPTY_GOAL);

  // Step 3 — targets. Only what the member changed in the Targets sheet lives here
  // (WEEKLY numbers to set, overrides to drop). Everything else is derived live from
  // the same rule the Performance tab uses: user override -> admin default -> 0. No
  // local copy, so admin-set defaults show up even if config/content loads after first render.
  const [plan, setPlan] = useState<{ set: WeeklyTargets; unset: string[] }>({ set: {}, unset: [] });
  const [adjusting, setAdjusting] = useState(false);

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
      if (profile.goal || profile.compass) setGoal((g) => ({ ...goalFromProfile(profile), ...g }));
    }
  }, [profile, router]);

  const userTargets = targetDoc?.targets ?? {};
  const weekly = (id: string) =>
    plan.set[id] ?? (plan.unset.includes(id) ? weeklyTargets[id] ?? 0 : resolveWeeklyTarget(id, userTargets, weeklyTargets));
  const customised = (id: string) => weekly(id) !== (weeklyTargets[id] ?? 0);
  // The sheet starts from the member's current figures (existing overrides + this session's edits).
  const sheetUserTargets: WeeklyTargets = { ...userTargets, ...plan.set };
  for (const id of plan.unset) delete sheetUserTargets[id];

  const step1Valid = firstName.trim() && lastName.trim() && country.trim();
  const step2Valid = goal.role?.trim();

  async function finish() {
    if (!user) return;
    setBusy(true);
    try {
      // Same write shape as the Performance tab: only the rows the member changed.
      // Untouched rows are NOT written, so admin default changes keep reaching this user.
      if (Object.keys(plan.set).length || plan.unset.length) {
        const targets: Record<string, unknown> = { ...plan.set };
        for (const id of plan.unset) targets[id] = deleteField();
        await setDoc(paths.settingsTargets(user.uid), { targets }, { merge: true });
      }
      await setDoc(paths.profile(user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: country.trim(),
        goal: normalizeGoal(goal),
        goalUpdatedAt: Date.now(),
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
      {/* Steps 1–2 are forms (≤ 512px); step 3 is the market list and gets a little more room for the long labels. */}
      <div className={`mx-auto w-full ${step === 2 ? "max-w-2xl" : "max-w-lg"}`}>
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
          <CompassCard sentence={<GoalStatement goal={goal} />} eyebrow={t("onb.goalEyebrow")}>
            <p className="text-sm text-jh-mute mb-4">{t("onb.goalIntro")}</p>
            <GoalFields value={goal} onChange={setGoal} variant="onboarding" idPrefix="onb-goal" />
            <Nav onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!step2Valid} />
          </CompassCard>
        )}

        {step === 2 && (
          <div className="market-screen space-y-6">
            <div>
              <h1 className="text-2xl">{t("onb.targetsTitle")}</h1>
              <p className="text-jh-mute text-sm mt-1">{t("onb.targetsSubtitle")}</p>
            </div>

            {marketSections({ t, hidden, visible, effortSplit }).map((section) => (
              <MarketSection key={section.market} section={section}>
                {section.cats.map((c) => (
                  <PlanRow key={c.id} label={c.label} value={weekly(c.id)} unit={t("onb.perWeek")}
                    tag={customised(c.id) ? t("onb.customised") : undefined} />
                ))}
              </MarketSection>
            ))}

            <div className="mx-auto w-full max-w-lg space-y-3">
              <Nav onBack={() => setStep(1)}
                onNext={finish} nextLabel={busy ? "Setting up…" : t("onb.usePlan")}
                nextDisabled={busy} nextIcon={<Check className="h-4 w-4" />} />
              <button type="button" onClick={() => setAdjusting(true)} className="btn-ghost w-full text-jh-ink hover:bg-jh-mist hover:text-jh-ink">
                {t("onb.adjust")}
              </button>
            </div>

            {adjusting && (
              <TargetsSheet t={t} hidden={hidden} visible={visible} effortSplit={effortSplit}
                weeklyTargets={weeklyTargets} userTargets={sheetUserTargets}
                onClose={() => setAdjusting(false)}
                onSave={({ set, unset }) => setPlan((p) => ({
                  set: Object.fromEntries(Object.entries({ ...p.set, ...set }).filter(([id]) => !unset.includes(id))),
                  unset: [...p.unset.filter((id) => !(id in set)), ...unset.filter((id) => !p.unset.includes(id))],
                }))} />
            )}
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
          <div className="mt-2">{sentence}</div>
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

// One activity row of the plan: label + the weekly figure, read-only (16/600 ink,
// unit 13px mute). A row the member changed in the sheet carries a small tag.
function PlanRow({ label, value, unit, tag }: { label: string; value: number; unit: string; tag?: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-jh-line py-4">
      <div className="min-w-0 flex-1">
        <div className="font-display text-base font-semibold leading-snug text-jh-ink">{label}</div>
        {tag && <span className="section-label mt-1 normal-case tracking-normal">{tag}</span>}
      </div>
      <div className="flex flex-none items-baseline gap-1 whitespace-nowrap">
        <span className={`font-display text-base font-semibold leading-none ${value > 0 ? "text-jh-ink" : "text-jh-mute"}`}>{value}</span>
        <span className="text-[13px] text-jh-mute">{unit}</span>
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
