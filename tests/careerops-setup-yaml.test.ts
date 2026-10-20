import { describe, it, expect } from "vitest";
import { buildSetupProfileYaml, preserveSetupFields, resolveSetupFields } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// The single place that turns the setup document into profile.yml. It exists
// because four screens rebuild that file, and each one assembling the arguments
// itself produced two real bugs: the Setup screen reverted an intake North Star,
// and nothing ever passed the contact fields the Pi worker reads.

const profile = {
  firstName: "Jane", lastName: "Smith", email: "jane@example.com", country: "New Zealand",
  goal: { role: "Programme Manager", subsector: "govtech", city: "Wellington", salary: "160,000" },
} as unknown as Profile;

const setup = {
  cvMarkdown: "# Jane", profileYaml: "stale", notes: "Avoid agencies.", updatedAt: 1,
  goalSource: "intake",
  intakeGoal: { role: "Senior Product Owner", subsector: "climate-tech", city: "Auckland", salary: "200,000" },
  contact: { phone: "+64 21 000 0000", linkedin: "linkedin.com/in/janesmith" },
  policy: { minimumSalary: "180,000", authorizedIn: ["New Zealand"] },
} as CareerOpsSetupV2;

describe("resolveSetupFields", () => {
  it("reads straight from the document when nothing is being edited", () => {
    expect(resolveSetupFields({ setup })).toEqual({
      goalSource: "intake",
      intakeGoal: setup.intakeGoal,
      contact: setup.contact,
      policy: setup.policy,
      notes: "Avoid agencies.",
    });
  });

  it("lets a pending edit win over what is saved", () => {
    const f = resolveSetupFields({ setup, overrides: { notes: "Remote only." } });
    expect(f.notes).toBe("Remote only.");
    expect(f.contact).toEqual(setup.contact); // untouched keys still come from the doc
  });

  it("treats an explicit undefined as a clear, not as 'no change'", () => {
    // `"contact" in overrides` is the test, so a screen can deliberately wipe a
    // field rather than being unable to express it.
    const f = resolveSetupFields({ setup, overrides: { contact: undefined } });
    expect(f.contact).toBeUndefined();
    expect(f.policy).toEqual(setup.policy);
  });

  it("survives a member who has no setup document yet", () => {
    expect(resolveSetupFields({ setup: null })).toEqual({
      goalSource: undefined, intakeGoal: undefined, contact: undefined, policy: undefined, notes: undefined,
    });
  });
});

describe("buildSetupProfileYaml", () => {
  it("assembles the goal, the contact fields and the policy in one pass", () => {
    const y = buildSetupProfileYaml({ profile, setup });
    // the intake North Star overrides Compass
    expect(y).toContain('- "Senior Product Owner"');
    expect(y).not.toContain("Programme Manager");
    // the fields the worker reads
    expect(y).toContain('phone: "+64 21 000 0000"');
    expect(y).toContain('linkedin: "linkedin.com/in/janesmith"');
    expect(y).toContain('minimum: "180,000"');
    expect(y).toContain("notes: |");
  });

  it("honours the Compass goal when that is the chosen source", () => {
    const y = buildSetupProfileYaml({ profile, setup: { ...setup, goalSource: "compass" } });
    expect(y).toContain('- "Programme Manager"');
    expect(y).not.toContain("Senior Product Owner");
    // …and still keeps the contact fields, which are independent of the goal
    expect(y).toContain('phone: "+64 21 000 0000"');
  });

  it("previews a pending edit without it being saved first", () => {
    const y = buildSetupProfileYaml({ profile, setup, overrides: { policy: { minimumSalary: "250,000" } } });
    expect(y).toContain('minimum: "250,000"');
    expect(y).not.toContain('minimum: "180,000"');
  });

  it("falls back to the Compass goal when an intake override has no role", () => {
    const y = buildSetupProfileYaml({ profile, setup: { ...setup, intakeGoal: { role: " " } } });
    expect(y).toContain('- "Programme Manager"');
  });

  it("produces a usable file for a brand-new member", () => {
    const y = buildSetupProfileYaml({ profile, setup: null });
    expect(y).toContain('full_name: "Jane Smith"');
    expect(y).toContain('- "Programme Manager"');
    expect(y).not.toContain("notes:");
  });
});

describe("preserveSetupFields", () => {
  it("hands back everything a whole-document write must carry", () => {
    expect(preserveSetupFields(setup)).toEqual({
      goalSource: "intake",
      intakeGoal: setup.intakeGoal,
      contact: setup.contact,
      policy: setup.policy,
    });
  });

  it("omits what was never set — Firestore rejects undefined values", () => {
    expect(preserveSetupFields({ cvMarkdown: "x", profileYaml: "", updatedAt: 1 } as CareerOpsSetupV2)).toEqual({});
    expect(preserveSetupFields(null)).toEqual({});
    for (const v of Object.values(preserveSetupFields(setup))) expect(v).not.toBeUndefined();
  });

  it("does not carry notes — the Setup screen owns that field and writes it itself", () => {
    expect(preserveSetupFields(setup)).not.toHaveProperty("notes");
  });
});
