"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useLiveDoc, paths, setDoc } from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import type { Profile } from "@/lib/types";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import { goalInEffect, goalWrites } from "@/lib/careerops/goal-save";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { Goal } from "@/lib/goal";
import type { Article } from "@/lib/ghost";
import CompassGoal from "@/components/compass/CompassGoal";
import ArticlesCarousel from "@/components/compass/ArticlesCarousel";

export default function CompassPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { t } = useContent();
  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);

  // The one goal in effect — the uploaded True North while it is, else the saved objective
  // (falling back to the legacy onboarding "compass" fields). lib/careerops/goal-save.ts.
  const goal = useMemo(() => goalInEffect({ setup, profile }), [setup, profile]);

  // Written to the home in effect, with the agents' profile.yml rebuilt from it — the same
  // save as JobHacking → True North, so a title changed here reads there at once and back.
  async function save(g: Goal) {
    if (!uid) return;
    const now = Date.now();
    const writes = goalWrites({ setup, profile }, g, now);
    await setDoc(
      paths.careerOpsSetup(uid),
      { ...writes.setupPatch, profileYaml: buildSetupProfileYaml({ profile: writes.nextProfile, setup, overrides: writes.setupPatch }), updatedAt: now },
      { merge: true },
    );
    if (writes.profilePatch) await setDoc(paths.profile(uid), writes.profilePatch, { merge: true });
  }

  // Curated reading rail. Fetched through our own API so the Ghost key stays
  // server-side; any failure -> [] -> the section simply doesn't render.
  const [articles, setArticles] = useState<Article[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user.getIdToken()
      .then((token) => fetch("/api/articles", { headers: { authorization: `Bearer ${token}` } }))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.ok && Array.isArray(d.articles)) setArticles(d.articles); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="space-y-8 md:space-y-10">
      <CompassGoal
        goal={goal}
        onSave={save}
        labels={{
          eyebrow: t("compass.eyebrow"),
          title: t("compass.title"),
          goalEyebrow: t("compass.goalEyebrow"),
          editTitle: t("compass.editTitle"),
          editIntro: t("compass.editIntro"),
        }}
      />
      <ArticlesCarousel articles={articles} eyebrow={t("compass.articlesEyebrow")} title={t("compass.articlesTitle")} />
    </div>
  );
}
