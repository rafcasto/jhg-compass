"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Building2, Contact, FileText, Linkedin, ListOrdered, MapPin, Medal, Navigation, Quote, ShieldBan, Sparkles, Target, Trophy, Wallet, Factory, Layers, Store, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/components/AuthProvider";
import ContactPolicy from "@/components/careerops/ContactPolicy";
import CvPanel from "@/components/careerops/CvPanel";
import Personalization from "@/components/careerops/Personalization";
import Identity from "@/components/profile/Identity";
import SectionsPage from "@/components/profile/SectionsPage";
import type { SectionItem } from "@/components/profile/SectionList";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { JH_LIST_OF, findJhPage, jhGoal, jhRowsFor, jhSectionHref, jhSectionSummaries, jhSectionsFor, parseJhSection, type JhPageKey, type JhSectionKey } from "@/lib/jobhacking/sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import { cvRuleFacts, cvRuleLists, languageLines } from "@/lib/jobhacking/workbook";
import CompanyListPanel from "./CompanyListPanel";
import FileFacts from "./FileFacts";
import LinkedinProfilePanel from "./LinkedinProfilePanel";
import StoryBankPanel from "./StoryBankPanel";
import WatchlistSection from "./WatchlistSection";
import TrueNorthPanel from "./TrueNorthPanel";
import TrueNorthStatement from "./TrueNorthStatement";
import { BoundariesPanel, CompetencyFacts, ContactFacts, HeadlineFacts, StoryFacts, TrueNorthFacts } from "./WorkbookPanels";

// The four JobHacking pages — docs/UX_JOBHACKING.md. One screen, one layout
// (SectionsPage), one registry (lib/jobhacking/sections); the page decides
// which sections, the section decides which panel. Every panel is one of the
// Profile/Settings panels or a True North panel, and saves only its own fields.
// Under each editor, what the section's Packer file carries beside it (the
// workbook, 2026-11-07) — read-only, through FileFacts.

const ICONS: Record<JhSectionKey, ComponentType<LucideProps>> = {
  contact: Contact, competencies: Layers, headline: Quote, story: Sparkles,
  industry: Factory, roles: Target, seniority: Navigation, salary: Wallet, location: MapPin, "company-type": Store, boundaries: ShieldBan,
  top3: Trophy, top10: Medal, top40: ListOrdered, companies: Building2,
  "story-bank": BookOpen, "master-cv": FileText, "linkedin-profile": Linkedin,
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
        const jhg = setup?.jhg;
        switch (key) {
          case "contact": return <div className="space-y-5"><ContactPolicy uid={uid} setup={setup} profile={profile} part="contact" /><ContactFacts jhg={jhg} /></div>;
          case "competencies": return <div className="space-y-5"><Personalization uid={uid} setup={setup} profile={profile} only={["crossCuttingAdvantage"]} saveLabel="Save core competencies" /><CompetencyFacts setup={setup} jhg={jhg} /></div>;
          case "headline": return <div className="space-y-5"><ContactPolicy uid={uid} setup={setup} profile={profile} part="headline" /><HeadlineFacts setup={setup} /></div>;
          case "story": return <div className="space-y-5"><Personalization uid={uid} setup={setup} profile={profile} only={["exitNarrative"]} labels={{ exitNarrative: "Bridge story" }} saveLabel="Save bridge story" /><StoryFacts jhg={jhg} /></div>;
          case "industry": case "roles": case "seniority": case "salary": case "location": case "company-type":
            return <div className="space-y-5"><TrueNorthPanel uid={uid} setup={setup} profile={profile} section={key} /><TrueNorthFacts section={key} jhg={jhg} /></div>;
          // The True North file's boundaries — read-only.
          case "boundaries": return <BoundariesPanel jhg={jhg} />;
          // The Packer's lists: read-only, the same ranked rows on all three, each with the research written for it.
          case "top3": case "top10": case "top40":
            return <CompanyListPanel listKey={JH_LIST_OF[key]} list={setup?.companyLists?.[JH_LIST_OF[key]]} jhg={jhg} />;
          // The watchlist reads as the same rows, with an Edit that opens the shared editor.
          case "companies": return <WatchlistSection uid={uid} setup={setup} goalRole={goal.role} />;
          // The story bank: read as rows, edited on request, with the STAR lines and story facts the Packer wrote.
          case "story-bank": return <StoryBankPanel uid={uid} source={setup} jhg={jhg} />;
          // The same CV panel as Settings · Master CV — one editor for the one field — then the Artefacts file's house rules.
          case "master-cv": return (
            <div className="space-y-5">
              <CvPanel uid={uid} setup={setup} profile={profile} goalRole={goal.role} />
              <FileFacts id="wb-cv-rules" title="From your Artefacts file" from="artefacts.yml" facts={cvRuleFacts(jhg)} lists={[...cvRuleLists(jhg), ...(languageLines(jhg).length ? [{ label: "Languages you're learning", items: languageLines(jhg) }] : [])]} note="Every tailored CV follows the house rules; a locked section is never rewritten." />
            </div>
          );
          // The LinkedIn profile to build: read-only blocks, each against LinkedIn's limit, with Copy.
          case "linkedin-profile": return <LinkedinProfilePanel linkedin={setup?.linkedin} />;
        }
      }}
    />
  );
}
