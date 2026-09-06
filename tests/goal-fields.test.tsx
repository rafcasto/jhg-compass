import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GoalFields, { GOAL_LABELS } from "@/components/compass/GoalFields";
import { EMPTY_GOAL, GOAL_KEYS } from "@/lib/goal";

// The Compass tab and onboarding must render the identical form. This pins the
// agreed order and labels for both variants so they can't drift again.
const EXPECTED_ORDER = [
  "Seniority level + Job title",
  "Industry",
  "Company type",
  "Geography (country, region, city, area)",
  "Salary range (compensation)",
];

describe("GoalFields", () => {
  it("GOAL_KEYS and GOAL_LABELS agree with the agreed field order", () => {
    expect(GOAL_KEYS.map((k) => GOAL_LABELS[k])).toEqual(EXPECTED_ORDER);
  });

  for (const variant of ["compass", "onboarding"] as const) {
    it(`renders fields in order for the ${variant} variant`, () => {
      const { container } = render(<GoalFields value={EMPTY_GOAL} onChange={vi.fn()} variant={variant} idPrefix={variant} />);
      const labels = Array.from(container.querySelectorAll("label")).map((l) => l.textContent);
      expect(labels).toEqual(EXPECTED_ORDER);
      const cls = variant === "compass" ? "cfield" : "field";
      expect(container.querySelectorAll(`input.${cls}, select.${cls}`)).toHaveLength(5);
    });
  }

  it("reports edits through onChange with the rest of the goal intact", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalFields value={{ ...EMPTY_GOAL, role: "PO" }} onChange={onChange} />);
    await user.type(screen.getByLabelText("Industry"), "x");
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_GOAL, role: "PO", subsector: "x" });
    await user.selectOptions(screen.getByLabelText("Company type"), "Government");
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_GOAL, role: "PO", companyType: "Government" });
  });
});
