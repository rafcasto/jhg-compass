import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>, opts?: unknown) => Promise<void>>(async () => {});
vi.mock("firebase/firestore", () => ({
  setDoc: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => setDoc(ref, data, opts),
}));
vi.mock("@/lib/firestore/db", () => ({ paths: { careerOpsSetup: (uid: string) => `users/${uid}/careerOps/setup` } }));

import ContactPolicy from "@/components/careerops/ContactPolicy";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

const profile = {
  firstName: "Jane", lastName: "Smith", email: "jane@example.com", country: "New Zealand",
  goal: { role: "Senior Product Owner", city: "Auckland", salary: "200,000" },
} as unknown as Profile;
const base = { cvMarkdown: "# Jane", profileYaml: "", notes: "", updatedAt: 1 } as CareerOpsSetupV2;

const save = () => screen.getByRole("button", { name: /Save details/i });

beforeEach(() => setDoc.mockClear());

describe("ContactPolicy — the fields the worker already reads", () => {
  it("saves nothing until something is edited", () => {
    render(<ContactPolicy uid="u1" setup={base} profile={profile} />);
    expect(save()).toBeDisabled();
  });

  it("writes the contact fields and puts them in profile.yml under career-ops' names", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/Professional headline/i), "Product leader, climate");
    await user.type(screen.getByLabelText(/^Phone$/i), "+64 21 000 0000");
    await user.type(screen.getByLabelText(/LinkedIn/i), "linkedin.com/in/janesmith");
    await user.type(screen.getByLabelText(/Portfolio/i), "https://jane.dev");
    await user.type(screen.getByLabelText(/GitHub/i), "github.com/janesmith");
    await user.click(save());

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data, opts] = setDoc.mock.calls[0];
    expect(data.contact).toEqual({
      title: "Product leader, climate", phone: "+64 21 000 0000",
      linkedin: "linkedin.com/in/janesmith", portfolio: "https://jane.dev", github: "github.com/janesmith",
    });
    const yaml = String(data.profileYaml);
    expect(yaml).toContain('phone: "+64 21 000 0000"');
    expect(yaml).toContain('portfolio_url: "https://jane.dev"');
    expect(yaml).toContain('github: "github.com/janesmith"');
    // merge, so the CV and watchlist on the same document survive
    expect(opts).toEqual({ merge: true });
    expect(await screen.findByRole("status")).toHaveTextContent(/next generated CV, cover letter and form fill/i);
  });

  it("drops blank fields instead of writing empty strings", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/^Phone$/i), "  +64 21 000 0000  ");
    await user.click(save());
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(setDoc.mock.calls[0][1].contact).toEqual({ phone: "+64 21 000 0000" });
  });
});

describe("ContactPolicy — compensation and work authorization", () => {
  it("captures the walk-away number that used to be hardcoded empty", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/Walk-away salary/i), "180,000");
    await user.click(save());
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const [, data] = setDoc.mock.calls[0];
    expect((data.policy as Record<string, unknown>).minimumSalary).toBe("180,000");
    expect(String(data.profileYaml)).toContain('minimum: "180,000"');
  });

  it("splits the authorisation list on commas and trims it", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/Already authorised to work in/i), " New Zealand , Australia ,, ");
    await user.click(save());
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect((setDoc.mock.calls[0][1].policy as Record<string, unknown>).authorizedIn).toEqual(["New Zealand", "Australia"]);
  });

  it("writes needs_sponsorship only when the box is actually ticked", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/Visa \/ right to work/i), "NZ citizen");
    await user.click(save());
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(setDoc.mock.calls[0][1].policy).not.toHaveProperty("needsSponsorship");
    expect(String(setDoc.mock.calls[0][1].profileYaml)).not.toContain("needs_sponsorship");

    setDoc.mockClear();
    await user.click(screen.getByRole("checkbox", { name: /need visa sponsorship/i }));
    await user.click(save());
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect((setDoc.mock.calls[0][1].policy as Record<string, unknown>).needsSponsorship).toBe(true);
    expect(String(setDoc.mock.calls[0][1].profileYaml)).toContain("needs_sponsorship: true");
  });
});

describe("ContactPolicy — existing values", () => {
  it("loads what is already saved, including the comma list", () => {
    render(<ContactPolicy uid="u1" setup={{ ...base, contact: { phone: "+64 21 111 1111" }, policy: { authorizedIn: ["New Zealand", "Australia"], needsSponsorship: true } }} profile={profile} />);
    expect(screen.getByLabelText(/^Phone$/i)).toHaveValue("+64 21 111 1111");
    expect(screen.getByLabelText(/Already authorised to work in/i)).toHaveValue("New Zealand, Australia");
    expect(screen.getByRole("checkbox", { name: /need visa sponsorship/i })).toBeChecked();
  });

  it("says so rather than claiming success when the write fails", async () => {
    const user = userEvent.setup();
    setDoc.mockRejectedValueOnce(new Error("offline"));
    render(<ContactPolicy uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/^Phone$/i), "+64 21 000 0000");
    await user.click(save());
    expect(await screen.findByRole("status")).toHaveTextContent(/Couldn't save that/i);
  });
});
