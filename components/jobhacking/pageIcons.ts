import { Archive, Bot, Building2, Navigation, UserRound, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import type { JhPageKey } from "@/lib/jobhacking/sections";

// One icon per page of the registry — the JobHacking tabs, the Settings hub's
// area rows and the shell share it, so a member who has both portals recognises
// the same glyph for the same page.
export const JH_PAGE_ICONS: Record<JhPageKey, ComponentType<LucideProps>> = {
  narrative: UserRound, "true-north": Navigation, companies: Building2, artefacts: Archive, agents: Bot,
};
