import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GoalStatement from "@/components/compass/GoalStatement";
import { COMPANY_TYPES, companyTypePhrase, goalFromLegacy, goalFromProfile, normalizeGoal } from "@/lib/goal";

const goal = {
  role: "Senior Product Owner",
  subsector: "climate-tech SaaS",
  companyType: "Scaleup (established)",
  city: "Auckland, New Zealand",
  salary: "180,000 – 220,000",
};

describe("GoalStatement", () => {
  it("renders every field as an italic value", () => {
    render(<GoalStatement goal={goal} />);
    for (const [k, v] of Object.entries(goal)) {
      const el = screen.getByText(k === "companyType" ? `a ${v}` : v);
      expect(el.tagName).toBe("EM");
      expect(el).toHaveAttribute("data-field", k);
      expect(el).not.toHaveAttribute("data-empty");
    }
    const text = screen.getByTestId("goal-statement").textContent!;
    expect(text).toContain("In 60 days from now, I'm working as Senior Product Owner, making $180,000 – 220,000 yearly before tax.");
    expect(text).toContain("I'm based in Auckland, New Zealand and specialise in thriving industry climate-tech SaaS.");
    expect(text).toContain("I enjoy working for a Scaleup (established), with flexible working arrangements.");
  });

  it("breaks the line after 'before tax.' and after the subsector", () => {
    const { container } = render(<GoalStatement goal={goal} />);
    const html = container.querySelector("p")!.innerHTML;
    expect(html).toMatch(/before tax\.<br>/);
    expect(html).toMatch(/climate-tech SaaS<\/em>\.<br>/);
    expect(container.querySelectorAll("br")).toHaveLength(2);
  });

  it("shows dimmed placeholders for blank fields", () => {
    render(<GoalStatement goal={{}} />);
    const blanks = screen.getAllByText(/^(\[.+\]|____)$/);
    expect(blanks.map((b) => b.textContent)).toEqual([
      "[Seniority Level + Job title]", "____", "[City]", "[Specific Subsector]", "[Company Type]",
    ]);
    blanks.forEach((b) => expect(b).toHaveAttribute("data-empty", "true"));
  });
});

describe("goal helpers", () => {
  it("exposes the agreed company types in order", () => {
    expect([...COMPANY_TYPES]).toEqual([
      "Multinational Company (MNC)",
      "Family Business",
      "Scaleup (established)",
      "Startup (early stage)",
      "Small Business",
      "Government",
      "Not-For-Profit Organisation (NPO)",
    ]);
  });

  it("prefixes company types with an article so they read inline", () => {
    expect(companyTypePhrase("Multinational Company (MNC)")).toBe("a Multinational Company (MNC)");
    expect(companyTypePhrase("Government")).toBe("the Government");
    expect(companyTypePhrase("")).toBe("");
    expect(companyTypePhrase("Something custom")).toBe("Something custom");
  });

  it("maps the legacy onboarding compass onto the goal", () => {
    expect(goalFromLegacy({ jobTitle: "PO", industry: "Retail", geography: "Auckland", companyType: "large", targetSalary: "250,000" }))
      .toEqual({ role: "PO", subsector: "Retail", companyType: "Multinational Company (MNC)", city: "Auckland", salary: "250,000" });
    expect(goalFromLegacy({ companyType: "startup" }).companyType).toBe("Startup (early stage)");
    expect(goalFromLegacy({ companyType: "small" }).companyType).toBe("Small Business");
    expect(goalFromLegacy({ companyType: "mid-size" }).companyType).toBe("Scaleup (established)");
  });

  it("upgrades company types saved by the first Compass-tab release", () => {
    const p = { email: "x@y.z", goal: { role: "PO", companyType: "an SME" } };
    expect(goalFromProfile(p).companyType).toBe("Small Business");
    expect(goalFromProfile({ email: "x@y.z", goal: { companyType: "a large enterprise" } }).companyType).toBe("Multinational Company (MNC)");
  });

  it("prefers profile.goal over the legacy compass", () => {
    const p = { email: "x@y.z", goal: { role: "New" }, compass: { jobTitle: "Old" } };
    expect(goalFromProfile(p).role).toBe("New");
  });

  it("trims on normalise", () => {
    expect(normalizeGoal({ role: "  PO ", salary: "", city: undefined }))
      .toEqual({ role: "PO", subsector: "", companyType: "", city: "", salary: "" });
  });
});
