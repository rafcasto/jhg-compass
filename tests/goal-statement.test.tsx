import { describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import GoalStatement from "@/components/compass/GoalStatement";
import { COMPANY_TYPES, TRUE_NORTH_ORDER, TRUE_NORTH_PLACEHOLDERS, companyTypePhrase, goalFromLegacy, goalFromProfile, normalizeGoal, trueNorthText } from "@/lib/goal";

const goal = {
  role: "Senior Product Owner",
  subsector: "climate-tech SaaS",
  companyType: "Scaleup (established)",
  city: "Auckland, New Zealand",
  salary: "180,000 – 220,000",
};

// The Compass goal statement IS the True North statement (decision 2026-11-07):
// one sentence on the Compass tab, onboarding step 2 and True North, from one
// template in lib/goal.
describe("GoalStatement", () => {
  it("renders every blank as an italic value, in the True North sentence", () => {
    render(<GoalStatement goal={goal} />);
    const expected: Record<string, string> = { role: goal.role, industry: goal.subsector, location: goal.city, salary: goal.salary, companyType: `a ${goal.companyType}` };
    for (const [k, v] of Object.entries(expected)) {
      const el = screen.getByText(v);
      expect(el.tagName).toBe("EM");
      expect(el).toHaveAttribute("data-field", k);
      expect(el).not.toHaveAttribute("data-empty");
    }
    const text = screen.getByTestId("goal-statement").textContent!;
    expect(text).toContain("In 60 days, I'm working as Senior Product Owner, in climate-tech SaaS.");
    expect(text).toContain("I'm based in Auckland, New Zealand and I'm making 180,000 – 220,000 yearly before tax.");
    expect(text).toContain("I enjoy working for a Scaleup (established).");
    expect(text).not.toContain("flexible working arrangements");
  });

  it("reads as the one True North text, word for word", () => {
    render(<GoalStatement goal={goal} />);
    // A <br> is a line break in the sentence — read it as a space.
    const spoken = Array.from(screen.getByTestId("goal-statement").childNodes).map((n) => (n.nodeName === "BR" ? " " : n.textContent)).join("");
    expect(spoken.replace(/\s+/g, " ").trim()).toBe(trueNorthText(goal));
  });

  it("puts the seniority level in front of the title, without doubling a level already typed into it", () => {
    render(<GoalStatement goal={{ role: "Product Owner", seniority: "Senior" }} />);
    expect(screen.getByText("Senior Product Owner")).toHaveAttribute("data-field", "role");
    cleanup();
    render(<GoalStatement goal={{ role: "Senior Product Owner", seniority: "Senior" }} />);
    expect(screen.getByText("Senior Product Owner")).toBeInTheDocument();
  });

  it("breaks the line after the industry and after 'before tax.'", () => {
    const { container } = render(<GoalStatement goal={goal} />);
    const html = container.querySelector("p")!.innerHTML;
    expect(html).toMatch(/climate-tech SaaS<\/em>\.<br>/);
    expect(html).toMatch(/before tax\.<br>/);
    expect(container.querySelectorAll("br")).toHaveLength(2);
  });

  it("shows the template's own labels for blanks", () => {
    render(<GoalStatement goal={{}} />);
    const blanks = screen.getAllByText(/^\[.+\]$/);
    expect(blanks.map((b) => b.textContent)).toEqual(TRUE_NORTH_ORDER.map((k) => TRUE_NORTH_PLACEHOLDERS[k]));
    expect(blanks.map((b) => b.textContent)).toEqual([
      "[Target Role + Target Seniority]", "[Target Industry]", "[Target Location]", "[Target Salary]", "[Target Company Type]",
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
      .toEqual({ role: "PO", seniority: "", subsector: "", companyType: "", city: "", salary: "" });
  });
});
