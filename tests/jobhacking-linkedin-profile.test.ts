import { describe, it, expect } from "vitest";
import { LINKEDIN_LIMITS, LINKEDIN_SECTIONS, dateRange, linkedinCount, linkedinPresent, linkedinSummary, measure, monthYear, roleLine, roleMeta, skillsText } from "@/lib/jobhacking/linkedin-profile";
import type { LinkedinProfile } from "@/lib/careerops/types";

// JobHacking → Artefacts → LinkedIn profile — docs/UX_JOBHACKING.md §3d. One block
// per LinkedIn section, in LinkedIn's order, measured against LinkedIn's limits.

const li: LinkedinProfile = {
  headline: "Delivery Lead for SaaS teams",
  about: "Six years in B2B SaaS.",
  experience: [{ title: "Delivery Lead", company: "FreightDesk", location: "Wellington", start: "2022-03", end: "", description: "Led delivery.", skills: ["Release management"] }],
  skills: ["Release management", "Incident management", "Programme delivery", "Agile"],
  education: [{ school: "VUW", degree: "BSc", start: "2012", end: "2015" }],
};

describe("linkedin profile", () => {
  it("lists LinkedIn's seven sections in LinkedIn's order, and only the ones the file fills", () => {
    expect(LINKEDIN_SECTIONS.map((s) => s.key)).toEqual(["headline", "about", "experience", "featured", "skills", "education", "certifications"]);
    expect(linkedinPresent(li).map((s) => s.key)).toEqual(["headline", "about", "experience", "skills", "education"]);
    expect(linkedinPresent({ headline: "  ", featured: [] })).toEqual([]);
    expect(linkedinPresent(null)).toEqual([]);
  });

  it("summarises what the file carries, and counts the sections filled of seven", () => {
    expect(linkedinSummary(li)).toBe("Headline · About · 1 role · 4 skills · 1 school");
    expect(linkedinCount(li)).toBe("5/7");
    expect(linkedinSummary({ certifications: [{ name: "PSM I" }], featured: [{ title: "Playbook" }, { title: "Post" }] })).toBe("2 featured items · 1 certification");
    expect(linkedinSummary(undefined)).toBe("");
  });

  it("measures a block against LinkedIn's limit and says when it is over", () => {
    expect(LINKEDIN_LIMITS).toEqual({ headline: 220, about: 2600, description: 2000, skills: 50, roleSkills: 5 });
    expect(measure("abc", 220)).toEqual({ length: 3, limit: 220, over: false });
    expect(measure("x".repeat(221), 220)).toMatchObject({ length: 221, over: true });
    expect(measure(undefined, 220)).toEqual({ length: 0, limit: 220, over: false });
  });

  it("reads YYYY-MM as month and year, an open role as Present, a school's open end as nothing", () => {
    expect(monthYear("2022-03")).toBe("Mar 2022");
    expect(monthYear("2015")).toBe("2015");
    expect(monthYear("2022-13")).toBe("2022-13");
    expect(monthYear(undefined)).toBe("");
    expect(dateRange("2022-03", "")).toBe("Mar 2022 – Present");
    expect(dateRange("2019-01", "2022-02")).toBe("Jan 2019 – Feb 2022");
    expect(dateRange("2012", "", { presentWhenOpen: false })).toBe("2012");
    expect(dateRange(undefined, "2015")).toBe("2015");
    expect(dateRange(undefined, undefined)).toBe("");
  });

  it("writes a role's lines as LinkedIn shows them, and the skills one per line for the Skills form", () => {
    expect(roleLine(li.experience![0])).toBe("Delivery Lead · FreightDesk");
    expect(roleMeta(li.experience![0])).toBe("Mar 2022 – Present · Wellington");
    expect(roleMeta({ title: "X", company: "Y" })).toBe("");
    expect(skillsText(["A", " B ", "", "C"])).toBe("A\nB\nC");
    expect(skillsText(undefined)).toBe("");
  });
});
