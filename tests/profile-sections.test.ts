import { describe, it, expect } from "vitest";
import {
  ACTIVE_SECTIONS, DEFAULT_SECTION, FILE_SECTIONS, GROUPS, PROFILE_SECTIONS, groupedSections, parseSection, profileProgress,
  rowsFor, sectionHref, sectionSummaries, sectionsFor,
} from "@/lib/profile-sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

const profile = { email: "ana@example.com", goal: { role: "Delivery Lead", city: "Wellington", salary: "NZ$ 150,000" } } as Profile;

describe("profile sections — the registry", () => {
  it("splits the profile between two pages: who I am / what I target on Profile, what the agents work from on Settings", () => {
    expect(sectionsFor("profile").map((s) => s.key)).toEqual(["contact", "headline", "story", "northstar", "logistics", "targeting"]);
    expect(sectionsFor("settings").map((s) => s.key)).toEqual(["cv", "companies", "archetypes", "portfolio", "notes"]);
    expect(ACTIVE_SECTIONS.length).toBe(12);
  });

  it("only offers portal accounts to a member with CareerOps switched on — the vault needs the worker's key", () => {
    expect(sectionsFor("settings", { careerOps: true }).map((s) => s.key)).toEqual(["cv", "companies", "accounts", "archetypes", "portfolio", "notes"]);
    expect(parseSection("accounts", sectionsFor("settings"))).toBeNull();
    expect(parseSection("accounts", sectionsFor("settings", { careerOps: true }))).toBe("accounts");
  });

  it("Who am I is exactly contact details · headline · exit story (decision 2026-11-01)", () => {
    const who = sectionsFor("profile").filter((s) => s.group === "who");
    expect(who.map((s) => s.label)).toEqual(["Contact details", "Headline", "Exit story"]);
    // Core competencies moved to Settings · Archetypes with the framing they feed.
    expect(sectionsFor("settings").find((s) => s.key === "archetypes")?.title).toBe("Role archetypes and core competencies");
  });

  it("groups the Profile page in the JobHackers vocabulary and hides the reserved sections", () => {
    expect(GROUPS.map((g) => `${g.eyebrow}: ${g.label}`)).toEqual(["Profile: Who am I", "North Star: What's my target", "Artefacts: What value do I create"]);
    const grouped = groupedSections(sectionsFor("profile"));
    expect(grouped.map((g) => [g.group?.key, g.sections.map((s) => s.key)])).toEqual([
      ["who", ["contact", "headline", "story"]],
      ["target", ["northstar", "logistics", "targeting"]],
    ]);
    // Artefacts (stories, proof bank) and the culture screen are registered but not rendered.
    expect(PROFILE_SECTIONS.filter((s) => !s.available).map((s) => s.key)).toEqual(["culture", "stories", "proof"]);
    // Settings is flat: one unnamed group.
    expect(groupedSections(sectionsFor("settings")).map((g) => g.group)).toEqual([null]);
  });

  it("parses ?section= per page, and sends unknown, reserved, absent or other-page keys to the overview", () => {
    expect(parseSection("story", sectionsFor("profile"))).toBe("story");
    expect(parseSection("cv", sectionsFor("profile"))).toBeNull();
    expect(parseSection("cv", sectionsFor("settings"))).toBe("cv");
    expect(parseSection("proof")).toBeNull();
    expect(parseSection("nope")).toBeNull();
    expect(parseSection(null)).toBeNull();
    expect(DEFAULT_SECTION).toEqual({ profile: "contact", settings: "cv" });
  });

  it("deep-links to whichever page edits a section", () => {
    expect(sectionHref("story")).toBe("/profile?section=story");
    expect(sectionHref("companies")).toBe("/settings?section=companies");
  });

  it("maps every editable section of the file to a page section a member can go to; the artefacts have none yet", () => {
    expect(Object.keys(FILE_SECTIONS)).toEqual(["northstar", "contact", "targeting", "watchlist", "companyLists", "notes", "cv", "artefacts", "linkedin"]);
    for (const f of Object.values(FILE_SECTIONS)) if (f.edit) expect(ACTIVE_SECTIONS.some((s) => s.key === f.edit)).toBe(true);
    expect(FILE_SECTIONS.watchlist.edit).toBe("companies");
    expect(FILE_SECTIONS.artefacts.edit).toBeNull();
    expect(FILE_SECTIONS.linkedin.edit).toBeNull(); // read on JobHacking → Artefacts only
    expect(FILE_SECTIONS.companyLists.edit).toBeNull(); // read on the JobHacking portal only (JH_FILE_EDIT)
  });
});

describe("profile sections — what each row says", () => {
  it("says Not set everywhere for a new member, on both pages", () => {
    const rows = sectionSummaries({ setup: null, profile: null });
    expect(rows.every((r) => r.summary === "Not set" && r.state === "empty")).toBe(true);
    expect(profileProgress(rowsFor(sectionsFor("profile"), rows))).toEqual({ done: 0, total: 6, pct: 0 });
    expect(profileProgress(rowsFor(sectionsFor("settings", { careerOps: true }), rows))).toEqual({ done: 0, total: 6, pct: 0 });
  });

  it("quotes the Compass goal when the setup has none", () => {
    const ns = sectionSummaries({ setup: null, profile }).find((r) => r.key === "northstar")!;
    expect(ns.state).toBe("done");
    expect(ns.summary).toBe("Delivery Lead · Wellington · NZ$ 150,000");
    expect(ns.count).toBe("Compass");
  });

  it("quotes the data for a filled profile", () => {
    const setup = {
      cvMarkdown: "# CV\n\n## Experience\n2019 – 2024 Acme " + "word ".repeat(100),
      profileYaml: "", updatedAt: 1,
      goalSource: "intake", intakeGoal: { role: "Senior Delivery Lead", city: "Wellington", salary: "NZ$ 150,000–175,000" },
      contact: { phone: "+64 21 555 0199", linkedin: "in/ana", title: "Delivery Lead for SaaS teams", portfolio: "https://ana.nz", location: "Wellington, New Zealand" },
      policy: { minimumSalary: "NZ$ 140,000", authorizedIn: ["New Zealand", "Australia"] },
      personalization: {
        targetRoles: [{ archetype: "Delivery Lead" }, { archetype: "TPM" }],
        adaptiveFraming: [{ role: "Delivery", emphasize: "Cadence" }],
        exitNarrative: "I was the operations analyst who kept getting pulled into stand-ups.",
        portfolio: { url: "https://www.ana.nz/playbook", description: "The release-cadence playbook" },
        compTargets: "Target NZ$ 150–175k", locationPolicy: ["Will work in: Wellington"],
      },
      portals: { companies: [{ name: "Xero", careersUrl: "https://x" }, { name: "Tracksuit", careersUrl: "https://t" }, { name: "Dovetail", careersUrl: "https://d" }, { name: "Halter", careersUrl: "https://h" }], positive: ["Delivery Lead"], negative: [] },
      notes: "Hard no's: on-site 5 days\nNotice period: 28 days",
    } as CareerOpsSetupV2;
    const rows = Object.fromEntries(sectionSummaries({ setup, profile, accounts: 2 }).map((r) => [r.key, r]));

    // Who am I — the account has no name here, so the row starts at the phone.
    expect(rows.contact.summary).toBe("+64 21 555 0199 · Wellington, New Zealand · LinkedIn · portfolio");
    expect(rows.contact.state).toBe("done");
    expect(rows.headline.summary).toBe("Delivery Lead for SaaS teams");
    expect(rows.headline.state).toBe("done");
    expect(rows.story.summary).toBe("I was the operations analyst who kept getting pulled into stand-ups.");
    expect(rows.story.state).toBe("done");
    expect(rows.story.count).toBeUndefined();
    // What's my target
    expect(rows.northstar.summary).toBe("Senior Delivery Lead · Wellington · NZ$ 150,000–175,000");
    expect(rows.northstar.count).toBe("profile");
    expect(rows.logistics.summary).toBe("floor NZ$ 140,000 · New Zealand / Australia");
    expect(rows.logistics.state).toBe("partial");
    expect(rows.targeting.summary).toBe("Target NZ$ 150–175k · 1 location rule");
    expect(rows.targeting.count).toBe("2/3");
    // Settings
    expect(rows.cv.summary).toMatch(/^\d+ words · Ready to score$/);
    expect(rows.companies.summary).toBe("Xero, Tracksuit, Dovetail…");
    expect(rows.companies.count).toBe("4");
    expect(rows.accounts.summary).toBe("2 accounts saved · encrypted for the worker");
    expect(rows.archetypes.summary).toBe("Delivery Lead, TPM · 1 framing");
    expect(rows.archetypes.state).toBe("done");
    expect(rows.archetypes.count).toBe("2");
    expect(rows.portfolio.summary).toBe("ana.nz · The release-cadence playbook");
    expect(rows.notes.summary).toBe("Hard no's: on-site 5 days");

    expect(profileProgress(rowsFor(sectionsFor("profile"), Object.values(rows)))).toEqual({ done: 4, total: 6, pct: 67 });
    expect(profileProgress(rowsFor(sectionsFor("settings", { careerOps: true }), Object.values(rows)))).toEqual({ done: 6, total: 6, pct: 100 });
  });

  it("contact: the account's name and email count, but 'done' needs the phone and one more", () => {
    const named = { ...profile, firstName: "Ana", lastName: "Reyes" } as Profile;
    const bare = sectionSummaries({ setup: null, profile: named }).find((r) => r.key === "contact")!;
    expect(bare.summary).toBe("Ana Reyes");
    expect(bare.state).toBe("partial");
    const withPhone = sectionSummaries({ setup: { cvMarkdown: "", profileYaml: "", updatedAt: 1, contact: { phone: "+64 21 000 0000" } } as CareerOpsSetupV2, profile: named }).find((r) => r.key === "contact")!;
    expect(withPhone.state).toBe("partial");
    const linked = sectionSummaries({ setup: { cvMarkdown: "", profileYaml: "", updatedAt: 1, contact: { phone: "+64 21 000 0000", linkedin: "in/ana" } } as CareerOpsSetupV2, profile: named }).find((r) => r.key === "contact")!;
    expect(linked.state).toBe("done");
    expect(linked.summary).toBe("Ana Reyes · +64 21 000 0000 · LinkedIn");
  });

  it("archetypes: core competencies show up in the row and count toward it", () => {
    const rows = Object.fromEntries(sectionSummaries({ setup: { cvMarkdown: "", profileYaml: "", updatedAt: 1, personalization: { crossCuttingAdvantage: "Cadence." } } as CareerOpsSetupV2, profile: null }).map((r) => [r.key, r]));
    expect(rows.archetypes.summary).toBe("competencies · no archetypes yet");
    expect(rows.archetypes.state).toBe("partial");
  });

  it("truncates long quotes to one line's worth", () => {
    const long = "x".repeat(200);
    const rows = Object.fromEntries(sectionSummaries({ setup: { cvMarkdown: "", profileYaml: "", updatedAt: 1, notes: long } as CareerOpsSetupV2, profile: null }).map((r) => [r.key, r]));
    expect(rows.notes.summary.length).toBeLessThanOrEqual(72);
    expect(rows.notes.summary.endsWith("…")).toBe(true);
  });
});
