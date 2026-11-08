import { Archive, BookOpen, Bot, Building2, Contact, Factory, FileText, Globe, KeyRound, Layers, Linkedin, ListOrdered, MapPin, Medal, Navigation, Quote, ShieldBan, ShieldCheck, Sparkles, StickyNote, Store, Target, Trophy, UserRound, Wallet, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import type { JhPageKey, JhSectionKey } from "@/lib/jobhacking/sections";

// One icon per page of the registry — the JobHacking tabs, the Settings hub's
// area rows and the shell share it, so a member who has both portals recognises
// the same glyph for the same page.
export const JH_PAGE_ICONS: Record<JhPageKey, ComponentType<LucideProps>> = {
  narrative: UserRound, "true-north": Navigation, companies: Building2, artefacts: Archive, agents: Bot,
};

// One icon per section — the section heading on every sectioned page, and the
// JobHacking sidebar's Artefacts rows (decision 2026-11-08), so the glyph beside
// "Story Bank" in the menu is the glyph above the Story Bank.
export const JH_SECTION_ICONS: Record<JhSectionKey, ComponentType<LucideProps>> = {
  contact: Contact, competencies: Layers, headline: Quote, story: Sparkles,
  industry: Factory, roles: Target, seniority: Navigation, salary: Wallet, location: MapPin, "work-rights": ShieldCheck, "company-type": Store, boundaries: ShieldBan,
  top3: Trophy, top10: Medal, top40: ListOrdered, companies: Building2,
  "story-bank": BookOpen, "master-cv": FileText, "linkedin-profile": Linkedin, portfolio: Globe,
  accounts: KeyRound, notes: StickyNote,
};
