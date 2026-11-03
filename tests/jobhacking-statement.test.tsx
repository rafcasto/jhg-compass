import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrueNorthStatement from "@/components/jobhacking/TrueNorthStatement";

const goal = { role: "Customer Success Manager", seniority: "Senior", subsector: "HR tech SaaS", companyType: "Scale-up", city: "Melbourne, Australia", salary: "AUD 140,000–165,000" };

describe("TrueNorthStatement", () => {
  it("renders every blank as a link to the section that fills it", () => {
    render(<TrueNorthStatement goal={goal} />);
    const text = screen.getByTestId("true-north-statement").textContent!;
    expect(text).toContain("In 60 days, I'm working as Senior Customer Success Manager, in HR tech SaaS.");
    expect(text).toContain("I'm based in Melbourne, Australia and I'm making AUD 140,000–165,000 yearly before tax.");
    expect(text).toContain("I enjoy working for Scale-up.");
    expect(screen.getByRole("link", { name: "Senior Customer Success Manager" })).toHaveAttribute("href", "/jobhacking/true-north?section=roles");
    expect(screen.getByRole("link", { name: "AUD 140,000–165,000" })).toHaveAttribute("href", "/jobhacking/true-north?section=salary");
    expect(screen.getByRole("link", { name: "Scale-up" })).toHaveAttribute("href", "/jobhacking/true-north?section=company-type");
    expect(screen.getByRole("link", { name: "Melbourne, Australia" })).toHaveAttribute("href", "/jobhacking/true-north?section=location");
  });

  it("shows dimmed template labels for blanks", () => {
    render(<TrueNorthStatement goal={{}} />);
    const blanks = screen.getAllByText(/^\[.+\]$/);
    expect(blanks.map((b) => b.textContent)).toEqual(["[Target Role + Target Seniority]", "[Target Industry]", "[Target Location]", "[Target Salary]", "[Target Company Type]"]);
    blanks.forEach((b) => expect(b).toHaveAttribute("data-empty", "true"));
  });
});
