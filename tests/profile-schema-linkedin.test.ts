import { describe, it, expect } from "vitest";
import { JSON_SCHEMA, load } from "js-yaml";
import { validateProfileFile } from "@/lib/careerops/profile-schema";
import { parseProfileFile, profileFromSetup, profileToSetupPatch, profileToYaml } from "@/lib/careerops/profile-file";
import { profileDiff } from "@/lib/careerops/profile-diff";
import { preserveSetupFields } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// The `linkedin` section (decision 2026-11-05, docs/UX_JOBHACKING.md §5): LinkedIn's
// own sections, one block each, measured against LinkedIn's limits and never cut.

const FILE = `version: 1
goal:
  role: "Delivery Lead"
linkedin:
  headline: "Delivery Lead for SaaS teams scaling past product–market fit"
  about: |
    Six years in B2B SaaS.
  experience:
    - title: "Delivery Lead"
      company: "FreightDesk Software"
      location: "Wellington, New Zealand"
      start: "2022-03"
      end: ""
      description: "Led delivery for nine teams."
      skills: ["Release management", "Incident management"]
    - title: "Delivery Manager"
      company: "Harbourline Analytics"
      start: "2019-01"
      end: "2022-02"
  featured:
    - kind: "link"
      title: "The release cadence playbook"
      url: "https://anaferreira.nz/release-cadence-playbook"
  skills: ["Release management", "Incident management", "Programme delivery"]
  education:
    - school: "Victoria University of Wellington"
      degree: "BSc"
      field: "Computer Science"
      start: "2012"
      end: "2015"
  certifications:
    - name: "Professional Scrum Master I"
      issuer: "Scrum.org"
      issued: "2019-06"
`;

describe("profile schema — linkedin", () => {
  it("accepts the section with no errors", () => {
    const r = validateProfileFile(load(FILE, { schema: JSON_SCHEMA }));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("reads every LinkedIn section as written, drops an empty end, and names it in what the file contains", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    expect(r.ok).toBe(true);
    const li = r.profile.linkedin!;
    expect(li.headline).toBe("Delivery Lead for SaaS teams scaling past product–market fit");
    expect(li.about).toBe("Six years in B2B SaaS."); // trimmed, like every other text field
    expect(li.experience).toEqual([
      { title: "Delivery Lead", company: "FreightDesk Software", location: "Wellington, New Zealand", start: "2022-03", description: "Led delivery for nine teams.", skills: ["Release management", "Incident management"] },
      { title: "Delivery Manager", company: "Harbourline Analytics", start: "2019-01", end: "2022-02" },
    ]);
    expect(li.featured).toEqual([{ kind: "link", title: "The release cadence playbook", url: "https://anaferreira.nz/release-cadence-playbook" }]);
    expect(li.skills).toEqual(["Release management", "Incident management", "Programme delivery"]);
    expect(li.education).toEqual([{ school: "Victoria University of Wellington", degree: "BSc", field: "Computer Science", start: "2012", end: "2015" }]);
    expect(li.certifications).toEqual([{ name: "Professional Scrum Master I", issuer: "Scrum.org", issued: "2019-06" }]);
    expect(r.found).toContain("LinkedIn profile (7 sections)");
  });

  it("stores it on the setup document, preserves it through whole-document saves, and exports it again — lossless", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    const { setup } = profileToSetupPatch(r.profile);
    expect(setup.linkedin).toEqual(r.profile.linkedin);
    expect(preserveSetupFields(setup as CareerOpsSetupV2).linkedin).toEqual(r.profile.linkedin);
    const yaml = profileToYaml(profileFromSetup({ profile: null, setup: setup as CareerOpsSetupV2 }));
    expect(yaml.indexOf("linkedin:")).toBeLessThan(yaml.indexOf("\ncv:") === -1 ? Infinity : yaml.indexOf("\ncv:"));
    const again = parseProfileFile(yaml, "profile.yml");
    expect(again.ok).toBe(true);
    expect(again.profile.linkedin).toEqual(r.profile.linkedin);
  });

  it("warns on a block over LinkedIn's limit and keeps the text whole", () => {
    const long = "x".repeat(230);
    const doc = { version: 1, linkedin: { headline: long, experience: [{ title: "A", company: "B", description: "y".repeat(2001), skills: ["1", "2", "3", "4", "5", "6"] }] } };
    const r = validateProfileFile(doc);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([
      "linkedin.headline is 230 characters — LinkedIn allows 220; kept whole and shown as over the limit",
      "linkedin.experience[0].skills has 6 entries — only the first 5 are kept",
      "linkedin.experience[0].description is 2001 characters — LinkedIn allows 2000; kept whole and shown as over the limit",
    ]);
    const parsed = parseProfileFile(`version: 1\nlinkedin:\n  headline: "${long}"\n  experience:\n    - title: A\n      company: B\n      skills: ["1","2","3","4","5","6"]\n`, "profile.yml");
    expect(parsed.profile.linkedin?.headline).toHaveLength(230);
    expect(parsed.profile.linkedin?.experience?.[0].skills).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("refuses the shape being wrong, with a path; an unknown featured kind is a warning read as unset", () => {
    const paths = (doc: unknown) => validateProfileFile(doc).errors.map((e) => e.path);
    expect(paths({ version: 1, linkedin: { headlines: "x" } })).toEqual(["linkedin.headlines"]);
    expect(paths({ version: 1, linkedin: { experience: [{ title: "A" }] } })).toEqual(["linkedin.experience[0]"]);
    expect(paths({ version: 1, linkedin: { experience: [{ title: "A", company: "B", skills: "one" }] } })).toEqual(["linkedin.experience[0].skills"]);
    expect(paths({ version: 1, linkedin: { education: [{ degree: "BSc" }] } })).toEqual(["linkedin.education[0]"]);
    expect(paths({ version: 1, linkedin: { skills: "Release management" } })).toEqual(["linkedin.skills"]);
    expect(paths({ version: 1, linkedin: { url: "https://linkedin.com/in/x" } })).toEqual(["linkedin.url"]);
    expect(paths({ version: 1, linkedin: [] })).toEqual(["linkedin"]);
    const r = validateProfileFile({ version: 1, linkedin: { featured: [{ kind: "video", title: "T" }] } });
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual(['linkedin.featured[0].kind is "video" — expected link, post, article or document; ignored']);
    expect(parseProfileFile('version: 1\nlinkedin:\n  featured:\n    - kind: video\n      title: T\n', "profile.yml").profile.linkedin?.featured).toEqual([{ title: "T" }]);
  });

  it("shows the LinkedIn profile as one row of the upload review", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    const d = profileDiff({ version: 1 }, r.profile).find((x) => x.key === "linkedin")!;
    expect(d).toMatchObject({ inFile: true, kind: "add", headline: "Headline · About · 2 roles · 1 featured item · 3 skills · 1 school · 1 certification" });
    expect(profileDiff(r.profile, r.profile).find((x) => x.key === "linkedin")!.kind).toBe("keep");
    expect(profileDiff({ version: 1 }, { version: 1 }).find((x) => x.key === "linkedin")!.inFile).toBe(false);
  });
});
