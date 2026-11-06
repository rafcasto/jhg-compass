import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>, opts?: unknown) => Promise<void>>(async () => {});
vi.mock("firebase/firestore", () => ({
  setDoc: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => setDoc(ref, data, opts),
}));
vi.mock("@/lib/firestore/db", () => ({ paths: { careerOpsSetup: (uid: string) => `users/${uid}/careerOps/setup`, profile: (uid: string) => `users/${uid}` } }));

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

  it("shows the account's email, else the one signed in with — never an empty email field", () => {
    const { unmount } = render(<ContactPolicy uid="u1" setup={base} profile={profile} part="contact" signInEmail="signed-in@example.com" />);
    expect(screen.getByDisplayValue("jane@example.com")).toHaveAttribute("readonly");
    unmount();
    render(<ContactPolicy uid="u1" setup={base} profile={{ ...profile, email: "" }} part="contact" signInEmail="signed-in@example.com" />);
    expect(screen.getByDisplayValue("signed-in@example.com")).toHaveAttribute("readonly");
  });

  it("writes the contact fields and puts them in profile.yml under career-ops' names", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/^Headline/i), "Product leader, climate");
    await user.type(screen.getByLabelText(/^Phone$/i), "+64 21 000 0000");
    await user.type(screen.getByLabelText(/LinkedIn/i), "linkedin.com/in/janesmith");
    await user.type(screen.getByPlaceholderText("Wellington, New Zealand"), "Auckland, New Zealand");
    await user.type(screen.getByLabelText(/Portfolio/i), "https://jane.dev");
    await user.click(save());

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data, opts] = setDoc.mock.calls[0];
    expect(data.contact).toEqual({
      title: "Product leader, climate", phone: "+64 21 000 0000",
      linkedin: "linkedin.com/in/janesmith", location: "Auckland, New Zealand", portfolio: "https://jane.dev",
    });
    const yaml = String(data.profileYaml);
    expect(yaml).toContain('full_name: "Jane Smith"');
    expect(yaml).toContain('email: "jane@example.com"');
    expect(yaml).toContain('phone: "+64 21 000 0000"');
    expect(yaml).toContain('location: "Auckland, New Zealand"');
    expect(yaml).toContain('portfolio_url: "https://jane.dev"');
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

describe("ContactPolicy — `part` shows one slice and saves only that slice", () => {
  const stored = { ...base, contact: { phone: "+64 21 000 0000", title: "Product leader", github: "github.com/jane" }, policy: { minimumSalary: "160,000", authorizedIn: ["New Zealand"] } } as CareerOpsSetupV2;

  it("contact: name · phone · email · LinkedIn · location · portfolio — no headline, no policy", () => {
    render(<ContactPolicy uid="u1" setup={stored} profile={profile} part="contact" />);
    expect(screen.getByLabelText(/First name/i)).toHaveValue("Jane");
    expect(screen.getByLabelText(/Last name/i)).toHaveValue("Smith");
    expect(screen.getByLabelText(/^Email/i)).toHaveValue("jane@example.com");
    expect(screen.getByLabelText(/^Email/i)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/^Phone$/i)).toHaveValue("+64 21 000 0000");
    expect(screen.getByLabelText(/LinkedIn URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Portfolio URL/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Headline/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/GitHub/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Walk-away salary/i)).not.toBeInTheDocument();
  });

  it("contact: a save keeps the headline and GitHub it does not show, and leaves policy out of the write", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={stored} profile={profile} part="contact" />);
    await user.type(screen.getByLabelText(/LinkedIn/i), "in/jane");
    await user.click(screen.getByRole("button", { name: /Save contact details/i }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data] = setDoc.mock.calls[0];
    expect(data.contact).toEqual({ phone: "+64 21 000 0000", title: "Product leader", github: "github.com/jane", linkedin: "in/jane" });
    expect(data).not.toHaveProperty("policy");
    // profile.yml is rebuilt from the stored policy + the new contact.
    expect(String(data.profileYaml)).toContain('minimum: "160,000"');
    expect(String(data.profileYaml)).toContain('linkedin: "in/jane"');
  });

  it("policy: no contact fields, and a save leaves contact out of the write", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={stored} profile={profile} part="policy" />);
    expect(screen.queryByLabelText(/^Phone$/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Visa \/ right to work/i), "NZ citizen");
    await user.click(screen.getByRole("button", { name: /Save logistics/i }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data] = setDoc.mock.calls[0];
    expect(data.policy).toEqual({ minimumSalary: "160,000", visaStatus: "NZ citizen", authorizedIn: ["New Zealand"] });
    expect(data).not.toHaveProperty("contact");
    expect(String(data.profileYaml)).toContain('phone: "+64 21 000 0000"');
  });

  it("contact: the name is written to the account document, after the setup, and profile.yml already carries it", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={stored} profile={profile} part="contact" />);
    await user.clear(screen.getByLabelText(/Last name/i));
    await user.type(screen.getByLabelText(/Last name/i), "Smith-Reyes");
    await user.click(screen.getByRole("button", { name: /Save contact details/i }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(2));
    const [setupRef, setupData] = setDoc.mock.calls[0];
    const [profileRef, profileData, opts] = setDoc.mock.calls[1];
    expect(setupRef).toBe("users/u1/careerOps/setup");
    expect(String(setupData.profileYaml)).toContain('full_name: "Jane Smith-Reyes"');
    expect(profileRef).toBe("users/u1");
    expect(profileData).toEqual({ firstName: "Jane", lastName: "Smith-Reyes" });
    expect(opts).toEqual({ merge: true });
  });

  it("contact: an unchanged name is not rewritten", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={stored} profile={profile} part="contact" />);
    await user.type(screen.getByLabelText(/Location/i), "Auckland");
    await user.click(screen.getByRole("button", { name: /Save contact details/i }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(setDoc.mock.calls[0][0]).toBe("users/u1/careerOps/setup");
  });

  it("headline: one field, saved over the stored contact without touching the rest", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={stored} profile={profile} part="headline" />);
    expect(screen.getByLabelText(/^Headline/i)).toHaveValue("Product leader");
    expect(screen.queryByLabelText(/^Phone$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/First name/i)).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^Headline/i));
    await user.type(screen.getByLabelText(/^Headline/i), "Product leader for climate-tech scale-ups");
    await user.click(screen.getByRole("button", { name: /Save headline/i }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data] = setDoc.mock.calls[0];
    expect(data.contact).toEqual({ phone: "+64 21 000 0000", title: "Product leader for climate-tech scale-ups", github: "github.com/jane" });
    expect(data).not.toHaveProperty("policy");
    expect(String(data.profileYaml)).toContain('title: "Product leader for climate-tech scale-ups"');
    expect(await screen.findByRole("status")).toHaveTextContent(/generated CV and summary open with this/i);
  });

  it("headline: clearing it removes candidate.title", async () => {
    const user = userEvent.setup();
    render(<ContactPolicy uid="u1" setup={stored} profile={profile} part="headline" />);
    await user.clear(screen.getByLabelText(/^Headline/i));
    await user.click(screen.getByRole("button", { name: /Save headline/i }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(setDoc.mock.calls[0][1].contact).toEqual({ phone: "+64 21 000 0000", github: "github.com/jane" });
    expect(String(setDoc.mock.calls[0][1].profileYaml)).not.toContain("title:");
  });
});
