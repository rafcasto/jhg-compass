import { describe, it, expect } from "vitest";
import { buildProfileYaml, seniority } from "@/lib/careerops/profile-yaml";

describe("career-ops profile.yml from Compass", () => {
  const profile = { email: "ada@x.io", firstName: "Ada", lastName: "Lovelace", country: "New Zealand" };
  const goal = { role: "Senior Product Owner", subsector: "climate-tech SaaS", companyType: "Scaleup (established)", city: "Auckland, New Zealand", salary: "180,000 – 220,000" };

  it("maps name, goal and salary into career-ops keys", () => {
    const y = buildProfileYaml({ profile, goal });
    expect(y).toContain('full_name: "Ada Lovelace"');
    expect(y).toContain('    - "Senior Product Owner"');
    expect(y).toContain('      level: "Senior"');
    expect(y).toContain('target_range: "180,000 – 220,000"');
    expect(y).toContain('    - "New Zealand"'); // authorized_in
    expect(y).toContain('industry: "climate-tech SaaS"');
  });
  it("tolerates a blank goal and quotes safely", () => {
    const y = buildProfileYaml({ profile: { email: 'q"uote@x.io' }, goal: null });
    expect(y).toContain("  primary:\n    []");
    expect(y).toContain('email: "q\\"uote@x.io"');
  });
  it("appends notes as a block scalar", () => {
    expect(buildProfileYaml({ profile, goal, notes: "Remote only\nNeeds sponsorship" })).toMatch(/notes: \|\n  Remote only\n  Needs sponsorship\n$/);
  });
  it("detects seniority from the title", () => {
    expect(seniority("Head of Data")).toBe("Head");
    expect(seniority("Product Owner")).toBe("");
  });
});
