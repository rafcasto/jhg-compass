import { describe, it, expect } from "vitest";
import { buildPortalsYaml, normalizeUrl, suggestKeywords, MAX_COMPANIES } from "@/lib/careerops/portals-yaml";

describe("portals.yml from the Setup screen", () => {
  it("writes companies and the title filter", () => {
    const y = buildPortalsYaml({ companies: [{ name: "Xero", careersUrl: "jobs.lever.co/xero" }, { name: " ", careersUrl: "x" }], positive: ["Product Owner"], negative: ["Junior"] });
    expect(y).toContain('  - name: "Xero"\n    careers_url: "https://jobs.lever.co/xero"\n    enabled: true');
    expect(y).toContain('  positive:\n    - "Product Owner"');
    expect(y).not.toContain('name: " "');
  });
  it("emits provider and api for branded ATS boards, dropping junk provider ids", () => {
    const y = buildPortalsYaml({ companies: [
      { name: "ANZ", careersUrl: "https://careers.anz.com", provider: " SuccessFactors ", apiUrl: "careers.anz.com" },
      { name: "ASB", careersUrl: "https://careers.asbgroup.co.nz/search", provider: "rm -rf /", apiUrl: "  " },
    ], positive: [], negative: [] });
    expect(y).toContain('  - name: "ANZ"\n    careers_url: "https://careers.anz.com/"\n    provider: "successfactors"\n    api: "https://careers.anz.com/"\n    enabled: true');
    expect(y).toContain('  - name: "ASB"\n    careers_url: "https://careers.asbgroup.co.nz/search"\n    enabled: true');
    expect(y).not.toContain("rm -rf");
  });
  it("caps the company list and tolerates empties", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `Co${i}`, careersUrl: `https://co${i}.com/jobs` }));
    expect((buildPortalsYaml({ companies: many, positive: [], negative: [] }).match(/- name:/g) ?? []).length).toBe(MAX_COMPANIES);
    expect(buildPortalsYaml({ companies: [], positive: [], negative: [] })).toContain("tracked_companies:\n  []");
  });
  it("normalises URLs and rejects junk", () => {
    expect(normalizeUrl("boards.greenhouse.io/acme")).toBe("https://boards.greenhouse.io/acme");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
  it("suggests keywords from the goal role", () => {
    expect(suggestKeywords("Senior Product Owner")).toEqual(["Product Owner", "Product Manager"]);
    expect(suggestKeywords("QA Manager")).toEqual(["QA Manager", "Test", "QA", "Quality Engineer", "Quality Assurance"]);
    expect(suggestKeywords("Test Lead")).toContain("Test");
    expect(suggestKeywords("")).toEqual([]);
  });
});
