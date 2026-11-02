import { describe, it, expect } from "vitest";
import { JSON_SCHEMA, load } from "js-yaml";
import { validateProfileFile } from "@/lib/careerops/profile-schema";
import { parseProfileFile, profileFromSetup, profileToSetupPatch, profileToYaml } from "@/lib/careerops/profile-file";
import { profileDiff } from "@/lib/careerops/profile-diff";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// The Packer's 2026-11 shape (decision A, 2026-11-03): goal.seniority, and the
// artefacts — narrative.proofPoints · stories · snapshots — on top of the
// version-1 sections. Shaped like the Priya sample the decision was taken on.

const FILE = `version: 1
goal:
  role: "Customer Success Manager"
  seniority: "Senior"
  subsector: "HR tech SaaS"
  companyType: "Scale-up"
  city: "Melbourne, Australia"
  salary: "AUD 140,000–165,000"
contact:
  title: "Senior Customer Success Manager for enterprise SaaS"
  phone: "+61 400 555 018"
  location: "Melbourne, Australia"
watchlist:
  companies:
    - name: "Wattle HR Cloud"
      careersUrl: "https://boards.example/wattle-hr-cloud"
    - name: "Grevillea Clinic Systems"
  positive: ["Customer Success Manager"]
  negative: ["intern"]
narrative:
  proofPoints:
    - name: "Retention lift"
      heroMetric: "GRR from 88% to 96% in 12 months"
    - name: "Health score"
      heroMetric: "Flagged about 70% of churn 60 days early"
stories:
  - id: "S1"
    title: "Retention lift"
    result: "Increased gross revenue retention from 88% to 96% in 12 months."
    provenance: "verified"
  - id: "S7"
    title: "Health score"
    result: "Created a customer health score."
    provenance: "estimate"
snapshots:
  - company: "Wattle HR Cloud"
    storyId: "S1"
    title: "Retention lift"
    results: ["88%", "96%"]
`;

describe("profile schema — seniority and artefacts", () => {
  it("accepts the new keys with no errors", () => {
    const r = validateProfileFile(load(FILE, { schema: JSON_SCHEMA }));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("keeps a company with no careers URL, with a warning", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    expect(r.ok).toBe(true);
    expect(r.profile.watchlist?.companies.map((c) => c.name)).toEqual(["Wattle HR Cloud", "Grevillea Clinic Systems"]);
    expect(r.warnings.some((w) => w.startsWith("Grevillea Clinic Systems has no careers URL"))).toBe(true);
  });

  it("reads seniority, contact.location and the artefacts", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    expect(r.profile.goal?.seniority).toBe("Senior");
    expect(r.profile.contact?.location).toBe("Melbourne, Australia");
    expect(r.profile.narrative?.proofPoints).toHaveLength(2);
    expect(r.profile.stories?.map((s) => s.id)).toEqual(["S1", "S7"]);
    expect(r.profile.snapshots?.[0]).toEqual({ company: "Wattle HR Cloud", storyId: "S1", title: "Retention lift", results: ["88%", "96%"] });
    expect(r.found).toEqual(expect.arrayContaining(["proof points (2)", "stories (2)", "snapshots (1)"]));
  });

  it("stores the artefacts on the setup document and exports them again — a lossless round trip", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    const { setup } = profileToSetupPatch(r.profile);
    expect(setup.narrative?.proofPoints?.[0].name).toBe("Retention lift");
    expect(setup.stories).toHaveLength(2);
    expect(setup.snapshots).toHaveLength(1);
    expect(setup.intakeGoal?.seniority).toBe("Senior");
    const again = parseProfileFile(profileToYaml(profileFromSetup({ profile: null, setup: setup as CareerOpsSetupV2 })), "profile.yml");
    expect(again.ok).toBe(true);
    expect(again.profile.narrative).toEqual(r.profile.narrative);
    expect(again.profile.stories).toEqual(r.profile.stories);
    expect(again.profile.snapshots).toEqual(r.profile.snapshots);
    expect(again.profile.goal).toEqual(r.profile.goal);
    expect(again.profile.contact).toEqual(r.profile.contact);
  });

  it("still refuses the shape being wrong inside the new keys", () => {
    const paths = (doc: unknown) => validateProfileFile(doc).errors.map((e) => e.path);
    expect(paths({ version: 1, narrative: { proofPoint: [] } })).toEqual(["narrative.proofPoint"]);
    expect(paths({ version: 1, stories: [{ result: "no title" }] })).toEqual(["stories[0]"]);
    expect(paths({ version: 1, snapshots: [{ company: "X", results: "88%" }] })).toEqual(["snapshots[0].results"]);
    expect(paths({ version: 1, snapshots: { company: "X" } })).toEqual(["snapshots"]);
  });

  it("shows the artefacts as one row of the upload review", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    const d = profileDiff({ version: 1 }, r.profile).find((x) => x.key === "artefacts")!;
    expect(d).toMatchObject({ inFile: true, kind: "add", headline: "2 proof points, 2 stories, 1 snapshot" });
    expect(profileDiff(r.profile, r.profile).find((x) => x.key === "artefacts")!.kind).toBe("keep");
  });
});
