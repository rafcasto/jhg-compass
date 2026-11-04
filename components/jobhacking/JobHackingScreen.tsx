"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Contact, ListOrdered, MapPin, Medal, Navigation, Quote, Sparkles, Target, Trophy, Wallet, Factory, Layers, Store, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/components/AuthProvider";
import ContactPolicy from "@/components/careerops/ContactPolicy";
import Personalization from "@/components/careerops/Personalization";
import Identity from "@/components/profile/Identity";
import SectionsPage from "@/components/profile/SectionsPage";
import type { SectionItem } from "@/components/profile/SectionList";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { JH_LIST_OF, findJhPage, jhGoal, jhRowsFor, jhSectionHref, jhSectionSummaries, jhSectionsFor, parseJhSection, type JhPageKey, type JhSectionKey } from "@/lib/jobhacking/sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import CompanyListPanel from "./CompanyListPanel";
import WatchlistSection from "./WatchlistSection";
import TrueNorthPanel from "./TrueNorthPanel";
import TrueNorthStatement from "./TrueNorthStatement";

// The three JobHacking pages — docs/UX_JOBHACKING.md. One screen, one layout
// (SectionsPage), one registry (lib/jobhacking/sections); the page decides
// which sections, the section decides which panel. Every panel is one of the
// Profile/Settings panels or a True North panel, and saves only its own fields.

const ICONS: Record<JhSectionKey, ComponentType<LucideProps>> = {
  contact: Contact, competencies: Layers, headline: Quote, story: Sparkles,
  industry: Factory, roles: Target, seniority: Navigation, salary: Wallet, location: MapPin, "company-type": Store,
  top3: Trophy, top10: Medal, top40: ListOrdered, companies: Building2,
};

export default function JobHackingScreen({ page }: { page: JhPageKey }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const meta = findJhPage(page)!;
  const sections = useMemo(() => jhSectionsFor(page), [page]);
  const items = useMemo<SectionItem<JhSectionKey>[]>(
    () => sections.map((s) => ({ key: s.key, label: s.label, title: s.title, ask: s.ask, href: jhSectionHref(s.key), icon: ICONS[s.key] })),
    [sections],
  );

  const { data: profile, loading: profileLoading } = useLiveDoc<Profile>(uid ? paths.profile(uid) : null);
  const { data: setup, loading: setupLoading } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const params = useSearchParams();
  const active = parseJhSection(params.get("section"), sections);

  const rows = useMemo(() => jhRowsFor(sections, jhSectionSummaries({ setup, profile })), [sections, setup, profile]);
  const goal = useMemo(() => jhGoal({ setup, profile }), [setup, profile]);
  const email = profile?.email ?? user?.email ?? "";

  return (
    <SectionsPage
      id={`jobhacking-${page}`}
      backHref={meta.href}
      eyebrow="JobHacking"
      title={meta.title}
      intro={meta.intro}
      identity={page === "narrative" ? <Identity profile={profile} email={email} /> : undefined}
      lead={page === "true-north" ? <TrueNorthStatement goal={goal} /> : undefined}
      items={items}
      rows={rows}
      active={active}
      loading={!uid || setupLoading || profileLoading}
      panel={(key) => {
        if (!uid) return null;
        switch (key) {
          case "contact": return <ContactPolicy uid={uid} setup={setup} profile={profile} part="contact" />;
          case "competencies": return <Personalization uid={uid} setup={setup} profile={profile} only={["crossCuttingAdvantage"]} saveLabel="Save core competencies" />;
          case "headline": return <ContactPolicy uid={uid} setup={setup} profile={profile} part="headline" />;
          case "story": return <Personalization uid={uid} setup={setup} profile={profile} only={["exitNarrative"]} labels={{ exitNarrative: "Bridge story" }} saveLabel="Save bridge story" />;
          case "industry": case "roles": case "seniority": case "salary": case "location": case "company-type":
            return <TrueNorthPanel uid={uid} setup={setup} profile={profile} section={key} />;
          // The Packer's lists: read-only, the same ranked rows on all three.
          case "top3": case "top10": case "top40":
            return <CompanyListPanel listKey={JH_LIST_OF[key]} list={setup?.companyLists?.[JH_LIST_OF[key]]} />;
          // The watchlist reads as the same rows, with an Edit that opens the shared editor.
          case "companies": return <WatchlistSection uid={uid} setup={setup} goalRole={goal.role} />;
        }
      }}
    />
  );
}
