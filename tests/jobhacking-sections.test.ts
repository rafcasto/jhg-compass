import { describe, it, expect } from "vitest";
import {
  JH_FILE_EDIT, JH_PAGES, JH_SECTIONS, JH_SETTINGS_HREF, jhGoal, jhRowsFor, jhSectionHref, jhSectionSummaries, jhSectionsFor,
  parseJhSection, trueNorthBlanks, trueNorthText,
} from "@/lib/jobhacking/sections";
import { FILE_SECTIONS } from "@/lib/profile-sections";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// The JobHacking portal's registry — docs/UX_JOBHACKING.md. The menu and the
// sections are the ones Rafael specified on 2026-11-03; every section reads a
// field profile.yml carries (decision: never invent one).

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
} as CareerOpsSetupV2;

describe("JobHacking — pages and sections", () => {
  it("has the three menu pages in order, and Settings apart from them", () => {
    expect(JH_PAGES.map((p) => p.label)).toEqual(["Profile", "True North", "Target companies"]);
    expect(JH_PAGES.map((p) => p.href)).toEqual(["/jobhacking/profile", "/jobhacking/true-north", "/jobhacking/companies"]);
    expect(JH_SETTINGS_HREF).toBe("/jobhacking/settings");
  });

  it("Profile is exactly Contact details · Core competencies · Headline · Exit story", () => {
    expect(jhSectionsFor("profile").map((s) => s.label)).toEqual(["Contact details", "Core competencies", "Headline", "Exit story"]);
  });

  it("True North is exactly the five targets", () => {
    expect(jhSectionsFor("true-north").map((s) => s.label)).toEqual(["Target roles", "Target seniority", "Target salary", "Target industry", "Target location"]);
    expect(jhSectionsFor("companies").map((s) => s.key)).toEqual(["companies"]);
    expect(JH_SECTIONS.length).toBe(10);
  });

  it("deep-links each section on its own page and parses ?section= per page", () => {
    expect(jhSectionHref("story")).toBe("/jobhacking/profile?section=story");
    expect(jhSectionHref("salary")).toBe("/jobhacking/true-north?section=salary");
    expect(parseJhSection("salary", jhSectionsFor("true-north"))).toBe("salary");
    expect(parseJhSection("salary", jhSectionsFor("profile"))).toBeNull();
    expect(parseJhSection("nope")).toBeNull();
    expect(parseJhSection(null)).toBeNull();
  });

  it("names a JobHacking section for every file section that has one, and none for the rest", () => {
    expect(Object.keys(JH_FILE_EDIT).sort()).toEqual(Object.keys(FILE_SECTIONS).sort());
    expect(JH_FILE_EDIT.northstar).toBe("roles");
    expect(JH_FILE_EDIT.watchlist).toBe("companies");
    expect(JH_FILE_EDIT.cv).toBeNull();
    expect(JH_FILE_EDIT.artefacts).toBeNull();
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
    expect(rows.industry).toMatchObject({ state: "done", summary: "HR tech SaaS · Scale-up" });
    expect(rows.location).toMatchObject({ state: "done", count: "3/3" });
    expect(rows.location.summary).toContain("Melbourne, Australia");
    expect(rows.location.summary).toContain("3 rules");
    expect(rows.companies).toMatchObject({ state: "done", count: "2" });
    expect(rows.companies.summary).toContain("1 company without a careers page");
  });

  it("is partial when only the supporting fields are set, and empty when nothing is", () => {
    const only = Object.fromEntries(jhSectionSummaries({ setup: { policy: { minimumSalary: "1" }, personalization: { targetRoles: [{ archetype: "x" }] } } as CareerOpsSetupV2, profile }).map((r) => [r.key, r]));
    expect(only.salary.state).toBe("partial");
    expect(only.roles.state).toBe("partial");
    expect(only.seniority).toMatchObject({ state: "empty", summary: "Not set" });
    expect(only.industry.state).toBe("empty");
    expect(only.companies.summary).toBe("Not set");
  });

  it("returns a page's rows in that page's order", () => {
    expect(jhRowsFor(jhSectionsFor("true-north"), jhSectionSummaries({ setup, profile })).map((r) => r.key)).toEqual(["roles", "seniority", "salary", "industry", "location"]);
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
