import { describe, it, expect } from "vitest";
import { profileDiff, diffReplaces } from "@/lib/careerops/profile-diff";
import type { ProfileFile } from "@/lib/careerops/profile-file";

const current: ProfileFile = {
  version: 1,
  goal: { role: "Delivery Lead", city: "Wellington" },
  contact: { phone: "+64 21 000 0000", github: "github.com/ana" },
  policy: { minimumSalary: "NZ$ 140,000" },
  personalization: { exitNarrative: "Old story.", compTargets: "NZ$150k" },
  watchlist: { companies: [{ name: "Xero", careersUrl: "https://xero.com/careers" }, { name: "Old Co", careersUrl: "https://old.co/jobs" }], positive: ["Delivery Lead"], negative: ["intern"] },
  notes: "Old notes",
  cv: "# CV\n\n## Experience\n2019 – 2024 Acme " + "word ".repeat(100),
};

const byKey = (d: ReturnType<typeof profileDiff>) => Object.fromEntries(d.map((x) => [x.key, x]));

describe("profileDiff — one row per section, always six", () => {
  it("marks every section absent from the file as kept", () => {
    const d = profileDiff(current, { version: 1 });
    expect(d.map((x) => x.key)).toEqual(["northstar", "contact", "targeting", "watchlist", "notes", "cv"]);
    expect(d.every((x) => !x.inFile && x.kind === "keep")).toBe(true);
    expect(diffReplaces(d)).toBe(false);
  });

  it("adds everything onto an empty profile", () => {
    const d = byKey(profileDiff({ version: 1 }, current));
    expect(d.northstar.kind).toBe("add");
    expect(d.northstar.detail).toBe("Delivery Lead");
    expect(d.contact.kind).toBe("add");
    expect(d.contact.headline).toBe("adds 3");
    expect(d.targeting.kind).toBe("add");
    expect(d.targeting.headline).toMatch(/^2 of 8 sections — adds 2$/);
    expect(d.watchlist.kind).toBe("add");
    expect(d.watchlist.headline).toBe("2 companies, 1 include, 1 exclude");
    expect(d.notes.kind).toBe("add");
    expect(d.cv.kind).toBe("add");
    expect(d.cv.detail).toMatch(/words · Ready to score/);
    expect(diffReplaces(Object.values(d))).toBe(false);
  });

  it("says 'same as now' for an identical file", () => {
    const d = profileDiff(current, current);
    expect(d.every((x) => x.inFile && x.kind === "keep")).toBe(true);
    expect(d.map((x) => x.headline)).toEqual(["same as now", "same as now", "2 of 8 sections — same as now", "same as now", "same as now", "same as now"]);
  });
});

describe("profileDiff — replaces are reported honestly", () => {
  it("shows the role change on the North Star", () => {
    const d = byKey(profileDiff(current, { version: 1, goal: { role: "Senior Delivery Lead", city: "Wellington" } }));
    expect(d.northstar.kind).toBe("replace");
    expect(d.northstar.detail).toBe("Delivery Lead  →  Senior Delivery Lead");
  });

  it("does not apply a goal without a role", () => {
    const d = byKey(profileDiff(current, { version: 1, goal: { city: "Auckland" } }));
    expect(d.northstar.kind).toBe("keep");
    expect(d.northstar.headline).toMatch(/no job title/);
  });

  it("reports a dropped contact field, because the section is replaced whole", () => {
    const d = byKey(profileDiff(current, { version: 1, contact: { phone: "+64 21 000 0000", linkedin: "in/ana" } }));
    expect(d.contact.kind).toBe("replace");
    expect(d.contact.headline).toBe("adds 1, keeps 1, drops 1");
    expect(d.contact.detail).toBe("adds linkedin · drops github");
  });

  it("leaves the policy half alone when the file only carries contact", () => {
    const d = byKey(profileDiff(current, { version: 1, contact: { phone: "+64 21 000 0000", github: "github.com/ana" } }));
    expect(d.contact.kind).toBe("keep");
    expect(d.contact.headline).toBe("same as now");
  });

  it("names the targeting sections it replaces, adds and drops", () => {
    const d = byKey(profileDiff(current, { version: 1, personalization: { exitNarrative: "New story.", crossCuttingAdvantage: "Edge." } }));
    expect(d.targeting.kind).toBe("replace");
    expect(d.targeting.detail).toBe("replaces exit narrative · adds cross-cutting advantage · drops comp targets");
  });

  it("lists watchlist companies added, kept and dropped by name", () => {
    const d = byKey(profileDiff(current, { version: 1, watchlist: { companies: [{ name: "Xero", careersUrl: "https://xero.com/careers" }, { name: "Halter", careersUrl: "https://halterhq.com/careers" }], positive: [], negative: [] } }));
    expect(d.watchlist.kind).toBe("replace");
    expect(d.watchlist.detail).toBe("adds Halter · keeps 1 · drops Old Co");
    expect(diffReplaces(Object.values(d))).toBe(true);
  });

  it("flags a replaced CV and notes", () => {
    const d = byKey(profileDiff(current, { version: 1, notes: "New notes\nmore", cv: "# CV short" }));
    expect(d.notes.kind).toBe("replace");
    expect(d.notes.detail).toBe("New notes");
    expect(d.cv.kind).toBe("replace");
    expect(d.cv.detail).toMatch(/A bit thin/);
  });
});
