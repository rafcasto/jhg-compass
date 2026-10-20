import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { maletaToMarkdown, maletaToYaml, parseMaleta } from "@/lib/careerops/maleta";

// docs/la-maleta.example.yml is the reference maleta, and docs/LA_MALETA.md is
// the spec written around it. Documentation drifts the moment nothing checks
// it, so the example is parsed here: change the schema without updating the
// example and this fails.

const EXAMPLE = path.resolve(__dirname, "../docs/la-maleta.example.yml");
const text = readFileSync(EXAMPLE, "utf8");

describe("docs/la-maleta.example.yml", () => {
  const parsed = parseMaleta(text, "la-maleta.example.yml");

  it("parses", () => {
    expect(parsed.error).toBeUndefined();
    expect(parsed.ok).toBe(true);
    expect(parsed.format).toBe("yaml");
    expect(parsed.warnings).toEqual([]);
  });

  it("is a maleta, not mistaken for a career-ops profile.yml", () => {
    // It has `goal`/`contact`, not `candidate`/`target_roles`.
    expect(parsed.warnings.join(" ")).not.toMatch(/career-ops config/);
  });

  it("exercises every part of the schema, so the spec has nothing undocumented", () => {
    expect(parsed.found).toEqual([
      "your CV",
      "North Star (Senior Product Owner)",
      "contact details (5)",
      "logistics",
      "targeting (8/8 sections)",
      "watchlist (2 companies)",
      "notes",
    ]);
  });

  it("reads the goal, including a quoted company type with brackets", () => {
    expect(parsed.maleta.goal).toEqual({
      role: "Senior Product Owner",
      subsector: "climate-tech SaaS",
      companyType: "Startup (early stage)",
      city: "Auckland, New Zealand",
      salary: "NZ$180,000 – 220,000",
    });
  });

  it("reads all five contact fields the worker consumes", () => {
    expect(parsed.maleta.contact).toEqual({
      title: "Product leader, climate tech",
      phone: "+64 21 000 0000",
      linkedin: "linkedin.com/in/janesmith",
      portfolio: "https://jane.dev",
      github: "github.com/janesmith",
    });
  });

  it("reads the policy, and does not turn needsSponsorship: false into true", () => {
    expect(parsed.maleta.policy?.minimumSalary).toBe("NZ$160,000");
    expect(parsed.maleta.policy?.visaStatus).toMatch(/NZ citizen/);
    expect(parsed.maleta.policy?.authorizedIn).toEqual(["New Zealand", "Australia"]);
    expect(parsed.maleta.policy?.needsSponsorship).toBeUndefined();
  });

  it("reads all eight targeting sections", () => {
    const p = parsed.maleta.personalization!;
    expect(Object.keys(p).sort()).toEqual([
      "adaptiveFraming", "compTargets", "crossCuttingAdvantage", "exitNarrative",
      "locationPolicy", "negotiationScripts", "portfolio", "targetRoles",
    ]);
    expect(p.targetRoles).toHaveLength(2);
    expect(p.targetRoles![0].archetype).toBe("AI Platform / LLMOps Engineer");
    expect(p.adaptiveFraming).toHaveLength(2);
    expect(p.portfolio?.url).toBe("https://jane.dev/demo");
    expect(p.negotiationScripts).toHaveLength(2);
    expect(p.locationPolicy).toHaveLength(3);
    // folded YAML scalars arrive as one line
    expect(p.exitNarrative).not.toContain("\n");
  });

  it("reads the watchlist and the CV", () => {
    expect(parsed.maleta.watchlist?.companies.map((c) => c.name)).toEqual(["Acme Climate", "Beta Energy"]);
    expect(parsed.maleta.watchlist?.positive).toEqual(["Product Owner", "Product Manager"]);
    expect(parsed.maleta.watchlist?.negative).toEqual(["Junior", "Intern"]);
    expect(parsed.maleta.cv).toContain("## Experience");
    expect(parsed.maleta.notes).toMatch(/Avoid agencies/);
  });

  it("ignores the reserved keys that are commented out for later", () => {
    // They are comments today. If someone uncomments one before the parser
    // learns it, it must be dropped silently rather than breaking the import.
    const withReserved = text + "\nspendTier: premium\ncultureScreen:\n  deprioritizeIfAbsent: true\n";
    const p = parseMaleta(withReserved, "x.yml");
    expect(p.ok).toBe(true);
    expect(p.maleta).not.toHaveProperty("spendTier");
    expect(p.maleta).not.toHaveProperty("cultureScreen");
  });

  it("round-trips through both export formats without loss", () => {
    const viaYaml = parseMaleta(maletaToYaml(parsed.maleta), "x.yml");
    expect(viaYaml.maleta).toEqual(parsed.maleta);

    const viaMd = parseMaleta(maletaToMarkdown(parsed.maleta), "x.md");
    expect(viaMd.maleta.goal).toEqual(parsed.maleta.goal);
    expect(viaMd.maleta.contact).toEqual(parsed.maleta.contact);
    expect(viaMd.maleta.policy).toEqual(parsed.maleta.policy);
    expect(viaMd.maleta.personalization).toEqual(parsed.maleta.personalization);
    expect(viaMd.maleta.watchlist?.companies).toEqual(parsed.maleta.watchlist?.companies);
    expect(viaMd.maleta.cv).toBe(parsed.maleta.cv?.trim());
  });
});
