import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GoalStatement from "@/components/compass/GoalStatement";
import { goalFromLegacy, normalizeGoal } from "@/lib/goal";

const goal = { role: "Senior Product Owner", salary: "250,000", city: "Auckland", subsector: "climate-tech SaaS", companyType: "a scale-up" };

describe("GoalStatement", () => {
  it("renders every field as an italic value", () => {
    render(<GoalStatement goal={goal} />);
    for (const [k, v] of Object.entries(goal)) {
      const el = screen.getByText(v);
      expect(el.tagName).toBe("EM");
      expect(el).toHaveAttribute("data-field", k);
      expect(el).not.toHaveAttribute("data-empty");
    }
    const text = screen.getByTestId("goal-statement").textContent!;
    expect(text).toContain("In 60 days from now, I'm working as Senior Product Owner, making $250,000 yearly before tax.");
    expect(text).toContain("I'm based in Auckland and specialise in thriving industry climate-tech SaaS.");
    expect(text).toContain("I enjoy working for a scale-up, with flexible working arrangements.");
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
    const blanks = screen.getAllByText(/^\[.+\]$/);
    expect(blanks).toHaveLength(5);
    blanks.forEach((b) => expect(b).toHaveAttribute("data-empty", "true"));
  });
});

describe("goal helpers", () => {
  it("maps the legacy onboarding compass onto the new goal", () => {
    expect(goalFromLegacy({ jobTitle: "PO", industry: "Retail", geography: "Auckland", companyType: "large", targetSalary: "250,000" }))
      .toEqual({ role: "PO", salary: "250,000", city: "Auckland", subsector: "Retail", companyType: "a large enterprise" });
  });
  it("trims on normalise", () => {
    expect(normalizeGoal({ role: "  PO ", salary: "", city: undefined })).toEqual({ role: "PO", salary: "", city: "", subsector: "", companyType: "" });
  });
});
