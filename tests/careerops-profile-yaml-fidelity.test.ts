import { describe, it, expect } from "vitest";
import { buildProfileYaml } from "@/lib/careerops/profile-yaml";
import type { Profile } from "@/lib/types";

// The Pi worker parses this file with careerops-worker/lib/profile.js →
// parseProfile(), which reads candidate.full_name/email/phone/location/
// linkedin/github/portfolio_url, target_roles.primary[],
// compensation.target_range/minimum and location.country — then feeds them to
// the CV PDF header, the cover-letter contact block and the application-form
// autofill. These tests pin the field NAMES, because a rename here silently
// blanks a field on every generated document rather than failing.

const profile = { firstName: "Jane", lastName: "Smith", email: "jane@example.com", country: "New Zealand" } as Profile;
const goal = { role: "Senior Product Owner", subsector: "climate-tech", companyType: "Startup (early stage)", city: "Auckland", salary: "180,000 – 220,000" };

const lines = (yaml: string) => yaml.split("\n");
const has = (yaml: string, line: string) => expect(lines(yaml)).toContain(line);
const lacksKey = (yaml: string, key: string) => expect(lines(yaml).some((l) => l.trim().startsWith(`${key}:`))).toBe(false);

describe("profile.yml — the candidate block the worker reads", () => {
  it("emits every contact field under the names career-ops uses", () => {
    const y = buildProfileYaml({
      profile, goal,
      contact: { title: "Product leader, climate", phone: "+64 21 000 0000", linkedin: "linkedin.com/in/janesmith", github: "github.com/janesmith", portfolio: "https://jane.dev" },
    });
    has(y, '  title: "Product leader, climate"');
    has(y, '  phone: "+64 21 000 0000"');
    has(y, '  linkedin: "linkedin.com/in/janesmith"');
    has(y, '  github: "github.com/janesmith"');
    // career-ops calls it portfolio_url, not portfolio.
    has(y, '  portfolio_url: "https://jane.dev"');
  });

  it("omits contact keys that were never filled in, rather than writing empties", () => {
    const y = buildProfileYaml({ profile, goal });
    for (const k of ["title", "phone", "linkedin", "github", "portfolio_url"]) lacksKey(y, k);
    // The always-present identity fields stay.
    has(y, '  full_name: "Jane Smith"');
    has(y, '  email: "jane@example.com"');
    has(y, '  location: "Auckland"');
  });

  it("treats whitespace as absent", () => {
    const y = buildProfileYaml({ profile, goal, contact: { phone: "   ", linkedin: "" } });
    lacksKey(y, "phone");
    lacksKey(y, "linkedin");
  });
});

describe("profile.yml — compensation", () => {
  it("writes the walk-away number the worker reads as compensation.minimum", () => {
    const y = buildProfileYaml({ profile, goal, policy: { minimumSalary: "160,000", locationFlexibility: "Remote, 1 week/month on-site" } });
    has(y, '  target_range: "180,000 – 220,000"');
    has(y, '  minimum: "160,000"');
    has(y, '  location_flexibility: "Remote, 1 week/month on-site"');
  });

  it("no longer writes the hardcoded empty minimum that meant \"never asked\"", () => {
    const y = buildProfileYaml({ profile, goal });
    expect(y).not.toContain('minimum: ""');
    expect(y).not.toContain('location_flexibility: ""');
    lacksKey(y, "minimum");
  });
});

describe("profile.yml — location and work authorization", () => {
  it("carries visa status and an explicit authorization list", () => {
    const y = buildProfileYaml({ profile, goal, policy: { visaStatus: "NZ citizen — no sponsorship needed", authorizedIn: ["New Zealand", "Australia"] } });
    has(y, '  visa_status: "NZ citizen — no sponsorship needed"');
    has(y, "  authorized_in:");
    has(y, '    - "New Zealand"');
    has(y, '    - "Australia"');
  });

  it("falls back to the member's own country when no list is given", () => {
    const y = buildProfileYaml({ profile, goal });
    has(y, "  authorized_in:");
    has(y, '    - "New Zealand"');
  });

  it("drops blanks from the authorization list and falls back if nothing survives", () => {
    const y = buildProfileYaml({ profile, goal, policy: { authorizedIn: ["  ", ""] } });
    has(y, '    - "New Zealand"');
  });

  it("omits authorized_in entirely when there is nothing to claim", () => {
    const y = buildProfileYaml({ profile: { ...profile, country: "" } as Profile, goal });
    lacksKey(y, "authorized_in");
  });

  it("writes needs_sponsorship only when it is actually true", () => {
    // career-ops treats an absent key as false; writing `false` would read as a
    // checked fact rather than an unanswered question.
    expect(buildProfileYaml({ profile, goal })).not.toContain("needs_sponsorship");
    expect(buildProfileYaml({ profile, goal, policy: { needsSponsorship: false } })).not.toContain("needs_sponsorship");
    has(buildProfileYaml({ profile, goal, policy: { needsSponsorship: true } }), "  needs_sponsorship: true");
  });
});

describe("profile.yml — still valid and still backward compatible", () => {
  it("keeps every key the previous version emitted, minus the two empties", () => {
    const y = buildProfileYaml({ profile, goal, notes: "Avoid agencies." });
    for (const key of ["candidate:", "target_roles:", "narrative:", "compensation:", "location:", "preferences:"]) {
      expect(lines(y)).toContain(key);
    }
    has(y, '  headline: "Senior Product Owner in climate-tech"');
    has(y, '    - name: "Senior Product Owner"');
    has(y, '      level: "Senior"');
    has(y, '  industry: "climate-tech"');
    has(y, '  company_type: "Startup (early stage)"');
    has(y, "notes: |");
    has(y, "  Avoid agencies.");
  });

  it("produces output with no stray blank-valued keys at all", () => {
    const y = buildProfileYaml({ profile: null, goal: null });
    // An empty profile still yields a parseable skeleton, not a crash.
    expect(y).toContain("candidate:");
    expect(y).toContain("    []");
    expect(y.endsWith("\n")).toBe(true);
  });

  it("quotes values so colons and hashes cannot break the YAML", () => {
    const y = buildProfileYaml({ profile, goal, contact: { title: 'Lead: AI #1 "builder"' } });
    has(y, '  title: "Lead: AI #1 \\"builder\\""');
  });
});
