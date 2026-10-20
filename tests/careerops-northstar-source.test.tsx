import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>, opts?: unknown) => Promise<void>>(async () => {});

vi.mock("firebase/firestore", () => ({
  setDoc: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => setDoc(ref, data, opts),
}));
vi.mock("@/lib/firestore/db", () => ({
  paths: { careerOpsSetup: (uid: string) => `users/${uid}/careerOps/setup` },
}));

import NorthStarSource from "@/components/careerops/NorthStarSource";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

const profile = { firstName: "Jane", lastName: "Smith", email: "jane@example.com", country: "New Zealand", goal: { role: "Programme Manager", subsector: "govtech", city: "Wellington", salary: "160,000" } } as unknown as Profile;
const setupWith = (over: Partial<CareerOpsSetupV2> = {}): CareerOpsSetupV2 =>
  ({ cvMarkdown: "# Jane", profileYaml: "", notes: "", updatedAt: 1, ...over }) as CareerOpsSetupV2;

const compassRadio = () => screen.getByRole("radio", { name: /Use my Compass North Star/i });
const intakeRadio = () => screen.getByRole("radio", { name: /Set it here in intake/i });
const saveBtn = () => screen.getByRole("button", { name: /Save North Star/i });

beforeEach(() => setDoc.mockClear());

describe("NorthStarSource — choosing the process", () => {
  it("starts on Compass for a member who has never chosen", () => {
    render(<NorthStarSource uid="u1" setup={setupWith()} profile={profile} />);
    expect(compassRadio()).toBeChecked();
    expect(intakeRadio()).not.toBeChecked();
    // Compass picked → no goal form, just a pointer at where it lives.
    expect(screen.queryByLabelText(/Seniority level \+ Job title/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compass tab/i })).toHaveAttribute("href", "/compass");
  });

  it("shows what the agents are getting right now", () => {
    render(<NorthStarSource uid="u1" setup={setupWith()} profile={profile} />);
    expect(screen.getByText(/your Compass North Star — Programme Manager · govtech · Wellington · 160,000/)).toBeInTheDocument();
  });

  it("reveals the same five North Star fields as the Compass tab when intake is picked", async () => {
    const user = userEvent.setup();
    render(<NorthStarSource uid="u1" setup={setupWith()} profile={profile} />);
    await user.click(intakeRadio());
    for (const label of [/Seniority level \+ Job title/i, /^Industry$/i, /Company type/i, /Geography/i, /Salary range/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("saves nothing until something actually changes", () => {
    render(<NorthStarSource uid="u1" setup={setupWith()} profile={profile} />);
    expect(saveBtn()).toBeDisabled();
  });
});

describe("NorthStarSource — the override", () => {
  it("writes the intake goal and rebuilds profile.yml from it", async () => {
    const user = userEvent.setup();
    render(<NorthStarSource uid="u1" setup={setupWith()} profile={profile} />);
    await user.click(intakeRadio());
    await user.type(screen.getByLabelText(/Seniority level \+ Job title/i), "Senior Product Owner");
    await user.type(screen.getByLabelText(/^Industry$/i), "climate-tech");
    await user.click(saveBtn());

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data, opts] = setDoc.mock.calls[0];
    expect(data.goalSource).toBe("intake");
    expect(data.intakeGoal).toMatchObject({ role: "Senior Product Owner", subsector: "climate-tech" });
    // The override is only real if the agents' profile.yml follows it.
    expect(String(data.profileYaml)).toContain("Senior Product Owner");
    expect(String(data.profileYaml)).toContain("climate-tech");
    expect(String(data.profileYaml)).not.toContain("Programme Manager");
    // merge, so the CV / portals on the same document survive.
    expect(opts).toEqual({ merge: true });
    expect(await screen.findByRole("status")).toHaveTextContent(/agents now use the North Star you set here/i);
  });

  it("switches back to Compass without destroying the intake goal", async () => {
    const user = userEvent.setup();
    const saved = setupWith({ goalSource: "intake", intakeGoal: { role: "Senior Product Owner", subsector: "climate-tech" } });
    render(<NorthStarSource uid="u1" setup={saved} profile={profile} />);
    expect(intakeRadio()).toBeChecked();
    expect(screen.getByText(/your intake North Star — Senior Product Owner · climate-tech/)).toBeInTheDocument();

    await user.click(compassRadio());
    await user.click(saveBtn());
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data] = setDoc.mock.calls[0];
    expect(data.goalSource).toBe("compass");
    // Kept on the document, so flipping back costs nothing.
    expect(data.intakeGoal).toMatchObject({ role: "Senior Product Owner" });
    expect(String(data.profileYaml)).toContain("Programme Manager");
  });

  it("warns up front that an override with no job title cannot take effect", async () => {
    const user = userEvent.setup();
    render(<NorthStarSource uid="u1" setup={setupWith()} profile={profile} />);
    await user.click(intakeRadio());
    expect(screen.getByText(/Without a job title the override can't take effect/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Seniority level \+ Job title/i), "PO");
    expect(screen.queryByText(/Without a job title the override can't take effect/i)).not.toBeInTheDocument();
  });

  it("falls back to Compass, loudly, when intake was chosen but left blank", async () => {
    const user = userEvent.setup();
    render(<NorthStarSource uid="u1" setup={setupWith({ goalSource: "intake", intakeGoal: { role: "" } })} profile={profile} />);
    // The standing banner tells them the override is not live.
    expect(screen.getByText(/using your Compass goal until you add one/i)).toBeInTheDocument();
    expect(screen.getByText(/your Compass North Star — Programme Manager/)).toBeInTheDocument();

    await user.click(compassRadio());
    await user.click(saveBtn());
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(String(setDoc.mock.calls[0][1].profileYaml)).toContain("Programme Manager");
  });

  it("says so rather than claiming success when the write fails", async () => {
    const user = userEvent.setup();
    setDoc.mockRejectedValueOnce(new Error("offline"));
    render(<NorthStarSource uid="u1" setup={setupWith()} profile={profile} />);
    await user.click(intakeRadio());
    await user.type(screen.getByLabelText(/Seniority level \+ Job title/i), "PO");
    await user.click(saveBtn());
    expect(await screen.findByRole("status")).toHaveTextContent(/Couldn't save that/i);
  });
});
