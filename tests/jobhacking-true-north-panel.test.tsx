import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// JobHacking → True North editors after an upload (decision 2026-11-07): the
// statement previews the job title as it is typed, and Save writes the goal
// home in effect — the uploaded intake goal, or the Compass goal.

const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>, opts?: unknown) => Promise<void>>(async () => {});
vi.mock("firebase/firestore", () => ({ setDoc: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => setDoc(ref, data, opts) }));
vi.mock("@/lib/firestore/db", () => ({ paths: { careerOpsSetup: (uid: string) => `users/${uid}/careerOps/setup`, profile: (uid: string) => `users/${uid}` } }));

import TrueNorthPanel from "@/components/jobhacking/TrueNorthPanel";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

const profile: Profile = { email: "laurent@mail.example", goal: { role: "Customer Success Operations Lead", city: "Lyon" } };
const intake = { role: "Revenue Operations Manager", seniority: "Senior", subsector: "B2B SaaS", city: "Lyon, France", salary: "EUR 70,000–80,000", companyType: "Scale-up" };
const uploaded = { goalSource: "intake", intakeGoal: intake, cvMarkdown: "", profileYaml: "", notes: "", updatedAt: 1 } as CareerOpsSetupV2;

beforeEach(() => setDoc.mockClear());

describe("TrueNorthPanel", () => {
  it("previews the job title as it is typed, and clears the preview when the editor leaves", async () => {
    const onDraft = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<TrueNorthPanel uid="u1" setup={uploaded} profile={profile} section="roles" onDraft={onDraft} />);
    const title = screen.getByLabelText(/^Job title/);
    expect(title).toHaveValue("Revenue Operations Manager");
    await user.clear(title);
    await user.type(title, "Head of RevOps");
    expect(onDraft).toHaveBeenLastCalledWith({ role: "Head of RevOps" });
    // Only this section's fields travel — the seniority is not the roles section's to preview.
    expect(onDraft.mock.calls.every(([d]) => Object.keys(d).join() === "role")).toBe(true);
    unmount();
    expect(onDraft).toHaveBeenLastCalledWith({});
  });

  it("after an upload, Save writes the new title into the intake goal on the setup document and leaves the Compass goal alone", async () => {
    const user = userEvent.setup();
    render(<TrueNorthPanel uid="u1" setup={uploaded} profile={profile} section="roles" />);
    const title = screen.getByLabelText(/^Job title/);
    await user.clear(title);
    await user.type(title, "Head of RevOps");
    await user.click(screen.getByRole("button", { name: "Save target roles" }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [ref, data] = setDoc.mock.calls[0];
    expect(ref).toBe("users/u1/careerOps/setup");
    expect(data.goalSource).toBe("intake");
    expect(data.intakeGoal).toEqual({ ...intake, role: "Head of RevOps" });
    expect(String(data.profileYaml)).toContain("Head of RevOps");
    expect(await screen.findByRole("status")).toHaveTextContent(/Saved/);
  });

  it("with no upload in effect, Save writes the Compass goal on the account", async () => {
    const user = userEvent.setup();
    render(<TrueNorthPanel uid="u1" setup={null} profile={profile} section="seniority" />);
    await user.type(screen.getByLabelText(/^Seniority level/), "Senior");
    await user.click(screen.getByRole("button", { name: "Save seniority" }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(2));
    expect(setDoc.mock.calls[0][0]).toBe("users/u1/careerOps/setup");
    expect(setDoc.mock.calls[0][1].intakeGoal).toBeUndefined();
    const [ref, data] = setDoc.mock.calls[1];
    expect(ref).toBe("users/u1");
    expect((data as { goal: { role: string; seniority: string; city: string } }).goal).toMatchObject({ role: "Customer Success Operations Lead", seniority: "Senior", city: "Lyon" });
  });
});
