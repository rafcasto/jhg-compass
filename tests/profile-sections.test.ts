import { describe, it, expect } from "vitest";
import { ACTIVE_SECTIONS, PROFILE_SECTIONS, parseSection, profileProgress, sectionSummaries } from "@/lib/profile-sections";
import { WIZARD_STEPS } from "@/lib/careerops/intake-wizard";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

const profile = { email: "ana@example.com", goal: { role: "Delivery Lead", city: "Wellington", salary: "NZ$ 150,000" } } as Profile;

describe("profile sections — the registry", () => {
  it("renders six sections, in the wizard's order, and hides the reserved three", () => {
    expect(ACTIVE_SECTIONS.map((s) => s.key)).toEqual(["northstar", "contact", "targeting", "watchlist", "notes", "cv"]);
    expect(PROFILE_SECTIONS.filter((s) => !s.available).map((s) => s.key)).toEqual(["culture", "proof", "stories"]);
    // Same words as the wizard for the sections both have.
    const wizard = Object.fromEntries(WIZARD_STEPS.map((s) => [s.key, s.label]));
    for (const s of ACTIVE_SECTIONS) if (wizard[s.key]) expect(s.label.startsWith(wizard[s.key].split(" ")[0])).toBe(true);
  });

  it("parses ?section=, and sends unknown, reserved or absent to the overview", () => {
    expect(parseSection("targeting")).toBe("targeting");
    expect(parseSection("culture")).toBeNull();
    expect(parseSection("nope")).toBeNull();
    expect(parseSection(null)).toBeNull();
  });
});

describe("profile sections — what each row says", () => {
  it("says Not set everywhere for a new member", () => {
    const rows = sectionSummaries({ setup: null, profile: null });
    expect(rows.map((r) => r.summary)).toEqual(["Not set", "Not set", "Not set", "Not set", "Not set", "Not set"]);
    expect(rows.every((r) => r.state === "empty")).toBe(true);
    expect(profileProgress(rows)).toEqual({ done: 0, total: 6, pct: 0 });
  });

  it("quotes the Compass goal when the setup has none", () => {
    const [ns] = sectionSummaries({ setup: null, profile });
    expect(ns.state).toBe("done");
    expect(ns.summary).toBe("Delivery Lead · Wellington · NZ$ 150,000");
    expect(ns.count).toBe("Compass");
  });

  it("quotes the data for a filled profile", () => {
    const setup = {
      cvMarkdown: "# CV\n\n## Experience\n2019 – 2024 Acme " + "word ".repeat(100),
      profileYaml: "", updatedAt: 1,
      goalSource: "intake", intakeGoal: { role: "Senior Delivery Lead", city: "Wellington", salary: "NZ$ 150,000–175,000" },
      contact: { phone: "+64 21 555 0199", linkedin: "in/ana", title: "Delivery Lead", portfolio: "https://ana.nz" },
      policy: { minimumSalary: "NZ$ 140,000", authorizedIn: ["New Zealand", "Australia"] },
      personalization: {
        targetRoles: [{ archetype: "Delivery Lead" }, { archetype: "TPM" }],
        exitNarrative: "Story.", portfolio: { url: "https://ana.nz" }, compTargets: "x", locationPolicy: ["Will work in: Wellington"],
      },
      portals: { companies: [{ name: "Xero", careersUrl: "https://x" }, { name: "Tracksuit", careersUrl: "https://t" }, { name: "Dovetail", careersUrl: "https://d" }, { name: "Halter", careersUrl: "https://h" }], positive: ["Delivery Lead"], negative: [] },
      notes: "Hard no's: on-site 5 days\nNotice period: 28 days",
    } as CareerOpsSetupV2;
    const rows = Object.fromEntries(sectionSummaries({ setup, profile }).map((r) => [r.key, r]));
    expect(rows.northstar.summary).toBe("Senior Delivery Lead · Wellington · NZ$ 150,000–175,000");
    expect(rows.northstar.count).toBe("profile");
    expect(rows.contact.summary).toBe("+64 21 555 0199 · LinkedIn · floor NZ$ 140,000 · New Zealand / Australia");
    expect(rows.contact.state).toBe("done");
    expect(rows.targeting.count).toBe("5/8");
    expect(rows.targeting.summary).toBe("2 roles · exit narrative · portfolio / demo +2");
    expect(rows.targeting.state).toBe("partial");
    expect(rows.watchlist.summary).toBe("Xero, Tracksuit, Dovetail…");
    expect(rows.watchlist.count).toBe("4");
    expect(rows.notes.summary).toBe("Hard no's: on-site 5 days");
    expect(rows.notes.state).toBe("done");
    expect(rows.cv.summary).toMatch(/^\d+ words · Ready to score$/);
    expect(profileProgress(Object.values(rows))).toEqual({ done: 5, total: 6, pct: 83 });
  });
});
