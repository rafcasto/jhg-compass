import { describe, it, expect } from "vitest";
import {
  SECTIONS,
  coercePersonalization,
  personalizationProgress,
  personalizationSections,
  renderProfileMd,
  renderSection,
  type Personalization,
} from "@/lib/careerops/personalization";

const FULL: Personalization = {
  targetRoles: [{ archetype: "AI Platform / LLMOps", axes: "Evaluation, observability", buys: "Someone who puts AI in production" }],
  adaptiveFraming: [{ role: "Platform / LLMOps", emphasize: "Production systems, evals", proof: "cv.md section 3" }],
  exitNarrative: "Built and sold a SaaS. Now focused on applied AI at scale.",
  crossCuttingAdvantage: "Technical builder with real-world proof.",
  portfolio: { url: "https://jane.dev/demo", description: "Agent dashboard", whenToShare: "LLMOps roles" },
  compTargets: "NZ$180-220k base for senior PO roles in Auckland.",
  negotiationScripts: ["I'm targeting 200k. I'm flexible on structure."],
  locationPolicy: ["Auckland or remote", "No relocation outside NZ"],
};

describe("personalization — the section contract", () => {
  it("has career-ops' eight sections, by id, in template order", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual([
      "targetRoles", "adaptiveFraming", "exitNarrative", "crossCuttingAdvantage",
      "portfolio", "compTargets", "negotiationScripts", "locationPolicy",
    ]);
  });

  it("uses career-ops' exact headings — the file is addressed by heading", () => {
    expect(SECTIONS.map((s) => s.heading)).toEqual([
      "## Your Target Roles",
      "## Your Adaptive Framing",
      "## Your Exit Narrative",
      "## Your Cross-cutting Advantage",
      "## Your Portfolio / Demo",
      "## Your Comp Targets",
      "## Your Negotiation Scripts",
      "## Your Location Policy",
    ]);
  });
});

describe("personalization — validation", () => {
  it("returns nothing for junk, so 'nothing to write' is representable", () => {
    for (const junk of [null, undefined, 0, "x", [], true]) expect(coercePersonalization(junk)).toEqual({});
    expect(coercePersonalization({ nope: 1, targetRoles: "not an array" })).toEqual({});
  });

  it("drops unknown keys", () => {
    expect(coercePersonalization({ ...FULL, sneaky: "value" })).not.toHaveProperty("sneaky");
  });

  it("collapses whitespace and trims", () => {
    expect(coercePersonalization({ exitNarrative: "  a   b \n c  " }).exitNarrative).toBe("a b c");
  });

  it("drops a target-role row with no archetype, and caps at eight", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ archetype: `A${i}`, axes: "x" }));
    expect(coercePersonalization({ targetRoles: [...rows, { axes: "orphan" }] }).targetRoles).toHaveLength(8);
    expect(coercePersonalization({ targetRoles: [{ axes: "orphan" }] }).targetRoles).toBeUndefined();
  });

  it("requires both halves of a framing row", () => {
    expect(coercePersonalization({ adaptiveFraming: [{ role: "PO" }] }).adaptiveFraming).toBeUndefined();
    expect(coercePersonalization({ adaptiveFraming: [{ emphasize: "x" }] }).adaptiveFraming).toBeUndefined();
    expect(coercePersonalization({ adaptiveFraming: [{ role: "PO", emphasize: "x" }] }).adaptiveFraming).toHaveLength(1);
  });

  it("leaves an absent optional cell absent rather than stringifying undefined", () => {
    const row = coercePersonalization({ targetRoles: [{ archetype: "A" }] }).targetRoles![0];
    expect(row).toEqual({ archetype: "A" });
    expect(renderSection("targetRoles", [row])).not.toContain("undefined");
  });

  it("enforces the per-field length caps", () => {
    const long = "x".repeat(2000);
    const p = coercePersonalization({
      exitNarrative: long, crossCuttingAdvantage: long, compTargets: long,
      targetRoles: [{ archetype: long, axes: long }],
    });
    expect(p.exitNarrative).toHaveLength(1200);
    expect(p.crossCuttingAdvantage).toHaveLength(600);
    expect(p.compTargets).toHaveLength(800);
    expect(p.targetRoles![0].archetype).toHaveLength(80);
    expect(p.targetRoles![0].axes).toHaveLength(200);
  });

  it("caps the lists at six scripts and eight location lines", () => {
    expect(coercePersonalization({ negotiationScripts: Array(20).fill("s") }).negotiationScripts).toHaveLength(6);
    expect(coercePersonalization({ locationPolicy: Array(20).fill("l") }).locationPolicy).toHaveLength(8);
  });

  it("rejects a portfolio the agents could not open", () => {
    for (const url of ["jane.dev", "/demo", "javascript:alert(1)", "ftp://x.dev", ""]) {
      expect(coercePersonalization({ portfolio: { url } }).portfolio).toBeUndefined();
    }
    expect(coercePersonalization({ portfolio: { url: "https://jane.dev" } }).portfolio).toEqual({ url: "https://jane.dev" });
  });
});

describe("personalization — rendering", () => {
  it("renders the target-roles table with career-ops' header row", () => {
    const md = renderSection("targetRoles", FULL.targetRoles!);
    expect(md.split("\n")[0]).toBe("| Archetype | Thematic axes | What they buy |");
    expect(md).toContain("| **AI Platform / LLMOps** | Evaluation, observability | Someone who puts AI in production |");
  });

  it("renders the framing table and defaults a missing proof to cv.md", () => {
    const md = renderSection("adaptiveFraming", [{ role: "PO", emphasize: "discovery" }]);
    expect(md.split("\n")[0]).toBe("| If the role is... | Emphasize about you... | Proof point sources |");
    expect(md).toContain("| PO | discovery | cv.md |");
  });

  it("scrubs pipes out of table cells so a row cannot break the table", () => {
    const md = renderSection("targetRoles", [{ archetype: "A | B", axes: "x|y" }]);
    expect(md).toContain("| **A / B** | x/y |");
    expect(md.split("\n")[2].split("|")).toHaveLength(5); // still a 3-column row
  });

  it("strips a leading heading from prose, which would start a new section", () => {
    expect(renderSection("exitNarrative", "## Sneaky\nbody")).not.toMatch(/^#/);
    expect(renderSection("compTargets", "### x")).toBe("x");
  });

  it("renders the portfolio as career-ops' key list, omitting blanks", () => {
    expect(renderSection("portfolio", { url: "https://jane.dev" })).toBe("- url: https://jane.dev");
    expect(renderSection("portfolio", FULL.portfolio!)).toBe("- url: https://jane.dev/demo\n- what: Agent dashboard\n- when_to_share: LLMOps roles");
  });

  it("renders negotiation scripts as blockquotes without doubling existing quotes", () => {
    expect(renderSection("negotiationScripts", ['"Already quoted"', "Plain"])).toBe('> "Already quoted"\n\n> "Plain"');
  });

  it("renders location policy as a bullet list", () => {
    expect(renderSection("locationPolicy", ["a", "b"])).toBe("- a\n- b");
  });
});

describe("personalization — the whole _profile.md", () => {
  it("writes every heading in template order", () => {
    const md = renderProfileMd(FULL);
    const order = SECTIONS.map((s) => md.indexOf(s.heading));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("marks an unanswered section NOT SET rather than leaving a default to inherit", () => {
    const md = renderProfileMd({ exitNarrative: "Only this one." });
    expect(md).toContain("## Your Exit Narrative");
    expect(md).toContain("Only this one.");
    // The whole reason this file exists: no silent fallback to someone else's targeting.
    expect(md.match(/^_NOT SET —/gm)).toHaveLength(SECTIONS.length - 1);
  });

  it("is all NOT SET for a member who has filled in nothing", () => {
    expect(renderProfileMd(null).match(/^_NOT SET —/gm)).toHaveLength(SECTIONS.length);
  });

  it("ends with exactly one newline and has no triple blank lines", () => {
    const md = renderProfileMd(FULL);
    expect(md.endsWith("\n")).toBe(true);
    expect(md.endsWith("\n\n")).toBe(false);
    expect(md).not.toMatch(/\n{3}/);
  });
});

describe("personalization — progress", () => {
  it("counts filled sections", () => {
    expect(personalizationProgress(FULL)).toEqual({ done: 8, total: 8, pct: 100 });
    expect(personalizationProgress(null)).toEqual({ done: 0, total: 8, pct: 0 });
    expect(personalizationProgress({ exitNarrative: "x", compTargets: "y" })).toEqual({ done: 2, total: 8, pct: 25 });
  });

  it("does not count a section that failed validation", () => {
    // A rejected portfolio URL must not read as answered.
    expect(personalizationProgress({ portfolio: { url: "jane.dev" } }).done).toBe(0);
  });

  it("reports a state, label and ask per section", () => {
    const s = personalizationSections({ exitNarrative: "x" });
    expect(s).toHaveLength(8);
    expect(s[2]).toMatchObject({ id: "exitNarrative", state: "filled" });
    expect(s[0]).toMatchObject({ id: "targetRoles", state: "missing" });
    expect(s.every((x) => x.label && x.ask)).toBe(true);
  });
});
