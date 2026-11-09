import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mergeProfile, parseProfileFile, profileFromSetup, profileToSetupPatch, profileToYaml, type ProfileFile } from "@/lib/careerops/profile-file";
import { profileDiff } from "@/lib/careerops/profile-diff";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// The Packer writes the profile as six files (decision 2026-11-07; six since
// 2026-11-09): narrative · true-north · target-companies · story-bank ·
// master-cv · linkedin. public/*.example.yml
// are the Packer's own samples, and this is the contract: every key they carry
// is accepted, read, stored, shown and exported again. Change the schema
// without updating the samples and this fails.

const read = (name: string) => readFileSync(path.resolve(__dirname, `../public/${name}.example.yml`), "utf8");
const FILES = ["narrative", "true-north", "target-companies", "story-bank", "master-cv", "linkedin"] as const;

describe("the six Packer files", () => {
  for (const name of FILES) {
    it(`${name}.example.yml matches the schema with no errors`, () => {
      const r = parseProfileFile(read(name), `${name}.example.yml`);
      expect(r.errors).toEqual([]);
      expect(r.error).toBeUndefined();
      expect(r.ok).toBe(true);
    });
  }

  it("narrative — reads the headline, superpowers, identity and lead skills", () => {
    const p = parseProfileFile(read("narrative"), "narrative.yml").profile;
    expect(p.contact).toEqual({ phone: "+64 21 555 0199", linkedin: "https://www.linkedin.com/in/example-ana-ferreira", portfolio: "https://ana-ferreira.example/release-cadence-playbook" });
    expect(p.personalization?.exitNarrative).toMatch(/^I was the operations analyst/);
    expect(p.narrative?.headline).toMatch(/^I help SaaS scale-ups/);
    expect(p.narrative?.superpowers).toEqual(["Release management", "Incident management", "Programme delivery"]);
    expect(p.jhg?.progress?.narrative).toEqual({ status: "complete", updated: "2026-11-06" });
    expect(p.jhg?.identity?.timezone).toBe("Pacific/Auckland");
    expect(p.jhg?.identity?.alternateEmails).toEqual(["ana@freightdesk.example"]);
    expect(p.jhg?.narrative?.leadSkills).toEqual(["Release planning", "Incident follow-through", "Cross-team coordination"]);
    expect(p.jhg?.narrative?.bridgeStoryOneLine).toMatch(/^I was an operations analyst/);
  });

  it("true-north — reads the goal, policy, targeting, keywords and the workbook behind them", () => {
    const p = parseProfileFile(read("true-north"), "true-north.yml").profile;
    expect(p.goal).toEqual({ role: "Senior Delivery Lead", seniority: "Senior", subsector: "Freight dispatch software", companyType: "Scale-up", city: "Wellington, New Zealand", salary: "NZD 150,000–175,000" });
    expect(p.policy?.authorizedIn).toEqual(["New Zealand", "Australia"]);
    expect(p.personalization?.targetRoles).toHaveLength(3);
    expect(p.personalization?.negotiationScripts).toHaveLength(3);
    expect(p.watchlist).toEqual({ companies: [], positive: ["Delivery Lead", "Delivery Manager", "Head of Delivery", "Engineering Operations Manager", "Technical Program Manager"], negative: ["Scrum Master", "Project Coordinator", "PMO Analyst", "Agile Coach", "intern", "graduate", "VP"] });
    const tn = p.jhg?.trueNorth!;
    expect(tn.boundaries?.noticePeriodDays).toBe(28);
    expect(tn.boundaries?.hardNos).toEqual(["on-site 5 days", "hands-on coding roles", "defence or gambling sectors"]);
    expect(tn.postings).toHaveLength(15);
    expect(tn.titles?.analog).toEqual(["Release Manager", "Engineering Program Manager", "Platform Operations Lead"]);
    expect(tn.clusters?.map((c) => c.fit)).toEqual(["primary", "secondary", "adjacent"]);
    expect(tn.industries?.[0].subSectors?.[1].outlook).toBe("sunset");
  });

  it("target-companies — reads the watchlist, the ranked lists with scores, and the worked Top 10 / Top 3", () => {
    const r = parseProfileFile(read("target-companies"), "target-companies.yml");
    const p = r.profile;
    expect(p.watchlist?.companies).toHaveLength(10);
    expect(p.companyLists?.top3?.sunrise?.[0]).toMatchObject({ rank: 1, name: "Kauri Logistics Cloud", scores: { growth: 5, interest: 5, access: 4, proof: 5, total: 19 } });
    expect(p.companyLists?.top10?.sunrise?.[5].careersUrlStatus).toBe("corrected");
    expect(r.warnings.filter((w) => w.includes("careersUrlStatus"))).toEqual([]);
    const tc = p.jhg?.targetCompanies!;
    expect(tc.companies).toHaveLength(40);
    expect(tc.companies?.[3].knownContact).toBe("Hemi Walker (former Ledgerline colleague)");
    expect(tc.challenges).toHaveLength(2);
    expect(tc.top10?.[0].thesis).toMatch(/^You are hiring for release cadence/);
    expect(tc.top3?.map((c) => c.byDate)).toEqual(["2026-11-04", "2026-11-05", "2026-11-06"]);
  });

  it("story-bank — reads STAR-R stories, snapshot context, proof-point URLs, the framing and the story facts", () => {
    const p = parseProfileFile(read("story-bank"), "story-bank.yml").profile;
    expect(p.contact).toEqual({ portfolio: "https://ana-ferreira.example/release-cadence-playbook" });
    expect(p.personalization?.adaptiveFraming).toHaveLength(3);
    expect(p.personalization?.portfolio?.url).toBe("https://ana-ferreira.example/release-cadence-playbook");
    expect(p.narrative?.proofPoints?.[0]).toEqual({ name: "Fortnightly release train", url: "https://ana-ferreira.example/release-cadence-playbook", heroMetric: "Monthly to fortnightly releases, 9 teams" });
    expect(p.stories?.[0]).toMatchObject({ id: "S1", situation: "a 110-engineer logistics SaaS doubling in size", task: "Own fortnightly release train", reflection: "Measure the outcome the business already watches before changing anything.", provenance: "verified" });
    expect(p.snapshots?.[0]).toMatchObject({ company: "Kauri Logistics Cloud", storyId: "S1", role: "Delivery Lead", activities: ["Mapped every team's release steps", "Introduced one release train with readiness checks", "Published the cadence and the numbers weekly"], results: ["9 teams", "2 quarters"], keyDecisions: ["Kept team-owned readiness checks instead of a central release team"] });
    expect(p.jhg?.progress?.storyBank).toEqual({ status: "complete", updated: "2026-11-06" });
    expect(p.jhg?.artefacts?.storyFacts).toHaveLength(10);
    expect(p.jhg?.artefacts?.storyFacts?.[9].sourceStatus).toBe("user_cannot_confirm");
    expect(p.linkedin).toBeUndefined();
    expect(p.cv).toBeUndefined();
  });

  it("master-cv — reads the CV, its headline and LinkedIn URL, the notes and the CV rules", () => {
    const p = parseProfileFile(read("master-cv"), "master-cv.yml").profile;
    expect(p.contact).toEqual({ title: "Delivery Lead for SaaS teams scaling past product–market fit", linkedin: "https://www.linkedin.com/in/example-ana-ferreira" });
    expect(p.cv).toMatch(/^# CV -- Ana Ferreira/);
    expect(p.notes).toMatch(/^Hard no's/);
    expect(p.jhg?.progress?.masterCv).toEqual({ status: "complete", updated: "2026-11-06" });
    const a = p.jhg?.artefacts!;
    expect(a.storyFacts).toBeUndefined();
    expect(a.currentDomain).toBe("logistics and accounting SaaS");
    expect(a.cvHouseRules).toHaveLength(2);
    expect(a.lockedSections).toEqual(["Projects"]);
    expect(a.languageLearning?.[0]).toMatchObject({ language: "te reo Māori", countries: ["New Zealand"] });
    expect(a.linkedinPublicUrl).toBe("https://www.linkedin.com/in/example-ana-ferreira");
    expect(p.stories).toBeUndefined();
  });

  it("linkedin — reads the LinkedIn profile and nothing else", () => {
    const p = parseProfileFile(read("linkedin"), "linkedin.yml").profile;
    expect(p.linkedin?.experience).toHaveLength(2);
    expect(p.linkedin?.skills).toHaveLength(5);
    expect(p.jhg?.progress?.linkedin).toEqual({ status: "complete", updated: "2026-11-06" });
    expect(Object.keys(p).filter((k) => p[k as keyof typeof p] !== undefined).sort()).toEqual(["jhg", "linkedin", "version"]);
  });
});

describe("merging the six files, in any order, into one profile", () => {
  const parsed = Object.fromEntries(FILES.map((n) => [n, parseProfileFile(read(n), `${n}.yml`).profile])) as Record<(typeof FILES)[number], ProfileFile>;

  const unpackAll = (order: readonly (typeof FILES)[number][]): CareerOpsSetupV2 => {
    let setup: Partial<CareerOpsSetupV2> = {};
    for (const n of order) {
      const current = profileFromSetup({ profile: null, setup: setup as CareerOpsSetupV2 });
      setup = { ...setup, ...profileToSetupPatch(mergeProfile(current, parsed[n])).setup };
    }
    return setup as CareerOpsSetupV2;
  };

  it("keeps the Narrative file's phone when the Master CV file brings only the title and LinkedIn URL", () => {
    const setup = unpackAll(["narrative", "master-cv"]);
    expect(setup.contact).toEqual({ phone: "+64 21 555 0199", linkedin: "https://www.linkedin.com/in/example-ana-ferreira", portfolio: "https://ana-ferreira.example/release-cadence-playbook", title: "Delivery Lead for SaaS teams scaling past product–market fit" });
  });

  it("builds the whole personalization from three files and the whole watchlist from two", () => {
    const setup = unpackAll(FILES);
    expect(Object.keys(setup.personalization ?? {}).sort()).toEqual(["adaptiveFraming", "compTargets", "crossCuttingAdvantage", "exitNarrative", "locationPolicy", "negotiationScripts", "portfolio", "targetRoles"]);
    expect(setup.portals?.companies).toHaveLength(10);
    expect(setup.portals?.positive).toHaveLength(5);
    expect(setup.portals?.negative).toHaveLength(7);
    expect(setup.narrative?.headline).toMatch(/^I help/);
    expect(setup.narrative?.proofPoints).toHaveLength(9);
  });

  it("accumulates progress and identity across the files and keeps each working block", () => {
    const a = unpackAll(FILES), b = unpackAll([...FILES].reverse());
    for (const setup of [a, b]) {
      expect(Object.keys(setup.jhg?.progress ?? {}).sort()).toEqual(["linkedin", "masterCv", "narrative", "storyBank", "targetCompanies", "trueNorth"]);
      expect(setup.jhg?.identity?.timezone).toBe("Pacific/Auckland");
      expect(setup.jhg?.trueNorth?.postings).toHaveLength(15);
      expect(setup.jhg?.targetCompanies?.top3).toHaveLength(3);
      expect(setup.jhg?.artefacts?.storyFacts).toHaveLength(10);
      expect(setup.jhg?.narrative?.leadSkills).toHaveLength(3);
    }
    expect(a.jhg).toEqual(b.jhg);
  });

  it("the artefacts working block is shared — story-bank.yml's facts and master-cv.yml's rules sit together, in either order", () => {
    for (const order of [["story-bank", "master-cv"], ["master-cv", "story-bank"]] as const) {
      const a = unpackAll(order).jhg?.artefacts!;
      expect(a.storyFacts).toHaveLength(10);
      expect(a.cvHouseRules).toHaveLength(2);
      expect(a.lockedSections).toEqual(["Projects"]);
      expect(a.linkedinPublicUrl).toMatch(/^https:/);
    }
  });

  it("round-trips the merged profile through export without loss", () => {
    const setup = unpackAll(FILES);
    const whole = profileFromSetup({ profile: null, setup });
    const again = parseProfileFile(profileToYaml(whole), "profile.yml");
    expect(again.errors).toEqual([]);
    expect(again.profile.jhg).toEqual(whole.jhg);
    expect(again.profile.stories).toEqual(whole.stories);
    expect(again.profile.snapshots).toEqual(whole.snapshots);
    expect(again.profile.companyLists).toEqual(whole.companyLists);
    expect(again.profile.narrative).toEqual(whole.narrative);
  });

  it("the review diffs the merged result — a second file adds, never drops", () => {
    const current = profileFromSetup({ profile: null, setup: unpackAll(["narrative"]) });
    const d = profileDiff(current, mergeProfile(current, parsed["master-cv"])).find((x) => x.key === "contact")!;
    expect(d.kind).toBe("add");
    expect(d.headline).toBe("adds 1, keeps 3");
  });
});
