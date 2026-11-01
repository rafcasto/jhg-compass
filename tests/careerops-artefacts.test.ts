import { describe, it, expect } from "vitest";
import { JSON_SCHEMA, load } from "js-yaml";
import {
  ARTEFACT_CAPS, STORY_FIELDS, coerceProofPoints, coerceStories, proofPointsForCareerOps, proofPointsFromCareerOps, proofUsable, storyComplete,
} from "@/lib/careerops/artefacts";
import { buildProfileYaml } from "@/lib/careerops/profile-yaml";
import { buildSetupProfileYaml, preserveSetupFields, resolveSetupFields } from "@/lib/careerops/setup-yaml";
import { PROFILE_FILENAME, parseProfileFile, profileFromSetup, profileToSetupPatch, profileToYaml } from "@/lib/careerops/profile-file";
import { validateProfileFile } from "@/lib/careerops/profile-schema";
import { parseMaleta } from "@/lib/careerops/maleta";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// Artefacts — WHAT VALUE DO I CREATE: Stories L1/L2 (CCARR) and the proof bank,
// in the storage model, in profile.yml both ways, and in the career-ops yaml.

const story = { title: "Fortnightly releases", context: "40 engineers, monthly releases.", challenge: "Get to fortnightly.", activities: "Release train, dependency board.", result: "Fortnightly in two quarters; incidents halved.", relevance: "Delivery Lead at scale-ups." };
const proof = { name: "Release train", metric: "Monthly → fortnightly in two quarters", short: "Took a SaaS team from monthly to fortnightly releases.", long: "Releases were monthly…", url: "https://ana.nz/playbook" };

describe("artefacts — coercion never obeys, only extracts", () => {
  it("keeps only stories with a title, trims and caps every field", () => {
    const s = coerceStories([
      { title: "  Fortnightly releases  ", context: " 40 engineers ", result: "x".repeat(ARTEFACT_CAPS.storyField + 50) },
      { context: "no title" },
      "not a row",
      null,
      { title: "" },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].title).toBe("Fortnightly releases");
    expect(s[0].context).toBe("40 engineers");
    expect(s[0].result?.length).toBe(ARTEFACT_CAPS.storyField);
    expect(s[0]).not.toHaveProperty("challenge");
  });

  it("caps the number of stories and proof points", () => {
    expect(coerceStories(Array.from({ length: 30 }, (_, i) => ({ title: `s${i}` })))).toHaveLength(ARTEFACT_CAPS.stories);
    expect(coerceProofPoints(Array.from({ length: 30 }, (_, i) => ({ name: `p${i}` })))).toHaveLength(ARTEFACT_CAPS.proofPoints);
  });

  it("keeps a proof point whose link is not http(s) — without the link", () => {
    const p = coerceProofPoints([{ name: "Tool", metric: "2K stars", url: "github.com/jane/tool" }, { name: "Site", url: "https://jane.dev" }, { metric: "no name" }]);
    expect(p).toEqual([{ name: "Tool", metric: "2K stars" }, { name: "Site", url: "https://jane.dev" }]);
  });

  it("knows when a story is told in full and when a proof point is usable", () => {
    expect(storyComplete(story)).toBe(true);
    expect(storyComplete({ title: "t", result: "r" })).toBe(false);
    expect(STORY_FIELDS).toEqual(["context", "challenge", "activities", "result", "relevance"]);
    expect(proofUsable({ name: "x" })).toBe(false);
    expect(proofUsable({ name: "x", short: "one line" })).toBe(true);
  });
});

describe("artefacts — career-ops narrative.proof_points both ways", () => {
  it("writes name · url · hero_metric, and lets the CV line stand in for a missing metric", () => {
    expect(proofPointsForCareerOps([proof, { name: "Incidents", short: "Halved incidents." }, { name: "Bare" }])).toEqual([
      { name: "Release train", url: "https://ana.nz/playbook", hero_metric: "Monthly → fortnightly in two quarters" },
      { name: "Incidents", hero_metric: "Halved incidents." },
      { name: "Bare" },
    ]);
  });

  it("reads them back from a career-ops config/profile.yml", () => {
    const p = parseMaleta("candidate:\n  full_name: Jane\nnarrative:\n  proof_points:\n    - name: Project Alpha\n      url: https://janesmith.dev/alpha\n      hero_metric: Reduced latency 40%\n    - name: Tool\n      hero_metric: 2K+ stars\n", "profile.yml");
    expect(p.ok).toBe(true);
    expect(p.maleta.proofPoints).toEqual([{ name: "Project Alpha", metric: "Reduced latency 40%", url: "https://janesmith.dev/alpha" }, { name: "Tool", metric: "2K+ stars" }]);
    expect(p.found).toContain("proof bank (2)");
    expect(proofPointsFromCareerOps("nope")).toEqual([]);
  });

  it("puts the proof bank under narrative and the stories in their own block of the career-ops yaml", () => {
    const y = buildProfileYaml({ profile: { email: "a@b.c" }, goal: { role: "PO" }, stories: [story], proofPoints: [proof, { name: "Bare" }] });
    const doc = load(y, { schema: JSON_SCHEMA }) as Record<string, Record<string, unknown>>;
    expect(doc.narrative.proof_points).toEqual([
      { name: "Release train", url: "https://ana.nz/playbook", hero_metric: "Monthly → fortnightly in two quarters" },
      { name: "Bare" },
    ]);
    expect(doc.stories).toEqual([story]);
    // Key order: narrative before stories before compensation, so the file still reads top-down.
    expect(y.indexOf("narrative:")).toBeLessThan(y.indexOf("stories:"));
    expect(y.indexOf("stories:")).toBeLessThan(y.indexOf("compensation:"));
  });

  it("writes neither block when there is nothing to say", () => {
    const y = buildProfileYaml({ profile: null, goal: null, stories: [], proofPoints: [] });
    expect(y).not.toContain("proof_points");
    expect(y).not.toContain("stories:");
  });
});

describe("artefacts — the setup document and profile.yml", () => {
  const setup = {
    cvMarkdown: "# CV", profileYaml: "", updatedAt: 1, notes: "",
    stories: [story], proofPoints: [proof],
  } as CareerOpsSetupV2;

  it("resolves and preserves them like every other setup field", () => {
    expect(resolveSetupFields({ setup }).stories).toEqual([story]);
    expect(resolveSetupFields({ setup, overrides: { proofPoints: [] } }).proofPoints).toEqual([]);
    expect(preserveSetupFields(setup)).toMatchObject({ stories: [story], proofPoints: [proof] });
    expect(preserveSetupFields({ ...setup, stories: [], proofPoints: undefined })).not.toHaveProperty("stories");
    expect(buildSetupProfileYaml({ profile: null, setup })).toContain("hero_metric:");
  });

  it("exports them, validates them and brings them back unchanged", () => {
    const file = profileFromSetup({ profile: null, setup });
    expect(file.stories).toEqual([story]);
    expect(file.proofPoints).toEqual([proof]);
    const yaml = profileToYaml(file);
    // Key order: personalization → stories → proofPoints → watchlist.
    expect(yaml.indexOf("stories:")).toBeLessThan(yaml.indexOf("proofPoints:"));
    const back = parseProfileFile(yaml, PROFILE_FILENAME);
    expect(back.ok).toBe(true);
    expect(back.errors).toEqual([]);
    expect(back.profile.stories).toEqual([story]);
    expect(back.profile.proofPoints).toEqual([proof]);
    expect(back.found).toEqual(expect.arrayContaining(["1 story", "proof bank (1)"]));
    const patch = profileToSetupPatch(back.profile);
    expect(patch.setup.stories).toEqual([story]);
    expect(patch.setup.proofPoints).toEqual([proof]);
  });

  it("schema: a story needs a title and a proof point a name; a bad link is a warning", () => {
    const r = validateProfileFile({ version: 1, stories: [{ context: "no title" }, { title: "ok", outcome: "x" }], proofPoints: [{ metric: "no name" }, { name: "Tool", url: "github.com/x" }] });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => `${e.path}: ${e.message}`)).toEqual([
      "stories[0]: missing title",
      "stories[1].outcome: unknown key",
      "proofPoints[0]: missing name",
    ]);
    expect(r.warnings).toEqual(["proofPoints[1].url is not an absolute http(s) link — the link is left out, the proof point kept"]);
  });

  it("schema: contact.location is a known key", () => {
    expect(validateProfileFile({ version: 1, contact: { location: "Wellington, New Zealand" } }).ok).toBe(true);
  });

  it("a file without them leaves the stored ones alone", () => {
    const back = parseProfileFile("version: 1\nnotes: hi\n", PROFILE_FILENAME);
    expect(profileToSetupPatch(back.profile).setup).not.toHaveProperty("stories");
    expect(profileToSetupPatch(back.profile).setup).not.toHaveProperty("proofPoints");
  });
});
