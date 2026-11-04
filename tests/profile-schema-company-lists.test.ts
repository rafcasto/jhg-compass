import { describe, it, expect } from "vitest";
import { JSON_SCHEMA, load } from "js-yaml";
import { validateProfileFile } from "@/lib/careerops/profile-schema";
import { parseProfileFile, profileFromSetup, profileToSetupPatch, profileToYaml } from "@/lib/careerops/profile-file";
import { profileDiff } from "@/lib/careerops/profile-diff";
import { preserveSetupFields } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

// profile.yml `companyLists` (decision 2026-11-05): the Packer's ranked target
// companies — top3 · top10 · all, each sunrise · sunset · unclassified. Shaped
// like the Priya sample the decision was taken on. Read-only in the portal.

const FILE = `version: 1
goal:
  role: "Customer Success Manager"
watchlist:
  companies:
    - name: "Wattle HR Cloud"
      careersUrl: "https://boards.example/wattle-hr-cloud"
companyLists:
  all:
    sunrise:
      - rank: 1
        name: "Wattle HR Cloud"
        industry: "HR tech"
        subSector: "Payroll compliance software"
        companyType: "scaleup"
        careersUrl: "https://boards.example/wattle-hr-cloud"
        careersUrlStatus: "confirmed"
      - rank: 7
        name: "Grevillea Clinic Systems"
        industry: "HR tech"
        subSector: "Payroll compliance software"
        companyType: "scaleup"
        careersUrlStatus: "none"
      - rank: 12
        name: "Gumtree Software 12"
        industry: "Fintech"
        subSector: "Embedded payments"
        companyType: "established"
        careersUrl: "https://careers.example/gumtree-software-12"
        careersUrlStatus: "opened_by_coach"
    sunset:
      - rank: 16
        name: "Gumtree Software 16"
        industry: "HR tech"
        subSector: "On-premise HR suites"
        companyType: "established"
        careersUrl: "https://careers.example/gumtree-software-16"
        careersUrlStatus: "opened_by_coach"
    unclassified:
      - rank: 13
        name: "Gumtree Software 13"
        industry: "HR tech"
        subSector: "Benefits brokerage software"
        companyType: "scaleup"
  top10:
    sunrise:
      - rank: 1
        name: "Wattle HR Cloud"
        industry: "HR tech"
        subSector: "Payroll compliance software"
        companyType: "scaleup"
        careersUrl: "https://boards.example/wattle-hr-cloud"
        careersUrlStatus: "confirmed"
    sunset: []
  top3:
    sunrise:
      - rank: 1
        name: "Wattle HR Cloud"
        industry: "HR tech"
        subSector: "Payroll compliance software"
        companyType: "scaleup"
        careersUrl: "https://boards.example/wattle-hr-cloud"
        careersUrlStatus: "confirmed"
    sunset: []
`;

describe("profile schema — company lists", () => {
  it("accepts the Packer's shape with no errors, empty sunset lists included", () => {
    const r = validateProfileFile(load(FILE, { schema: JSON_SCHEMA }));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("reads the three lists, keeps the trend split and the rank as a number", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    expect(r.ok).toBe(true);
    const all = r.profile.companyLists!.all!;
    expect(all.sunrise!.map((c) => c.rank)).toEqual([1, 7, 12]);
    expect(all.sunset![0]).toEqual({ rank: 16, name: "Gumtree Software 16", industry: "HR tech", subSector: "On-premise HR suites", companyType: "established", careersUrl: "https://careers.example/gumtree-software-16", careersUrlStatus: "opened_by_coach" });
    expect(all.unclassified).toHaveLength(1);
    // A company with no careers page keeps its row and its "none" status — the coach fills the URL later.
    expect(all.sunrise![1]).toEqual({ rank: 7, name: "Grevillea Clinic Systems", industry: "HR tech", subSector: "Payroll compliance software", companyType: "scaleup", careersUrlStatus: "none" });
    // An empty trend list is absent, not an empty array.
    expect(r.profile.companyLists!.top10).toEqual({ sunrise: [expect.objectContaining({ name: "Wattle HR Cloud" })] });
    expect(r.found).toContain("company lists (Top 3: 1 · Top 10: 1 · Top 40: 5)");
  });

  it("stores the lists on the setup document, survives a whole-document save, and exports them again", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    const { setup } = profileToSetupPatch(r.profile);
    expect(setup.companyLists).toEqual(r.profile.companyLists);
    expect(preserveSetupFields(setup as CareerOpsSetupV2).companyLists).toEqual(r.profile.companyLists);
    const again = parseProfileFile(profileToYaml(profileFromSetup({ profile: null, setup: setup as CareerOpsSetupV2 })), "profile.yml");
    expect(again.ok).toBe(true);
    expect(again.profile.companyLists).toEqual(r.profile.companyLists);
  });

  it("leaves the lists alone when the file has none, and never feeds them into the watchlist", () => {
    const r = parseProfileFile("version: 1\nnotes: x\n", "profile.yml");
    expect(r.profile.companyLists).toBeUndefined();
    expect(profileToSetupPatch(r.profile).setup.companyLists).toBeUndefined();
    const withLists = parseProfileFile(FILE, "profile.yml");
    expect(profileToSetupPatch(withLists.profile).setup.portals?.companies.map((c) => c.name)).toEqual(["Wattle HR Cloud"]);
  });

  it("refuses the shape being wrong, and warns (not errors) on an unknown careers status", () => {
    const paths = (doc: unknown) => validateProfileFile(doc).errors.map((e) => e.path);
    expect(paths({ version: 1, companyLists: { top5: {} } })).toEqual(["companyLists.top5"]);
    expect(paths({ version: 1, companyLists: { top3: { dawn: [] } } })).toEqual(["companyLists.top3.dawn"]);
    expect(paths({ version: 1, companyLists: { top3: { sunrise: { name: "X" } } } })).toEqual(["companyLists.top3.sunrise"]);
    expect(paths({ version: 1, companyLists: { top3: { sunrise: [{ rank: "1", name: "X" }] } } })).toEqual(["companyLists.top3.sunrise[0].rank"]);
    expect(paths({ version: 1, companyLists: { top3: { sunrise: [{ rank: 1 }] } } })).toEqual(["companyLists.top3.sunrise[0]"]);
    const r = validateProfileFile({ version: 1, companyLists: { top3: { sunrise: [{ rank: 1, name: "X", careersUrlStatus: "guessed" }] } } });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('careersUrlStatus is "guessed"'))).toBe(true);
    expect(parseProfileFile('version: 1\ncompanyLists:\n  top3:\n    sunrise:\n      - rank: 1\n        name: "X"\n        careersUrlStatus: "guessed"\n', "profile.yml").profile.companyLists?.top3?.sunrise?.[0]).toEqual({ rank: 1, name: "X" });
  });

  it("is one row of the upload review — added, then same as now, then replaced as a whole", () => {
    const r = parseProfileFile(FILE, "profile.yml");
    const add = profileDiff({ version: 1 }, r.profile).find((x) => x.key === "companyLists")!;
    expect(add).toMatchObject({ inFile: true, kind: "add", headline: "Top 3 (1), Top 10 (1), Top 40 (5)" });
    expect(profileDiff(r.profile, r.profile).find((x) => x.key === "companyLists")!.kind).toBe("keep");
    const smaller = { ...r.profile, companyLists: { top3: r.profile.companyLists!.top3 } };
    expect(profileDiff(r.profile, smaller).find((x) => x.key === "companyLists")).toMatchObject({ kind: "replace", headline: "Top 3 (1)" });
    expect(profileDiff(r.profile, { version: 1 }).find((x) => x.key === "companyLists")).toMatchObject({ inFile: false, kind: "keep" });
  });
});
