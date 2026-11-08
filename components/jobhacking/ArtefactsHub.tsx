"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import PageHeader from "@/components/shell/PageHeader";
import SectionList, { type SectionItem, type SectionRow } from "@/components/profile/SectionList";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { findJhPage, jhAreaRows, jhChildPages, type JhPageKey } from "@/lib/jobhacking/sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import { JH_PAGE_ICONS } from "./pageIcons";

// The Artefacts hub — docs/UX_JOBHACKING.md §10 (decision 2026-11-09). The
// three artefacts are pages of their own; this is where the mobile Artefacts
// tab lands, and where a link to /jobhacking/artefacts still goes. One row per
// page in the Settings hub's grammar (state glyph · label · what it holds ·
// chevron), nothing else: on desktop the sidebar already lists the three, so
// the hub is a landing, not a second menu.
export default function ArtefactsHub() {
  const { user } = useAuth();
  const uid = user?.uid;
  const hub = findJhPage("artefacts")!;
  const pages = useMemo(() => jhChildPages("artefacts"), []);
  const items = useMemo<SectionItem<JhPageKey>[]>(
    () => pages.map((p) => ({ key: p.key, label: p.label, title: p.title, ask: p.intro, href: p.href, icon: JH_PAGE_ICONS[p.key] })),
    [pages],
  );
  const { data: profile, loading: profileLoading } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup, loading: setupLoading } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const rows = useMemo<SectionRow<JhPageKey>[]>(
    () => jhAreaRows({ setup, profile }, { portal: "jobhacking" }).filter((r) => pages.some((p) => p.key === r.key)),
    [setup, profile, pages],
  );
  const loading = !uid || profileLoading || setupLoading;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="JobHacking" title={hub.title} intro={hub.intro} />
      <div className="md:max-w-3xl">
        {loading
          ? <p className="text-jh-mute animate-pulse">Loading…</p>
          : <SectionList items={items} rows={rows} variant="rows" label="Artefacts pages" />}
      </div>
    </div>
  );
}
