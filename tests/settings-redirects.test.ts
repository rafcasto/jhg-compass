import { describe, it, expect } from "vitest";
import { ARTEFACT_MOVES, SECTION_MOVES, jobhackingRedirects, settingsRedirects } from "../lib/settings-redirects.mjs";
import { JH_SECTIONS, jhSectionHref, SETTINGS_BASE, findJhSection, jhPagesFor, jhSectionsFor } from "@/lib/jobhacking/sections";

// Every link the retired Profile page and the flat Settings page handed out
// still lands on the section that edits the same field (docs/UX_SETTINGS_HUB.md §4).

describe("settings redirects", () => {
  it("moves each old section to a real Compass Settings section", () => {
    for (const m of SECTION_MOVES) {
      const [path, query] = m.to.split("?");
      const area = path.replace(`${SETTINGS_BASE}/`, "");
      expect(jhPagesFor("compass").some((p) => p.key === area), m.to).toBe(true);
      const key = new URLSearchParams(query).get("section")!;
      const def = findJhSection(key);
      expect(def, m.to).toBeDefined();
      expect(def!.page).toBe(area);
      expect(jhSectionHref(def!.key, SETTINGS_BASE)).toBe(m.to);
    }
  });

  it("covers the twelve sections the two old pages had, once each", () => {
    const old = SECTION_MOVES.map((m) => `${m.from}?section=${m.section}`);
    expect(new Set(old).size).toBe(12);
    expect(SECTION_MOVES.filter((m) => m.from === "/profile").map((m) => m.section)).toEqual(["contact", "headline", "story", "northstar", "logistics", "targeting"]);
    expect(SECTION_MOVES.filter((m) => m.from === "/settings").map((m) => m.section)).toEqual(["cv", "companies", "accounts", "archetypes", "portfolio", "notes"]);
  });

  it("is a Next.js redirect per move, matched on ?section=, then /profile → the hub", () => {
    const all = settingsRedirects();
    expect(all).toHaveLength(SECTION_MOVES.length + 1);
    expect(all[0]).toEqual({ source: "/profile", has: [{ type: "query", key: "section", value: "contact" }], destination: "/settings/narrative?section=contact", permanent: true });
    expect(all[all.length - 1]).toEqual({ source: "/profile", destination: "/settings", permanent: true });
    // A section key the registry does not know would 404 — none of ours does.
    expect(JH_SECTIONS.map((s) => s.key)).toEqual(expect.arrayContaining(SECTION_MOVES.map((m) => new URLSearchParams(m.to.split("?")[1]).get("section"))));
  });
});

describe("JobHacking artefact redirects (decision 2026-11-09)", () => {
  it("sends each section link into the old Artefacts page to the page that section is now", () => {
    expect(ARTEFACT_MOVES.map((m) => m.section)).toEqual(jhSectionsFor("artefacts").map((s) => s.key));
    for (const m of ARTEFACT_MOVES) {
      expect(jhSectionHref(m.section as never)).toBe(`${m.to}?section=${m.section}`);
    }
    const all = jobhackingRedirects();
    expect(all).toHaveLength(3);
    expect(all[0]).toEqual({ source: "/jobhacking/artefacts", has: [{ type: "query", key: "section", value: "story-bank" }], destination: "/jobhacking/story-bank", permanent: true });
  });
});
