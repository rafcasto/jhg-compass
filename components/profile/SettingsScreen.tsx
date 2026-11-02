"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { authed } from "@/components/admin/shared";
import PortalAccounts from "@/components/agents/PortalAccounts";
import CvPanel from "@/components/careerops/CvPanel";
import Personalization from "@/components/careerops/Personalization";
import WatchlistPanel from "@/components/careerops/WatchlistPanel";
import { useAccess } from "@/lib/firestore/access";
import { paths, useLiveCollection, useLiveDoc } from "@/lib/firestore/db";
import { effectiveGoal } from "@/lib/careerops/intake";
import { PAGE_HREF, parseSection, rowsFor, sectionSummaries, sectionsFor } from "@/lib/profile-sections";
import { profileItems } from "./SectionList";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { VaultAccount } from "@/lib/careerops/vault";
import type { Profile } from "@/lib/types";
import NotesPanel from "./NotesPanel";
import SectionsPage from "./SectionsPage";

// The Settings page — docs/UX_PROFILE.md §7. What the agents work from: the
// master CV, the companies they watch, the portal accounts they sign in with,
// the archetypes they score against, the portfolio they can point to, and the
// notes they read first. Same layout as Profile; same registry.
//
// Not gated on CareerOps, except the one section that needs the worker: portal
// accounts are encrypted with the Pi's public key, which only members with the
// portal switched on can fetch — so the section only exists for them.

export default function SettingsScreen() {
  const { user, isAdmin } = useAuth();
  const uid = user?.uid;
  const { agentsEnabled, loading: accessLoading } = useAccess(uid);
  const careerOps = agentsEnabled || isAdmin;
  const sections = useMemo(() => sectionsFor("settings", { careerOps }), [careerOps]);
  const items = useMemo(() => profileItems(sections), [sections]);

  const { data: profile } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup, loading: setupLoading } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const { data: vault } = useLiveCollection<VaultAccount>(careerOps ? uid : undefined, paths.careerOpsVault);
  const params = useSearchParams();
  const active = parseSection(params.get("section"), sections);

  // The worker's RSA public key, so the browser can encrypt portal passwords for it alone.
  const [publicKey, setPublicKey] = useState<string | null>(null);
  useEffect(() => {
    if (!careerOps) return;
    let stop = false;
    authed("/api/agents/status").then((r) => r.json()).then((d) => { if (!stop && d?.ok) setPublicKey(d.vaultPublicKey ?? null); }).catch(() => {});
    return () => { stop = true; };
  }, [careerOps]);

  const rows = useMemo(() => rowsFor(sections, sectionSummaries({ setup, profile, accounts: vault.length })), [sections, setup, profile, vault.length]);
  const goal = useMemo(
    () => effectiveGoal({ source: setup?.goalSource, compassGoal: profile?.goal, intakeGoal: setup?.intakeGoal }),
    [setup?.goalSource, setup?.intakeGoal, profile?.goal],
  );

  return (
    <SectionsPage
      id="settings"
      backHref={PAGE_HREF.settings}
      eyebrow="Account"
      title="Settings"
      intro="What the agents work from: your master CV, the companies they watch, the portal accounts they sign in with, and the archetypes they score against."
      items={items}
      rows={rows}
      active={active}
      loading={!uid || setupLoading || accessLoading}
      panel={(key) => {
        if (!uid) return null;
        switch (key) {
          case "cv": return <CvPanel uid={uid} setup={setup} profile={profile} goalRole={goal.goal.role} />;
          case "companies": return <WatchlistPanel uid={uid} setup={setup} goalRole={goal.goal.role} />;
          case "accounts": return <PortalAccounts uid={uid} publicKey={publicKey} />;
          case "archetypes": return <Personalization uid={uid} setup={setup} profile={profile} only={["targetRoles", "adaptiveFraming", "crossCuttingAdvantage"]} saveLabel="Save archetypes" />;
          case "portfolio": return <Personalization uid={uid} setup={setup} profile={profile} only={["portfolio"]} saveLabel="Save portfolio" />;
          case "notes": return <NotesPanel uid={uid} setup={setup} profile={profile} />;
          default: return null;
        }
      }}
    />
  );
}
