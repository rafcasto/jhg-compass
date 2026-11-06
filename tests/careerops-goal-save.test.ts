import { describe, it, expect } from "vitest";
import { goalInEffect, goalWrites } from "@/lib/careerops/goal-save";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// One goal wherever it is edited (decision 2026-11-07): every statement reads
// the goal in effect, every save writes the home in effect, never the other.

const compass: Profile = { email: "a@b.c", goal: { role: "Product Owner", city: "Wellington", salary: "200,000" } };
const intake = { role: "Revenue Operations Manager", seniority: "Senior", subsector: "B2B SaaS", city: "Lyon, France", salary: "EUR 70,000–80,000", companyType: "Scale-up" };
const uploaded = { goalSource: "intake", intakeGoal: intake } as CareerOpsSetupV2;

describe("goalInEffect", () => {
  it("is the uploaded True North while it is in effect, else the Compass goal, always with every key", () => {
    expect(goalInEffect({ setup: uploaded, profile: compass })).toEqual(intake);
    expect(goalInEffect({ setup: null, profile: compass })).toEqual({ role: "Product Owner", seniority: "", subsector: "", companyType: "", city: "Wellington", salary: "200,000" });
    // "intake" chosen but no role there → Compass carries it.
    expect(goalInEffect({ setup: { goalSource: "intake", intakeGoal: { city: "Lyon" } } as CareerOpsSetupV2, profile: compass }).role).toBe("Product Owner");
  });
});

describe("goalWrites", () => {
  it("writes the intake goal on the setup document while the upload is in effect — the Compass goal untouched", () => {
    const w = goalWrites({ setup: uploaded, profile: compass }, { ...intake, role: " Head of Revenue Operations " }, 1700);
    expect(w.setupPatch).toEqual({ goalSource: "intake", intakeGoal: { ...intake, role: "Head of Revenue Operations" }, goalUpdatedAt: 1700 });
    expect(w.profilePatch).toBeNull();
    expect(w.nextProfile).toBe(compass);
  });

  it("writes the Compass goal on the account otherwise, and says what the account will read", () => {
    const w = goalWrites({ setup: null, profile: compass }, { role: "Senior Product Owner", city: "Auckland" }, 1700);
    expect(w.setupPatch).toEqual({});
    expect(w.profilePatch).toEqual({ goal: { role: "Senior Product Owner", seniority: "", subsector: "", companyType: "", city: "Auckland", salary: "" }, goalUpdatedAt: 1700 });
    expect(w.nextProfile?.goal?.role).toBe("Senior Product Owner");
    expect(goalWrites({ setup: null, profile: null }, { role: "PO" }).nextProfile).toEqual({ email: "", goal: expect.objectContaining({ role: "PO" }) });
  });
});
