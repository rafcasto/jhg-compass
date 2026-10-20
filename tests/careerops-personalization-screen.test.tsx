import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>, opts?: unknown) => Promise<void>>(async () => {});
vi.mock("firebase/firestore", () => ({
  setDoc: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => setDoc(ref, data, opts),
}));
vi.mock("@/lib/firestore/db", () => ({ paths: { careerOpsSetup: (uid: string) => `users/${uid}/careerOps/setup` } }));

import Personalization from "@/components/careerops/Personalization";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

const profile = {
  firstName: "Jane", lastName: "Smith", email: "jane@example.com", country: "New Zealand",
  goal: { role: "Senior Product Owner", city: "Auckland", salary: "200,000" },
} as unknown as Profile;
const base = { cvMarkdown: "# Jane", profileYaml: "", notes: "", updatedAt: 1 } as CareerOpsSetupV2;

const save = () => screen.getByRole("button", { name: /Save personalization/i });
// The header counter and each list's own counter are different quantities, so
// read the header by its accessible name rather than by the digits.
const filled = () => screen.getByLabelText(/sections filled in/).textContent?.replace("/", " of ");

beforeEach(() => setDoc.mockClear());

describe("Personalization — the eight sections", () => {
  it("shows all eight, with nothing filled in for a new member", () => {
    render(<Personalization uid="u1" setup={base} profile={profile} />);
    for (const label of ["Target roles", "Adaptive framing", "Exit narrative", "Cross-cutting advantage", "Portfolio / demo", "Comp targets", "Negotiation scripts", "Location policy"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(filled()).toBe("0 of 8");
    expect(save()).toBeDisabled();
  });

  it("counts a section as filled only once it would survive validation", async () => {
    const user = userEvent.setup();
    render(<Personalization uid="u1" setup={base} profile={profile} />);
    await user.click(screen.getByRole("button", { name: /Add archetype/i }));
    expect(filled()).toBe("0 of 8"); // an empty row is not an answer
    await user.type(screen.getByLabelText("Archetype 1"), "AI Platform");
    expect(filled()).toBe("1 of 8");
  });

  it("warns about a portfolio URL the agents could not open, and does not count it", async () => {
    const user = userEvent.setup();
    render(<Personalization uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/Demo or portfolio URL/i), "jane.dev");
    expect(screen.getByRole("alert")).toHaveTextContent(/to be able to open it/i);
    expect(filled()).toBe("0 of 8");
    await user.clear(screen.getByLabelText(/Demo or portfolio URL/i));
    await user.type(screen.getByLabelText(/Demo or portfolio URL/i), "https://jane.dev");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(filled()).toBe("1 of 8");
  });

  it("caps the repeatable lists where career-ops caps them", async () => {
    const user = userEvent.setup();
    render(<Personalization uid="u1" setup={base} profile={profile} />);
    for (let i = 0; i < 6; i++) await user.click(screen.getByRole("button", { name: /Add script/i }));
    expect(screen.getByText("6 of 6 added")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add script/i })).not.toBeInTheDocument();
  });

  it("removes a row", async () => {
    const user = userEvent.setup();
    render(<Personalization uid="u1" setup={base} profile={profile} />);
    await user.click(screen.getByRole("button", { name: /Add archetype/i }));
    await user.type(screen.getByLabelText("Archetype 1"), "AI Platform");
    await user.click(screen.getByRole("button", { name: /Remove archetype 1/i }));
    expect(screen.queryByLabelText("Archetype 1")).not.toBeInTheDocument();
    expect(filled()).toBe("0 of 8");
  });
});

describe("Personalization — what gets written", () => {
  it("stores the validated sections, the rendered _profile.md and a rebuilt profile.yml", async () => {
    const user = userEvent.setup();
    render(<Personalization uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/^Exit narrative$/i), "Built and sold a SaaS. Now applied AI.");
    await user.type(screen.getByLabelText(/^Cross-cutting advantage$/i), "Technical builder with real proof.");
    await user.type(screen.getByLabelText(/Demo or portfolio URL/i), "https://jane.dev/demo");
    await user.click(save());

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data, opts] = setDoc.mock.calls[0];
    expect(opts).toEqual({ merge: true });

    const p = data.personalization as Record<string, unknown>;
    expect(p.exitNarrative).toBe("Built and sold a SaaS. Now applied AI.");
    expect(p.portfolio).toEqual({ url: "https://jane.dev/demo" });

    // The rendered file uses career-ops' headings, and marks the rest unanswered.
    const md = String(data.profileMd);
    expect(md).toContain("## Your Exit Narrative");
    expect(md).toContain("Built and sold a SaaS. Now applied AI.");
    expect(md).toContain("## Your Target Roles");
    expect(md).toMatch(/^_NOT SET —/m);

    // The sections that have a profile.yml home reach the agents today.
    const yaml = String(data.profileYaml);
    expect(yaml).toContain('exit_story: "Built and sold a SaaS. Now applied AI."');
    expect(yaml).toContain("  superpowers:");
    expect(yaml).toContain('    - "Technical builder with real proof."');
    expect(yaml).toContain("  dashboard:");
    expect(yaml).toContain('    url: "https://jane.dev/demo"');
  });

  it("drops a row the validator rejects rather than storing it", async () => {
    const user = userEvent.setup();
    render(<Personalization uid="u1" setup={base} profile={profile} />);
    // A framing row needs BOTH halves; this one has only the first.
    await user.click(screen.getByRole("button", { name: /Add framing/i }));
    await user.type(screen.getByLabelText("If the role is 1"), "Platform");
    await user.type(screen.getByLabelText(/^Exit narrative$/i), "Something, so there is a change to save.");
    await user.click(save());
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(setDoc.mock.calls[0][1].personalization).not.toHaveProperty("adaptiveFraming");
  });

  it("loads what was saved before", () => {
    render(<Personalization uid="u1" setup={{ ...base, personalization: { exitNarrative: "Saved story.", targetRoles: [{ archetype: "AI Platform", axes: "evals" }] } }} profile={profile} />);
    expect(screen.getByLabelText(/^Exit narrative$/i)).toHaveValue("Saved story.");
    expect(screen.getByLabelText("Archetype 1")).toHaveValue("AI Platform");
    expect(filled()).toBe("2 of 8");
  });

  it("says so rather than claiming success when the write fails", async () => {
    const user = userEvent.setup();
    setDoc.mockRejectedValueOnce(new Error("offline"));
    render(<Personalization uid="u1" setup={base} profile={profile} />);
    await user.type(screen.getByLabelText(/^Exit narrative$/i), "x");
    await user.click(save());
    expect(await screen.findByRole("status")).toHaveTextContent(/Couldn't save that/i);
  });
});
