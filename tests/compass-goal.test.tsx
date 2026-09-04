import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompassGoal from "@/components/compass/CompassGoal";

const saved = { role: "Product Owner", salary: "200,000", city: "Wellington", subsector: "fintech", companyType: "an SME" };
const FIELD_LABELS = ["Job title + seniority level", "Yearly salary before tax", "City", "Thriving industry subsector", "Company type"];

describe("CompassGoal", () => {
  it("read mode: shows the statement, the Edit button, and no inputs", () => {
    render(<CompassGoal goal={saved} onSave={vi.fn()} />);
    expect(screen.getByText("Product Owner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByText("Complete your objective")).not.toBeInTheDocument();
    for (const l of FIELD_LABELS) expect(screen.queryByLabelText(l)).not.toBeInTheDocument();
  });

  it("edit mode: renders all five fields seeded from the saved goal and hides Edit", async () => {
    const user = userEvent.setup();
    render(<CompassGoal goal={saved} onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.getByText("Complete your objective")).toBeInTheDocument();
    expect(screen.getByLabelText("Job title + seniority level")).toHaveValue("Product Owner");
    expect(screen.getByLabelText("Yearly salary before tax")).toHaveValue("200,000");
    expect(screen.getByLabelText("City")).toHaveValue("Wellington");
    expect(screen.getByLabelText("Thriving industry subsector")).toHaveValue("fintech");
    expect(screen.getByLabelText("Company type")).toHaveValue("an SME");
    // article-prefixed options read inline in the sentence
    const opts = within(screen.getByLabelText("Company type")).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual(["Select…", "a startup", "an SME", "a scale-up", "a large enterprise"]);
  });

  it("statement updates live while typing", async () => {
    const user = userEvent.setup();
    render(<CompassGoal goal={saved} onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const role = screen.getByLabelText("Job title + seniority level");
    await user.clear(role);
    await user.type(role, "Head of Product");
    expect(screen.getByTestId("goal-statement")).toHaveTextContent("working as Head of Product");
    await user.selectOptions(screen.getByLabelText("Company type"), "a startup");
    expect(screen.getByTestId("goal-statement")).toHaveTextContent("working for a startup");
  });

  it("Cancel discards the draft and returns to read mode", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CompassGoal goal={saved} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const city = screen.getByLabelText("City");
    await user.clear(city);
    await user.type(city, "Auckland");
    expect(screen.getByTestId("goal-statement")).toHaveTextContent("based in Auckland");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByTestId("goal-statement")).toHaveTextContent("based in Wellington");
    expect(screen.getByTestId("goal-statement")).not.toHaveTextContent("Auckland");

    // re-opening starts from the saved goal, not the abandoned draft
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText("City")).toHaveValue("Wellington");
  });

  it("Save objective hands the trimmed draft to onSave and leaves edit mode", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CompassGoal goal={saved} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const salary = screen.getByLabelText("Yearly salary before tax");
    await user.clear(salary);
    await user.type(salary, " 250,000 ");
    await user.click(screen.getByRole("button", { name: "Save objective" }));

    expect(onSave).toHaveBeenCalledWith({ ...saved, salary: "250,000" });
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });
});
