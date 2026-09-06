import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompassGoal from "@/components/compass/CompassGoal";
import { GOAL_LABELS } from "@/components/compass/GoalFields";

const saved = { role: "Product Owner", subsector: "fintech", companyType: "Small Business", city: "Wellington", salary: "200,000" };
const FIELD_LABELS = Object.values(GOAL_LABELS);

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
    expect(screen.getByLabelText("Seniority level + Job title")).toHaveValue("Product Owner");
    expect(screen.getByLabelText("Industry")).toHaveValue("fintech");
    expect(screen.getByLabelText("Company type")).toHaveValue("Small Business");
    expect(screen.getByLabelText("Geography (country, region, city, area)")).toHaveValue("Wellington");
    expect(screen.getByLabelText("Salary range (compensation)")).toHaveValue("200,000");
    const opts = within(screen.getByLabelText("Company type")).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual([
      "Select…",
      "Multinational Company (MNC)",
      "Family Business",
      "Scaleup (established)",
      "Startup (early stage)",
      "Small Business",
      "Government",
      "Not-For-Profit Organisation (NPO)",
    ]);
  });

  it("statement updates live while typing", async () => {
    const user = userEvent.setup();
    render(<CompassGoal goal={saved} onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const role = screen.getByLabelText("Seniority level + Job title");
    await user.clear(role);
    await user.type(role, "Head of Product");
    expect(screen.getByTestId("goal-statement")).toHaveTextContent("working as Head of Product");
    await user.selectOptions(screen.getByLabelText("Company type"), "Startup (early stage)");
    expect(screen.getByTestId("goal-statement")).toHaveTextContent("working for a Startup (early stage)");
  });

  it("Cancel discards the draft and returns to read mode", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CompassGoal goal={saved} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const city = screen.getByLabelText("Geography (country, region, city, area)");
    await user.clear(city);
    await user.type(city, "Auckland");
    expect(screen.getByTestId("goal-statement")).toHaveTextContent("based in Auckland");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByTestId("goal-statement")).toHaveTextContent("based in Wellington");
    expect(screen.getByTestId("goal-statement")).not.toHaveTextContent("Auckland");

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText("Geography (country, region, city, area)")).toHaveValue("Wellington");
  });

  it("Save objective hands the trimmed draft to onSave and leaves edit mode", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CompassGoal goal={saved} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const salary = screen.getByLabelText("Salary range (compensation)");
    await user.clear(salary);
    await user.type(salary, " 180,000 – 220,000 ");
    await user.click(screen.getByRole("button", { name: "Save objective" }));

    expect(onSave).toHaveBeenCalledWith({ ...saved, salary: "180,000 – 220,000" });
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });
});
