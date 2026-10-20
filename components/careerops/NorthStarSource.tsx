"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { setDoc } from "firebase/firestore";
import { Check, Compass, Save, Sparkles, TriangleAlert } from "lucide-react";
import GoalFields from "@/components/compass/GoalFields";
import { paths } from "@/lib/firestore/db";
import { effectiveGoal, hasGoalRole, resolveGoalSource } from "@/lib/careerops/intake";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import { EMPTY_GOAL, GOAL_KEYS, type Goal } from "@/lib/goal";
import type { CareerOpsSetupV2, GoalSource } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// Which North Star the agents work from — the Compass tab's, or one set here in
// intake. Either process can drive at any stage. Choosing intake OVERRIDES the
// Compass goal for everything downstream, but never overwrites it: the two live
// in different documents, so switching back is lossless.

const summarise = (g: Goal): string =>
  GOAL_KEYS.map((k) => g[k]?.trim()).filter(Boolean).join(" · ") || "nothing set yet";

export default function NorthStarSource({ uid, setup, profile }: { uid: string; setup: CareerOpsSetupV2 | null; profile: Profile | null | undefined }) {
  const compassGoal = profile?.goal ?? null;
  const savedSource = resolveGoalSource(setup?.goalSource);
  const savedIntakeGoal = setup?.intakeGoal ?? null;

  const [choice, setChoice] = useState<GoalSource>(savedSource);
  const [draft, setDraft] = useState<Goal>({ ...EMPTY_GOAL, ...(savedIntakeGoal ?? {}) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // What the agents are getting right now, from what is actually saved.
  const live = useMemo(
    () => effectiveGoal({ source: setup?.goalSource, compassGoal, intakeGoal: savedIntakeGoal }),
    [setup?.goalSource, compassGoal, savedIntakeGoal],
  );

  const dirty =
    choice !== savedSource ||
    (choice === "intake" && GOAL_KEYS.some((k) => (draft[k] ?? "").trim() !== ((savedIntakeGoal?.[k] ?? "").trim())));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const intakeGoal: Goal = Object.fromEntries(GOAL_KEYS.map((k) => [k, (draft[k] ?? "").trim()])) as Goal;
      const next = effectiveGoal({ source: choice, compassGoal, intakeGoal });
      await setDoc(
        paths.careerOpsSetup(uid),
        {
          goalSource: choice,
          intakeGoal,
          // Rebuild the agents' profile.yml from whichever goal now wins, or the
          // override would be invisible to every tool.
          profileYaml: buildSetupProfileYaml({ profile, setup, overrides: { goalSource: choice, intakeGoal } }),
          goalUpdatedAt: Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      setMsg(
        next.fellBack
          ? "Saved — but intake has no job title yet, so the agents are still using your Compass goal."
          : next.overriding
            ? "Saved. The agents now use the North Star you set here."
            : "Saved. The agents now use your Compass North Star.",
      );
    } catch {
      setMsg("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-jh-mute text-sm max-w-2xl">
          Scoring is relative to your goal, so something has to own it. Use the one on your Compass tab, or set one here in
          intake — you can switch at any time, and neither is overwritten by the other.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">North Star source</legend>
        {([
          { key: "compass" as const, icon: Compass, title: "Use my Compass North Star", blurb: `Whatever is on the Compass tab: ${summarise(compassGoal ?? {})}.` },
          { key: "intake" as const, icon: Sparkles, title: "Set it here in intake", blurb: "Overrides your Compass goal for every CareerOps tool. Your Compass tab keeps its own copy." },
        ]).map((o) => (
          <label key={o.key} className={`flex items-start gap-3 rounded-[10px] border p-3 cursor-pointer transition-colors ${choice === o.key ? "border-jh-red bg-jh-red/5" : "border-jh-line hover:border-jh-line-2"}`}>
            <input
              type="radio"
              name="northstar-source"
              value={o.key}
              checked={choice === o.key}
              onChange={() => { setChoice(o.key); setMsg(null); }}
              className="mt-1 accent-jh-red"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-jh-ink">
                <o.icon className="h-3.5 w-3.5 text-jh-red" /> {o.title}
              </span>
              <span className="block text-xs text-jh-mute mt-0.5">{o.blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {choice === "compass" ? (
        <p className="text-xs text-jh-mute">
          Edit it on the <Link href="/compass" className="underline underline-offset-2 hover:text-jh-red">Compass tab</Link> — this follows it.
        </p>
      ) : (
        <div className="space-y-3">
          {/* The same five fields as the Compass tab and onboarding, so the two
              processes can never drift apart. */}
          <GoalFields value={draft} onChange={(g) => { setDraft(g); setMsg(null); }} variant="onboarding" idPrefix="intake-goal" />
          {!hasGoalRole(draft) && (
            <p className="flex items-start gap-1.5 text-xs text-jh-red">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Without a job title the override can&apos;t take effect — the agents would fall back to your Compass goal.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save North Star"}
        </button>
        <p className="text-xs text-jh-mute">
          <span className="font-semibold text-jh-ink">In effect:</span>{" "}
          {live.source === "intake" ? "your intake North Star" : "your Compass North Star"} — {summarise(live.goal)}
        </p>
      </div>

      {live.fellBack && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-jh-red">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          You picked intake, but it has no job title — the agents are using your Compass goal until you add one.
        </p>
      )}
      {msg && (
        <p role="status" className={`flex items-start gap-1.5 text-sm ${msg.startsWith("Saved") ? "text-rb-green-dark" : "text-jh-red"}`}>
          {msg.startsWith("Saved") ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />} {msg}
        </p>
      )}
    </div>
  );
}
