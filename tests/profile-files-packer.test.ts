import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mergeProfile, parseProfileFile, profileFromSetup, profileToSetupPatch, profileToYaml } from "@/lib/careerops/profile-file";
import { detectJhFile, jhFileName, jhFilePreview, jhFileProfile, shapeJhFile } from "@/lib/jobhacking/profile-files";
import { validateProfileFile } from "@/lib/careerops/profile-schema";
import { JSON_SCHEMA, load } from "js-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// tests/fixtures/packer/*.yml are a second set of real Packer files (Laurent,
// 2026-11-07; the three artefact files from the v7 Packer, 2026-11-09) — the
// ones that showed the samples were not the whole shape (extraSubSectors,
// linkedinPublicUrl, contact.github). Every attribute they carry must be
// accepted with no error and no warning, and each must land on its page.

const read = (name: string) => readFileSync(path.resolve(__dirname, `fixtures/packer/${name}.yml`), "utf8");
const FILES = [["narrative", "narrative"], ["true-north", "trueNorth"], ["target-companies", "targetCompanies"], ["story-bank", "storyBank"], ["master-cv", "masterCv"], ["linkedin", "linkedin"]] as const;

describe("a second Packer's six files", () => {
  for (const [name, key] of FILES) {
    it(`${name}.yml — no errors, no unknown-key warnings, detected as ${key}`, () => {
      const r = parseProfileFile(read(name), `${name}.yml`);
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
      expect(r.warnings.filter((w) => w.includes("new to Compass"))).toEqual([]);
      expect(detectJhFile(r.profile, `${name}.yml`)).toBe(key);
    });
  }

  it("narrative.yml fills every Contact details field it carries — phone, LinkedIn, GitHub, location — plus Headline and Core competencies", () => {
    const shaped = shapeJhFile("narrative", parseProfileFile(read("narrative"), "narrative.yml").profile, { version: 1 });
    const after = profileToSetupPatch(mergeProfile({ version: 1 }, shaped)).setup;
    expect(after.contact).toEqual({
      phone: "+33 6 55 01 23 45", linkedin: "https://www.linkedin.com/in/example-laurent-simon", github: "https://github.com/example-laurent-simon",
      title: "I help B2B SaaS scale-ups protect and grow recurring revenue through CRM architecture, renewal forecasting and sales-to-success handover design", location: "Lyon, France",
    });
    expect(after.personalization?.crossCuttingAdvantage).toBe("CRM architecture; Renewal forecasting; Sales-to-success handover; Customer health scoring");
    const rows = jhFilePreview("narrative", shaped, {}, after, null);
    expect(rows.map((r) => `${r.label}: ${r.headline}`)).toEqual(["Contact details: adds", "Headline: adds", "Bridge story: adds", "Core competencies: adds"]);
    // The name is the account's (users/{uid}), written from jhg.identity.fullName — so the row reads with it.
    expect(jhFileName("narrative", shaped)).toEqual({ firstName: "Laurent", lastName: "Simon" });
    expect(jhFileProfile("narrative", shaped, { email: "laurent@mail.example" })).toEqual({ email: "laurent@mail.example", firstName: "Laurent", lastName: "Simon" });
    expect(rows[0].detail).toBe("Laurent Simon · +33 6 55 01 23 45 · Lyon, France · LinkedIn");
  });

  it("the name is only the Narrative file's, and a stored name the file does not change is not rewritten", () => {
    const tn = parseProfileFile(read("true-north"), "true-north.yml").profile;
    expect(jhFileName("trueNorth", tn)).toBeNull();
    expect(jhFileName("narrative", { jhg: { identity: { fullName: "Cher" } } })).toEqual({ firstName: "Cher", lastName: "" });
    expect(jhFileName("narrative", { jhg: { identity: { email: "x@y.z" } } })).toBeNull();
  });

  it("target-companies.yml keeps the extra sub-sectors and an unclassified group; master-cv.yml keeps the public LinkedIn URL", () => {
    const tc = parseProfileFile(read("target-companies"), "target-companies.yml").profile;
    expect(tc.jhg?.targetCompanies?.extraSubSectors?.[0]).toMatchObject({ name: "Hotel booking software", industry: "Travel technology", outlook: "sunrise" });
    expect(tc.companyLists?.all?.unclassified?.length).toBeGreaterThan(0);
    const cv = parseProfileFile(read("master-cv"), "master-cv.yml").profile;
    expect(cv.jhg?.artefacts?.linkedinPublicUrl).toMatch(/^https?:/);
  });

  it("the three artefact files each review as their one page section, and together keep every artefacts fact", () => {
    let setup: Partial<CareerOpsSetupV2> = {};
    const rows: string[] = [];
    for (const [name, key] of [["story-bank", "storyBank"], ["master-cv", "masterCv"], ["linkedin", "linkedin"]] as const) {
      const current = profileFromSetup({ profile: null, setup: setup as CareerOpsSetupV2 });
      const shaped = shapeJhFile(key, parseProfileFile(read(name), `${name}.yml`).profile, current);
      const after = { ...setup, ...profileToSetupPatch(mergeProfile(current, shaped)).setup };
      rows.push(...jhFilePreview(key, shaped, setup, after, null).map((r) => `${r.label}: ${r.headline}`));
      setup = after;
    }
    expect(rows).toEqual(["Story Bank: adds", "Master CV: adds", "LinkedIn profile: adds"]);
    expect(setup.jhg?.artefacts?.storyFacts).toHaveLength(9);
    expect(setup.jhg?.artefacts?.cvHouseRules).toHaveLength(2);
    expect(setup.jhg?.artefacts?.languageLearning?.[0].language).toBe("German");
    expect(Object.keys(setup.jhg?.progress ?? {}).sort()).toEqual(["linkedin", "masterCv", "storyBank"]);
    expect(setup.linkedin?.experience).toHaveLength(2);
    expect(setup.cvMarkdown).toMatch(/^# CV -- Laurent Simon/);
    expect(setup.narrative?.proofPoints).toHaveLength(8);
  });

  it("a key the Packer adds tomorrow is kept with a warning, never a refusal", () => {
    const doc = load(`version: 1\njhg:\n  artefacts:\n    somethingNew: "x"\n    deeper: { a: 1, b: [1, 2] }\n`, { schema: JSON_SCHEMA });
    const v = validateProfileFile(doc);
    expect(v.ok).toBe(true);
    expect(v.warnings).toEqual(["jhg.artefacts.somethingNew is new to Compass — kept as it is, not shown yet", "jhg.artefacts.deeper is new to Compass — kept as it is, not shown yet"]);
    const p = parseProfileFile(`version: 1\njhg:\n  artefacts:\n    somethingNew: "x"\n    deeper: { a: 1, b: [1, 2] }\n`, "artefacts.yml").profile;
    expect(p.jhg?.artefacts).toEqual({ somethingNew: "x", deeper: { a: 1, b: [1, 2] } });
    // …and it survives the round trip.
    const again = parseProfileFile(profileToYaml(profileFromSetup({ profile: null, setup: profileToSetupPatch(p).setup as CareerOpsSetupV2 })), "profile.yml");
    expect(again.profile.jhg?.artefacts).toEqual({ somethingNew: "x", deeper: { a: 1, b: [1, 2] } });
  });
});
