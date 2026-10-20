import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Saving the Setup screen rebuilds the agents' profile.yml. Before the North
// Star could come from intake it always rebuilt it from the Compass goal, and
// setDoc replaces the whole document — so an intake override would have been
// silently reverted by an unrelated save (adding a watchlist company, editing
// notes). These tests pin that it is not.

const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>) => Promise<void>>(async () => {});
let setup: Record<string, unknown> | null = null;

const profile = {
  firstName: "Jane", lastName: "Smith", email: "jane@example.com", country: "New Zealand",
  goal: { role: "Programme Manager", subsector: "govtech", city: "Wellington", salary: "160,000" },
};

vi.mock("firebase/firestore", () => ({ setDoc: (ref: unknown, data: Record<string, unknown>) => setDoc(ref, data) }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" }, isAdmin: false }) }));
vi.mock("@/lib/firestore/db", () => ({
  paths: {
    careerOpsSetup: () => "SETUP",
    profile: () => "PROFILE",
    careerOpsPortalsStatus: () => "PORTALS_STATUS",
  },
  useLiveDoc: (path: string | null) => ({
    data: path === "SETUP" ? setup : path === "PROFILE" ? profile : null,
    loading: false,
  }),
}));
// The sub-forms have their own screens and tests; they are not what this is about.
vi.mock("@/components/agents/Portals", () => ({ default: () => <div data-testid="portals" /> }));
vi.mock("@/components/agents/StandardAnswers", () => ({ default: () => <div data-testid="answers" /> }));
vi.mock("@/components/agents/PortalAccounts", () => ({ default: () => <div data-testid="accounts" /> }));

import Setup from "@/components/agents/Setup";

const INTAKE_SETUP = {
  cvMarkdown: "# Jane Smith\n\n## Experience\nAcme — Product Owner 2021–2025",
  profileYaml: "stale", notes: "", updatedAt: 1,
  portals: { companies: [], positive: [], negative: [] },
  goalSource: "intake",
  intakeGoal: { role: "Senior Product Owner", subsector: "climate-tech", city: "Auckland", salary: "200,000" },
  goalUpdatedAt: 99,
};

async function saveAfterAnEdit() {
  const user = userEvent.setup();
  // The save button only enables once something is dirty — edit the notes.
  await user.type(screen.getByPlaceholderText(/Need visa sponsorship/i), "Remote only.");
  await user.click(screen.getByRole("button", { name: /Save setup/i }));
  await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
  return setDoc.mock.calls[0][1];
}

beforeEach(() => {
  setDoc.mockClear();
  setup = null;
});

describe("Setup screen — an intake North Star survives an unrelated save", () => {
  it("rebuilds profile.yml from the intake goal, not the Compass one", async () => {
    setup = { ...INTAKE_SETUP };
    render(<Setup />);
    const written = await saveAfterAnEdit();
    expect(String(written.profileYaml)).toContain("Senior Product Owner");
    expect(String(written.profileYaml)).toContain("climate-tech");
    expect(String(written.profileYaml)).not.toContain("Programme Manager");
  });

  it("carries the choice and the intake goal through the full-document write", async () => {
    setup = { ...INTAKE_SETUP };
    render(<Setup />);
    const written = await saveAfterAnEdit();
    expect(written.goalSource).toBe("intake");
    expect(written.intakeGoal).toMatchObject({ role: "Senior Product Owner" });
    expect(written.goalUpdatedAt).toBe(99);
  });

  it("tells the member where the goal came from, and how to switch back", async () => {
    setup = { ...INTAKE_SETUP };
    render(<Setup />);
    expect(screen.getByText(/Built from the North Star you set in intake/)).toBeInTheDocument();
    expect(screen.getByText(/It overrides your Compass goal/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /intake/i })).toHaveAttribute("href", "/careerops/intake");
  });
});

describe("Setup screen — Compass stays the default", () => {
  it("uses the Compass goal and writes no source when nothing was chosen", async () => {
    setup = { cvMarkdown: "# Jane", profileYaml: "", notes: "", updatedAt: 1, portals: { companies: [], positive: [], negative: [] } };
    render(<Setup />);
    const written = await saveAfterAnEdit();
    expect(String(written.profileYaml)).toContain("Programme Manager");
    // Absent rather than written as "compass": a member who never chose is untouched.
    expect(written).not.toHaveProperty("goalSource");
    expect(written).not.toHaveProperty("intakeGoal");
  });

  it("offers intake as the way to override, when Compass owns the goal", () => {
    setup = { cvMarkdown: "# Jane", profileYaml: "", notes: "", updatedAt: 1, portals: { companies: [], positive: [], negative: [] } };
    render(<Setup />);
    expect(screen.getByText(/Built from your Compass goal/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /set one in intake/i })).toHaveAttribute("href", "/careerops/intake");
  });

  it("falls back to Compass when intake is chosen but has no job title", async () => {
    setup = { ...INTAKE_SETUP, intakeGoal: { role: "  ", subsector: "climate-tech" } };
    render(<Setup />);
    const written = await saveAfterAnEdit();
    expect(String(written.profileYaml)).toContain("Programme Manager");
    expect(String(written.profileYaml)).not.toContain("climate-tech");
    // The choice is still remembered, so adding a title later revives it.
    expect(written.goalSource).toBe("intake");
  });
});
