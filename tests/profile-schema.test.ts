import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSON_SCHEMA, load } from "js-yaml";
import { validateProfileFile } from "@/lib/careerops/profile-schema";
import { parseProfileFile, profileToYaml, profileFromSetup, PROFILE_FILENAME } from "@/lib/careerops/profile-file";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";

const example = readFileSync("public/profile.example.yml", "utf8");
const paths = (r: { errors: { path: string }[] }) => r.errors.map((e) => e.path);

describe("profile schema — the example file", () => {
  it("validates with no errors", () => {
    const r = validateProfileFile(load(example, { schema: JSON_SCHEMA }));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("warns, not errors, about a company with no careers URL (Timely)", () => {
    const r = validateProfileFile(load(example, { schema: JSON_SCHEMA }));
    expect(r.warnings.some((w) => w.startsWith("Timely has no careers URL"))).toBe(true);
  });

  it("parses end to end and finds every section", () => {
    const r = parseProfileFile(example, "profile.yml");
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.profile.goal?.role).toBe("Senior Delivery Lead");
    expect(r.profile.watchlist?.companies.length).toBe(9); // 10 listed, Timely has no URL
    expect(r.found).toContain("your CV");
    expect(r.found.some((f) => f.startsWith("targeting (7/8"))).toBe(true); // the sample has no negotiation scripts
  });
});

describe("profile schema — data may be missing", () => {
  it("accepts a file with only version and one section", () => {
    const r = validateProfileFile({ version: 1, notes: "Avoid agencies." });
    expect(r.ok).toBe(true);
  });

  it("treats a bare `key:` (null) as absent, not a type error", () => {
    const r = validateProfileFile({ version: 1, goal: null, contact: { phone: null }, personalization: { negotiationScripts: null } });
    expect(r.ok).toBe(true);
  });

  it("warns when the goal has no role", () => {
    const r = validateProfileFile({ version: 1, goal: { city: "Wellington" } });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("no role"))).toBe(true);
  });
});

describe("profile schema — the shape may not be wrong", () => {
  it("requires version: 1", () => {
    expect(paths(validateProfileFile({ goal: { role: "x" } }))).toEqual(["version"]);
    expect(validateProfileFile({ version: "1" }).errors[0].message).toMatch(/must be the number 1/);
    expect(validateProfileFile({ version: 2 }).errors[0].message).toMatch(/newer Packer/);
  });

  it("names an unknown top-level key, with a hint for a near miss", () => {
    const r = validateProfileFile({ version: 1, goals: { role: "x" } });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([{ path: "goals", message: "unknown key (did you mean goal?)" }]);
  });

  it("names an unknown key inside a section", () => {
    const r = validateProfileFile({ version: 1, contact: { phone: "1", twitter: "@x" } });
    expect(paths(r)).toEqual(["contact.twitter"]);
  });

  it("rejects wrong types with the path and what it got", () => {
    const r = validateProfileFile({
      version: 1,
      goal: "Senior Delivery Lead",
      policy: { authorizedIn: "New Zealand", needsSponsorship: "yes" },
      watchlist: { companies: { name: "Xero" } },
      cv: ["line"],
    });
    expect(paths(r).sort()).toEqual(["cv", "goal", "policy.authorizedIn", "policy.needsSponsorship", "watchlist.companies"].sort());
    expect(r.errors.find((e) => e.path === "policy.authorizedIn")?.message).toBe("must be a list of strings, got string");
    expect(r.errors.find((e) => e.path === "goal")?.message).toMatch(/group of fields, got string/);
  });

  it("requires archetype / role+emphasize / company name in rows", () => {
    const r = validateProfileFile({
      version: 1,
      personalization: { targetRoles: [{ axes: "x" }], adaptiveFraming: [{ role: "r" }] },
      watchlist: { companies: [{ careersUrl: "https://x" }] },
    });
    expect(paths(r)).toEqual(["personalization.targetRoles[0]", "personalization.adaptiveFraming[0]", "watchlist.companies[0]"]);
    expect(r.errors[0].message).toBe("missing archetype");
    expect(r.errors[1].message).toBe("missing emphasize");
    expect(r.errors[2].message).toBe("missing name");
  });

  it("rejects a list or a scalar at the top", () => {
    expect(validateProfileFile([1]).ok).toBe(false);
    expect(validateProfileFile("version: 1").ok).toBe(false);
    expect(validateProfileFile(null).ok).toBe(false);
  });
});

describe("profile schema — caps are warnings", () => {
  it("warns on too many rows and too-long prose, but stays ok", () => {
    const r = validateProfileFile({
      version: 1,
      personalization: {
        targetRoles: Array.from({ length: 9 }, (_, i) => ({ archetype: `A${i}` })),
        exitNarrative: "x".repeat(1201),
      },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toMatch(/targetRoles has 9 entries — only the first 8/);
    expect(r.warnings[1]).toMatch(/exitNarrative is 1201 characters — trimmed to 1200/);
  });
});

describe("parseProfileFile — the strict path", () => {
  it("refuses anything that is not a .yml", () => {
    expect(parseProfileFile("# La Maleta\n## CV\n", "profile.md").error).toMatch(/\.yml file/);
  });

  it("refuses the legacy career-ops config/profile.yml shape as unknown keys", () => {
    const r = parseProfileFile("version: 1\ncandidate:\n  title: x\ntarget_roles:\n  primary: [a]\n", "profile.yml");
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.path)).toEqual(["candidate", "target_roles"]);
    expect(r.error).toBeUndefined();
  });

  it("reports a YAML syntax error as one line, not schema errors", () => {
    const r = parseProfileFile("version: 1\ngoal:\n  role: [unclosed\n", "profile.yml");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/didn't parse/);
    expect(r.errors).toEqual([]);
  });

  it("says so when the file is valid but empty", () => {
    expect(parseProfileFile("version: 1\n", "profile.yml").error).toMatch(/nothing in it/);
  });

  it("round-trips an export", () => {
    const setup = {
      cvMarkdown: "# Jane\n\n## Experience\n2019 – 2024 Acme",
      profileYaml: "", notes: "Avoid agencies.", updatedAt: 1,
      goalSource: "intake", intakeGoal: { role: "Senior PO", city: "Auckland" },
      contact: { phone: "+64 21 000 0000" },
      policy: { minimumSalary: "180,000", needsSponsorship: true, authorizedIn: ["New Zealand"] },
      personalization: { exitNarrative: "Built and sold a SaaS." },
      portals: { companies: [{ name: "Acme", careersUrl: "https://acme.com/jobs" }], positive: ["PO"], negative: ["Junior"] },
    } as CareerOpsSetupV2;
    const yaml = profileToYaml(profileFromSetup({ profile: null, setup }));
    expect(yaml.startsWith("# Your JobHacker Compass profile")).toBe(true);
    expect(yaml).not.toMatch(/maleta/i);
    const back = parseProfileFile(yaml, PROFILE_FILENAME);
    expect(back.ok).toBe(true);
    expect(back.errors).toEqual([]);
    expect(back.profile).toEqual(profileFromSetup({ profile: null, setup }));
  });
});
