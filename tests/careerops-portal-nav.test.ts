import { describe, it, expect } from "vitest";
import { PORTAL_SECTIONS, parseTool, toolHref, PORTAL_HOME } from "@/lib/careerops/portal-nav";

describe("CareerOps portal navigation", () => {
  it("has the four sections in order with their tool counts (3 · 5 · 3 · 4)", () => {
    expect(PORTAL_SECTIONS.map((s) => s.label)).toEqual(["Sourcing", "Scoring", "Tailoring", "Tracking"]);
    expect(PORTAL_SECTIONS.map((s) => s.tools.length)).toEqual([3, 5, 3, 4]);
  });
  it("lists the career-ops tools by their CLI names", () => {
    expect(PORTAL_SECTIONS[0].tools.map((t) => t.key)).toEqual(["scan", "pipeline", "deep"]);
    expect(PORTAL_SECTIONS[1].tools.map((t) => t.key)).toEqual(["oferta", "ofertas", "batch", "training", "project"]);
    expect(PORTAL_SECTIONS[2].tools.map((t) => t.key)).toEqual(["contacto", "pdf", "apply"]);
    expect(PORTAL_SECTIONS[3].tools.map((t) => t.key)).toEqual(["tracker", "interview-prep", "followup", "patterns"]);
  });
  it("parses the ?tool query with a safe fallback", () => {
    expect(parseTool("scoring", "batch")).toBe("batch");
    expect(parseTool("scoring", "nope")).toBe("oferta");
    expect(parseTool("tracking", null)).toBe("tracker");
    expect(toolHref("tailoring", "pdf")).toBe("/careerops/tailoring?tool=pdf");
    expect(PORTAL_HOME).toBe("/careerops/sourcing");
  });
});
