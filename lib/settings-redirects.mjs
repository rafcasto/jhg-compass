// Where the retired /profile and the flat /settings?section= links go now that
// Settings is a hub with areas (decision 2026-11-07, docs/UX_SETTINGS_HUB.md §4).
// Plain JS so next.config.mjs can import it; tested from tests/settings-redirects.test.ts.
//
// Old page · section → the area and section that edit the same field today.
export const SECTION_MOVES = [
  // /profile — Who am I
  { from: "/profile", section: "contact", to: "/settings/narrative?section=contact" },
  { from: "/profile", section: "headline", to: "/settings/narrative?section=headline" },
  { from: "/profile", section: "story", to: "/settings/narrative?section=story" },
  // /profile — What's my target
  { from: "/profile", section: "northstar", to: "/settings/true-north?section=roles" },
  { from: "/profile", section: "logistics", to: "/settings/true-north?section=work-rights" },
  { from: "/profile", section: "targeting", to: "/settings/true-north?section=salary" },
  // /settings — flat sections
  { from: "/settings", section: "cv", to: "/settings/artefacts?section=master-cv" },
  { from: "/settings", section: "companies", to: "/settings/companies?section=companies" },
  { from: "/settings", section: "accounts", to: "/settings/agents?section=accounts" },
  { from: "/settings", section: "archetypes", to: "/settings/true-north?section=roles" },
  { from: "/settings", section: "portfolio", to: "/settings/artefacts?section=portfolio" },
  { from: "/settings", section: "notes", to: "/settings/agents?section=notes" },
];

/** The Next.js redirect entries: one per moved section, then /profile itself → the hub. */
export function settingsRedirects() {
  return [
    ...SECTION_MOVES.map((m) => ({ source: m.from, has: [{ type: "query", key: "section", value: m.section }], destination: m.to, permanent: true })),
    { source: "/profile", destination: "/settings", permanent: true },
  ];
}

// JobHacking's three artefacts became pages of their own (decision 2026-11-09,
// docs/UX_JOBHACKING.md §10): a section link into the old Artefacts page lands
// on the page that section is now. /jobhacking/artefacts itself is their hub.
export const ARTEFACT_MOVES = [
  { section: "story-bank", to: "/jobhacking/story-bank" },
  { section: "master-cv", to: "/jobhacking/master-cv" },
  { section: "linkedin-profile", to: "/jobhacking/linkedin" },
];

export function jobhackingRedirects() {
  return ARTEFACT_MOVES.map((m) => ({ source: "/jobhacking/artefacts", has: [{ type: "query", key: "section", value: m.section }], destination: m.to, permanent: true }));
}
