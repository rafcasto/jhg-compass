import { describe, it, expect } from "vitest";
import {
  AGENTS_PAGE, JH_FILE_EDIT, JH_LIST_OF, JH_NAV, JH_PAGES, JH_SECTIONS, JH_SETTINGS_HREF, SETTINGS_BASE, findJhPage, jhAreaRows, jhFileEditHref, jhGoal, jhNavActive, jhPageHref, jhPagesFor, jhSectionsInMenu,
  jhRowsFor, jhSectionFields, jhSectionHref, jhSectionSummaries, jhSectionsFor, parseJhSection, trueNorthBlanks, trueNorthText,
} from "@/lib/jobhacking/sections";
import { FILE_SECTIONS } from "@/lib/profile-sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// The one registry of the profile pages — docs/UX_JOBHACKING.md,
// docs/UX_SETTINGS_HUB.md. The JobHacking menu and sections are the ones Rafael
// specified on 2026-11-03 and render exactly so; Compass → Settings renders the
// same pages plus the sections only its agents read (`only: "compass"`,
// 2026-11-07). Every section reads a field profile.yml carries (never invent one).

const profile = { email: "priya@example.com", firstName: "Priya", lastName: "Natarajan" } as Profile;
const setup = {
  goalSource: "intake",
  intakeGoal: { role: "Customer Success Manager", seniority: "Senior", subsector: "HR tech SaaS", companyType: "Scale-up", city: "Melbourne, Australia", salary: "AUD 140,000–165,000" },
  contact: { title: "Senior Customer Success Manager for enterprise SaaS", phone: "+61 400 555 018", linkedin: "linkedin.com/in/example" },
  policy: { minimumSalary: "AUD 130,000", locationFlexibility: "Y, AEST/AEDT hours", visaStatus: "Australian permanent resident", authorizedIn: ["Australia"] },
  personalization: {
    targetRoles: [{ archetype: "Customer Success Manager" }, { archetype: "Onboarding Manager" }, { archetype: "Renewals Manager" }],
    exitNarrative: "I started in customer support and moved into customer success.",
    crossCuttingAdvantage: "I treat retention as a number to forecast, not a feeling.",
    compTargets: "Target AUD 140,000–165,000; floor AUD 130,000.",
    locationPolicy: ["Will work in: Melbourne", "Remote: Y", "Relocate: N"],
  },
  portals: { companies: [{ name: "Wattle HR Cloud", careersUrl: "https://boards.example/wattle" }, { name: "Grevillea Clinic Systems", careersUrl: "" }], positive: ["Customer Success Manager"], negative: ["intern"] },
  companyLists: {
    top3: { sunrise: [{ rank: 1, name: "Wattle HR Cloud" }, { rank: 2, name: "Coolabah Health Software" }, { rank: 4, name: "Ironbark Logistics SaaS" }] },
    top10: { sunrise: Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, name: `Co ${i + 1}` })) },
    all: { sunrise: Array.from({ length: 37 }, (_, i) => ({ rank: i + 1, name: `Co ${i + 1}` })), sunset: [{ rank: 16, name: "Old 16" }, { rank: 40, name: "Old 40" }], unclassified: [{ rank: 13, name: "Maybe 13" }] },
  },
  narrative: { proofPoints: [{ name: "Churn halving", heroMetric: "Logo churn 8% → 4% in 12 months" }, { name: "Renewal uplift" }] },
  stories: [{ id: "S1", title: "Churn halving", result: "Halved logo churn.", provenance: "verified" }, { id: "S2", title: "Renewal uplift", provenance: "estimate" }, { title: "Onboarding redesign" }],
  snapshots: [{ company: "Wattle HR Cloud", storyId: "S1", results: ["8%", "4%"] }],
  cvMarkdown: Array.from({ length: 40 }, (_, i) => `- Led item ${i} across teams with measurable results`).join("\n"),
  linkedin: { headline: "Senior CSM for enterprise SaaS", experience: [{ title: "CSM", company: "Acme", start: "2021-02" }, { title: "Support Lead", company: "Beta", start: "2018-01", end: "2021-01" }], skills: ["Retention", "Onboarding"] },
} as CareerOpsSetupV2;

describe("JobHacking — pages and sections", () => {
  it("has the four pages in order, and Settings apart from them", () => {
    expect(JH_PAGES.map((p) => p.label)).toEqual(["Narrative", "True North", "Target companies", "Artefacts"]);
    expect(JH_PAGES.map((p) => p.href)).toEqual(["/jobhacking/narrative", "/jobhacking/true-north", "/jobhacking/companies", "/jobhacking/artefacts"]);
    expect(JH_SETTINGS_HREF).toBe("/jobhacking/settings");
  });

  describe("the shell's menu is two groups over the same pages (decision 2026-11-08)", () => {
    it("Compass: Narrative · True North · Target companies — the pages; Artefacts: Story Bank · Master CV · LinkedIn profile — that page's sections", () => {
      expect(JH_NAV.map((g) => g.label)).toEqual(["Compass", "Artefacts"]);
      expect(JH_NAV[0].items.map((i) => [i.label, i.href, i.section])).toEqual([
        ["Narrative", "/jobhacking/narrative", undefined], ["True North", "/jobhacking/true-north", undefined], ["Target companies", "/jobhacking/companies", undefined],
      ]);
      expect(JH_NAV[1].items.map((i) => [i.label, i.href, i.page])).toEqual([
        ["Story Bank", "/jobhacking/artefacts?section=story-bank", "artefacts"], ["Master CV", "/jobhacking/artefacts?section=master-cv", "artefacts"], ["LinkedIn profile", "/jobhacking/artefacts?section=linkedin-profile", "artefacts"],
      ]);
      // The same labels as the page's own rail — the menu never renames a section.
      expect(JH_NAV[1].items.map((i) => i.label)).toEqual(jhSectionsFor("artefacts").map((s) => s.label));
    });
    it("only the Artefacts page hands its rail to the sidebar; the registry's pages are unchanged", () => {
      expect(jhSectionsInMenu("artefacts")).toBe(true);
      expect(["narrative", "true-north", "companies", "agents"].map((p) => jhSectionsInMenu(p as never))).toEqual([false, false, false, false]);
      expect(jhPagesFor("jobhacking").map((p) => p.key)).toEqual(["narrative", "true-north", "companies", "artefacts"]);
    });
    it("lights one row per URL: a page row by its path; a section row by its page and the open section, the first when ?section= is absent", () => {
      const [narrative, trueNorth] = JH_NAV[0].items;
      const [storyBank, masterCv, linkedin] = JH_NAV[1].items;
      expect(jhNavActive(narrative, "/jobhacking/narrative", null)).toBe(true);
      expect(jhNavActive(narrative, "/jobhacking/narrative", "contact")).toBe(true);
      expect(jhNavActive(trueNorth, "/jobhacking/narrative", null)).toBe(false);
      expect(jhNavActive(storyBank, "/jobhacking/artefacts", null)).toBe(true);
      expect(jhNavActive(masterCv, "/jobhacking/artefacts", null)).toBe(false);
      expect(jhNavActive(masterCv, "/jobhacking/artefacts", "master-cv")).toBe(true);
      expect(jhNavActive(storyBank, "/jobhacking/artefacts", "master-cv")).toBe(false);
      expect(jhNavActive(linkedin, "/jobhacking/artefacts", "linkedin-profile")).toBe(true);
      // An unknown section is the overview, which opens on the first section.
      expect(jhNavActive(storyBank, "/jobhacking/artefacts", "nope")).toBe(true);
      // Another portal's path, or a sibling path with the same prefix, lights nothing.
      expect(jhNavActive(storyBank, "/settings/artefacts", "story-bank")).toBe(false);
      expect(jhNavActive(narrative, "/jobhacking/narrative-x", null)).toBe(false);
    });
  });

  it("Narrative is exactly Contact details · Headline · Bridge story · Core competencies", () => {
    expect(jhSectionsFor("narrative").map((s) => s.label)).toEqual(["Contact details", "Headline", "Bridge story", "Core competencies"]);
  });

  it("True North is exactly Target industry · Target roles · Seniority · Salary range · Location · Company type · Boundaries", () => {
    expect(jhSectionsFor("true-north").map((s) => s.label)).toEqual(["Target industry", "Target roles", "Seniority", "Salary range", "Location", "Company type", "Boundaries"]);
  });

  it("Target companies is the Packer's three ranked lists, then the watchlist (decision 2026-11-05)", () => {
    expect(jhSectionsFor("companies").map((s) => s.label)).toEqual(["Top 3", "Top 10", "Top 40", "Watchlist"]);
    expect(jhSectionsFor("companies").map((s) => s.key)).toEqual(["top3", "top10", "top40", "companies"]);
    expect(JH_LIST_OF).toEqual({ top3: "top3", top10: "top10", top40: "all" });
  });

  it("Artefacts is the Packer's story bank, the master CV, then the LinkedIn profile (decision 2026-11-05)", () => {
    expect(jhSectionsFor("artefacts").map((s) => s.label)).toEqual(["Story Bank", "Master CV", "LinkedIn profile"]);
    expect(jhSectionsFor("artefacts").map((s) => s.key)).toEqual(["story-bank", "master-cv", "linkedin-profile"]);
    expect(JH_SECTIONS.length).toBe(22);
  });

  it("Compass → Settings renders the same pages plus the Agents area, and the Compass-only sections in place (decision 2026-11-07)", () => {
    expect(jhPagesFor("jobhacking")).toEqual([...JH_PAGES]);
    expect(jhPagesFor("compass").map((p) => p.key)).toEqual(["narrative", "true-north", "companies", "artefacts", "agents"]);
    expect(AGENTS_PAGE.only).toBe("compass");
    expect(findJhPage("agents")?.label).toBe("Agents");
    // Work rights after Location; Portfolio last among the artefacts; the JobHacking pages never see them.
    expect(jhSectionsFor("true-north", { portal: "compass" }).map((s) => s.key)).toEqual(["industry", "roles", "seniority", "salary", "location", "work-rights", "company-type", "boundaries"]);
    expect(jhSectionsFor("artefacts", { portal: "compass" }).map((s) => s.key)).toEqual(["story-bank", "master-cv", "linkedin-profile", "portfolio"]);
    expect(jhSectionsFor("narrative", { portal: "compass" })).toEqual(jhSectionsFor("narrative"));
    expect(jhSectionsFor("companies", { portal: "compass" })).toEqual(jhSectionsFor("companies"));
    // Portal accounts need the CareerOps worker; the JobHacking portal has no Agents page at all.
    expect(jhSectionsFor("agents", { portal: "compass" }).map((s) => s.key)).toEqual(["notes"]);
    expect(jhSectionsFor("agents", { portal: "compass", careerOps: true }).map((s) => s.key)).toEqual(["accounts", "notes"]);
    expect(jhSectionsFor("agents")).toEqual([]);
    expect((JH_SECTIONS as readonly { key: string; only?: string }[]).filter((s) => s.only === "compass").map((s) => s.key)).toEqual(["work-rights", "portfolio", "accounts", "notes"]);
  });

  it("links a page and a section on either portal", () => {
    expect(jhPageHref("true-north")).toBe("/jobhacking/true-north");
    expect(jhPageHref("true-north", SETTINGS_BASE)).toBe("/settings/true-north");
    expect(jhSectionHref("salary", SETTINGS_BASE)).toBe("/settings/true-north?section=salary");
    expect(jhSectionHref("notes", SETTINGS_BASE)).toBe("/settings/agents?section=notes");
    expect(parseJhSection("work-rights", jhSectionsFor("true-north", { portal: "compass" }))).toBe("work-rights");
    expect(parseJhSection("work-rights", jhSectionsFor("true-north"))).toBeNull();
  });

  it("deep-links each section on its own page and parses ?section= per page", () => {
    expect(jhSectionHref("story")).toBe("/jobhacking/narrative?section=story");
    expect(jhSectionHref("salary")).toBe("/jobhacking/true-north?section=salary");
    expect(parseJhSection("salary", jhSectionsFor("true-north"))).toBe("salary");
    expect(parseJhSection("salary", jhSectionsFor("narrative"))).toBeNull();
    expect(parseJhSection("nope")).toBeNull();
    expect(parseJhSection(null)).toBeNull();
  });

  it("names a section for every file section, and links it only on the portal that shows it", () => {
    expect(Object.keys(JH_FILE_EDIT).sort()).toEqual(Object.keys(FILE_SECTIONS).sort());
    expect(JH_FILE_EDIT.northstar).toBe("roles");
    expect(JH_FILE_EDIT.watchlist).toBe("companies");
    expect(JH_FILE_EDIT.companyLists).toBe("top3");
    expect(JH_FILE_EDIT.cv).toBe("master-cv");
    expect(JH_FILE_EDIT.artefacts).toBe("story-bank");
    expect(JH_FILE_EDIT.linkedin).toBe("linkedin-profile");
    expect(JH_FILE_EDIT.notes).toBe("notes");
    expect(jhFileEditHref("cv")).toBe("/jobhacking/artefacts?section=master-cv");
    expect(jhFileEditHref("cv", "compass")).toBe("/settings/artefacts?section=master-cv");
    // Notes is Compass only — the JobHacking status line has nowhere to send the member.
    expect(jhFileEditHref("notes")).toBeNull();
    expect(jhFileEditHref("notes", "compass")).toBe("/settings/agents?section=notes");
  });
});

describe("JobHacking — rows", () => {
  const rows = Object.fromEntries(jhSectionSummaries({ setup, profile }).map((r) => [r.key, r]));

  it("reads the goal the agents work from — the uploaded (intake) one when it is in effect", () => {
    expect(jhGoal({ setup, profile }).role).toBe("Customer Success Manager");
    expect(jhGoal({ setup: { ...setup, goalSource: "compass" } as CareerOpsSetupV2, profile: { ...profile, goal: { role: "Other" } } }).role).toBe("Other");
  });

  it("summarises every section from the stored fields", () => {
    expect(rows.contact.state).toBe("done");
    expect(rows.contact.summary).toContain("Priya Natarajan");
    expect(rows.competencies).toMatchObject({ state: "done", summary: "I treat retention as a number to forecast, not a feeling." });
    expect(rows.headline.summary).toBe("Senior Customer Success Manager for enterprise SaaS");
    expect(rows.story.state).toBe("done");
    expect(rows.roles).toMatchObject({ state: "done", summary: "Customer Success Manager · 3 archetypes", count: "3" });
    expect(rows.seniority).toMatchObject({ state: "done", summary: "Senior" });
    expect(rows.salary).toMatchObject({ state: "done", summary: "AUD 140,000–165,000 · floor AUD 130,000 · comp notes", count: "3/3" });
    expect(rows.industry).toMatchObject({ state: "done", summary: "HR tech SaaS" });
    expect(rows["company-type"]).toMatchObject({ state: "done", summary: "Scale-up" });
    expect(rows.location).toMatchObject({ state: "done", count: "3/3" });
    expect(rows.location.summary).toContain("Melbourne, Australia");
    expect(rows.location.summary).toContain("3 rules");
    expect(rows.companies).toMatchObject({ state: "done", count: "2" });
    expect(rows.companies.summary).toContain("1 company without a careers page");
  });

  it("summarises the ranked lists: the Top 3 by name, the longer two by size and trend", () => {
    expect(rows.top3).toMatchObject({ state: "done", summary: "Wattle HR Cloud, Coolabah Health Software, Ironbark Logistics SaaS", count: "3" });
    expect(rows.top10).toMatchObject({ state: "done", summary: "10 companies · all sunrise", count: "10" });
    expect(rows.top40).toMatchObject({ state: "done", summary: "40 companies · 37 sunrise · 2 sunset · 1 not yet classified", count: "40" });
  });

  it("summarises the story bank by what the file carries, and the master CV as Settings does", () => {
    expect(rows["story-bank"]).toMatchObject({ state: "done", summary: "3 stories · 2 proof points · 1 snapshot", count: "3" });
    expect(rows["master-cv"].state).toBe("done");
    expect(rows["master-cv"].summary).toMatch(/^\d+ words · (Ready to score|A bit thin)$/);
    expect(rows["linkedin-profile"]).toMatchObject({ state: "done", summary: "Headline · 2 roles · 2 skills", count: "3/7" });
  });

  it("is partial when only the supporting fields are set, and empty when nothing is", () => {
    const only = Object.fromEntries(jhSectionSummaries({ setup: { policy: { minimumSalary: "1" }, personalization: { targetRoles: [{ archetype: "x" }] } } as CareerOpsSetupV2, profile }).map((r) => [r.key, r]));
    expect(only.salary.state).toBe("partial");
    expect(only.roles.state).toBe("partial");
    expect(only.seniority).toMatchObject({ state: "empty", summary: "Not set" });
    expect(only.industry.state).toBe("empty");
    expect(only["company-type"]).toMatchObject({ state: "empty", summary: "Not set" });
    expect(only.companies.summary).toBe("Not set");
    // The lists cannot be typed in, so the empty row says where they come from rather than "Not set".
    expect(only.top3).toMatchObject({ state: "empty", summary: "Not in your profile yet" });
    expect(only.top40).toMatchObject({ state: "empty", summary: "Not in your profile yet" });
    expect(only["story-bank"]).toMatchObject({ state: "empty", summary: "Not set" }); // editable here, unlike the lists
    expect(only["master-cv"]).toMatchObject({ state: "empty", summary: "Not set" });
    expect(only["linkedin-profile"]).toMatchObject({ state: "empty", summary: "Not in your profile yet" });
  });

  it("returns a page's rows in that page's order", () => {
    expect(jhRowsFor(jhSectionsFor("true-north"), jhSectionSummaries({ setup, profile })).map((r) => r.key)).toEqual(["industry", "roles", "seniority", "salary", "location", "company-type", "boundaries"]);
  });

  it("summarises the Compass-only sections from the same stored fields", () => {
    const all = Object.fromEntries(jhSectionSummaries({ setup, profile, accounts: 2 }).map((r) => [r.key, r]));
    expect(all["work-rights"]).toMatchObject({ state: "done", summary: "Australian permanent resident · Australia" });
    expect(all.accounts).toMatchObject({ state: "done", summary: "2 accounts saved · encrypted for the worker", count: "2" });
    expect(all.portfolio).toMatchObject({ state: "empty", summary: "Not set" });
    expect(all.notes).toMatchObject({ state: "empty", summary: "Not set" });
    const sponsored = Object.fromEntries(jhSectionSummaries({ setup: { policy: { authorizedIn: ["Chile"], needsSponsorship: true } } as CareerOpsSetupV2, profile }).map((r) => [r.key, r]));
    expect(sponsored["work-rights"]).toMatchObject({ state: "partial", summary: "Chile · needs sponsorship" });
  });

  it("Target roles carries the framing and Salary range the negotiation scripts, so the upload preview sees them (decision 2026-11-07)", () => {
    const withExtras = { ...setup, personalization: { ...setup.personalization, adaptiveFraming: [{ role: "CSM", emphasize: "Retention" }], negotiationScripts: ["I'm targeting 150k."] } } as CareerOpsSetupV2;
    expect(jhSectionFields("roles", { setup: withExtras, profile })).toMatchObject({ role: "Customer Success Manager", framing: [{ role: "CSM", emphasize: "Retention" }] });
    expect(jhSectionFields("salary", { setup: withExtras, profile })).toMatchObject({ scripts: ["I'm targeting 150k."] });
    expect(jhSectionFields("work-rights", { setup, profile })).toEqual({ visaStatus: "Australian permanent resident", authorizedIn: ["Australia"], needsSponsorship: undefined });
    expect(jhSectionFields("accounts", { setup, profile })).toBeNull();
  });
});

describe("Compass → Settings — the hub's rows", () => {
  it("one row per area: done when every section is, partial from the first, the first filled section's line, done/total", () => {
    const areas = Object.fromEntries(jhAreaRows({ setup, profile, accounts: 1 }, { portal: "compass", careerOps: true }).map((r) => [r.key, r]));
    expect(Object.keys(areas)).toEqual(["narrative", "true-north", "companies", "artefacts", "agents"]);
    expect(areas.narrative).toMatchObject({ state: "done", count: "4/4" });
    expect(areas.narrative.summary).toContain("Priya Natarajan");
    // True North on Compass has eight sections; this setup fills seven (work rights too) — the boundaries are not in the file.
    expect(areas["true-north"]).toMatchObject({ state: "partial", summary: "HR tech SaaS", count: "7/8" });
    expect(areas.companies).toMatchObject({ state: "done", count: "4/4" });
    expect(areas.artefacts).toMatchObject({ state: "partial", count: "3/4" });
    expect(areas.agents).toMatchObject({ state: "partial", summary: "1 account saved · encrypted for the worker", count: "1/2" });
  });

  it("is empty everywhere for a new member, and never lists the Agents area for JobHacking", () => {
    const fresh = jhAreaRows({ setup: null, profile: null }, { portal: "compass" });
    expect(fresh.every((r) => r.state === "empty" && r.summary === "Not set")).toBe(true);
    expect(fresh.map((r) => r.count)).toEqual(["0/4", "0/8", "0/4", "0/4", "0/1"]);
    expect(jhAreaRows({ setup: null, profile: null }).map((r) => r.key)).toEqual(["narrative", "true-north", "companies", "artefacts"]);
  });
});

describe("JobHacking — the True North statement", () => {
  it("fills the five blanks from the goal, seniority in front of the title", () => {
    expect(trueNorthBlanks(setup.intakeGoal)).toEqual({
      role: "Senior Customer Success Manager", industry: "HR tech SaaS", location: "Melbourne, Australia", salary: "AUD 140,000–165,000", companyType: "Scale-up",
    });
    expect(trueNorthText(setup.intakeGoal)).toBe(
      "In 60 days, I'm working as Senior Customer Success Manager, in HR tech SaaS. I'm based in Melbourne, Australia and I'm making AUD 140,000–165,000 yearly before tax. I enjoy working for Scale-up.",
    );
  });

  it("does not double a level already typed into the title, and reads a known company type with its article", () => {
    expect(trueNorthBlanks({ role: "Senior Customer Success Manager", seniority: "Senior", companyType: "Scaleup (established)" })).toMatchObject({ role: "Senior Customer Success Manager", companyType: "a Scaleup (established)" });
  });

  it("shows the template's own labels for blanks", () => {
    expect(trueNorthText({})).toBe(
      "In 60 days, I'm working as [Target Role + Target Seniority], in [Target Industry]. I'm based in [Target Location] and I'm making [Target Salary] yearly before tax. I enjoy working for [Target Company Type].",
    );
  });
});
