import { describe, it, expect } from "vitest";
import { RESET_CLEARS, stripCoachData } from "@/lib/engine/coach/reset-data";
import { COACHES } from "@/lib/engine/coach/keys";
import type { ProfileFile } from "@/lib/careerops/profile-file";

// Start a coach over, data included: that coach's owned keys and stamp go; every other coach's stay.

const profile: ProfileFile = {
  version: 1,
  goal: { role: "Product Manager", city: "Auckland" },
  contact: { phone: "021", linkedin: "https://l/in/r", title: "PM" },
  narrative: { headline: "Builds products", superpowers: ["Discovery"] },
  notes: "Hard no's: x",
  watchlist: { companies: [{ name: "Halter", careersUrl: "https://jobs.lever.co/halter" }], positive: ["PM"], negative: ["Sales"] },
  companyLists: { all: { sunrise: [{ rank: 1, name: "Halter" }] } },
  jhg: {
    progress: { narrative: { status: "complete", updated: "2026-11-01" }, trueNorth: { status: "complete", updated: "2026-11-02" }, targetCompanies: { status: "in_progress", updated: "2026-11-17" } },
    identity: { city: "Auckland" },
    trueNorth: { boundaries: { currency: "NZD" }, postings: [{ title: "PM" }] },
    targetCompanies: { companies: [{ name: "Halter", rank: 1 }], top10: [{ name: "Halter" }] },
  },
};

describe("stripCoachData", () => {
  it("clears Target companies' keys and stamp and nothing else", () => {
    const out = stripCoachData(profile, "targetCompanies");
    expect(out.jhg?.targetCompanies).toBeUndefined();
    expect(out.companyLists).toBeUndefined();
    expect(out.notes).toBeUndefined();
    expect(out.watchlist).toEqual({ positive: ["PM"], negative: ["Sales"] });
    expect(out.jhg?.progress).toEqual({ narrative: { status: "complete", updated: "2026-11-01" }, trueNorth: { status: "complete", updated: "2026-11-02" } });
    expect(out.jhg?.trueNorth).toEqual(profile.jhg?.trueNorth);
    expect(out.goal).toEqual(profile.goal);
    expect(out.contact).toEqual(profile.contact);
    // The input is not mutated.
    expect(profile.jhg?.targetCompanies?.companies).toHaveLength(1);
  });
  it("clears True North's goal and workbook but leaves the Narrative, and prunes emptied objects", () => {
    const out = stripCoachData(profile, "trueNorth");
    expect(out.goal).toBeUndefined();
    expect(out.jhg?.trueNorth).toBeUndefined();
    expect(out.watchlist).toEqual({ companies: [{ name: "Halter", careersUrl: "https://jobs.lever.co/halter" }] });
    expect(out.narrative).toEqual(profile.narrative);
    expect(out.jhg?.identity).toEqual({ city: "Auckland" });
    const bare = stripCoachData({ version: 1, jhg: { progress: { linkedin: { status: "complete" } }, targetCompanies: { companies: [] } } }, "targetCompanies");
    expect(bare).toEqual({ version: 1, jhg: { progress: { linkedin: { status: "complete" } } } });
    expect(stripCoachData({ version: 1 }, "linkedin")).toEqual({ version: 1 });
  });
  it("has a plain-words line for every coach", () => {
    for (const c of COACHES) expect(RESET_CLEARS[c.key]).toBeTruthy();
  });
});

// A merge write keeps a nested key it does not mention — so the diff marks removals at every depth.
import { DELETE, mergeDiff } from "@/lib/engine/coach/reset-data";

describe("mergeDiff", () => {
  it("marks removed keys for deletion at any depth, writes changed leaves, leaves the rest alone", () => {
    const before = { companyLists: { all: {} }, notes: "x", portals: { companies: [{ name: "Halter" }], positive: ["PM"] }, jhg: { progress: { narrative: { status: "complete" }, targetCompanies: { status: "in_progress" } }, narrative: { leadSkills: ["a"] }, targetCompanies: { companies: [{ name: "Halter" }] } }, cvMarkdown: "cv" };
    const after = { portals: { positive: ["PM"] }, jhg: { progress: { narrative: { status: "complete" } }, narrative: { leadSkills: ["a"] } }, cvMarkdown: "cv" };
    expect(mergeDiff(before, after)).toEqual({ companyLists: DELETE, notes: DELETE, portals: { companies: DELETE }, jhg: { progress: { targetCompanies: DELETE }, targetCompanies: DELETE } });
    expect(mergeDiff({ a: 1 }, { a: 1 })).toBeNull();
    expect(mergeDiff({ a: [1, 2] }, { a: [1] })).toEqual({ a: [1] });
    expect(mergeDiff({}, { a: { b: 1 } })).toEqual({ a: { b: 1 } });
  });
});
