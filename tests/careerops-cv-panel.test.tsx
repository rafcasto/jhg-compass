import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The CV step, extracted from IntakeScreen so first-run and the wizard's CV tab
// share one implementation. These tests moved here with the code.

const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>, opts?: unknown) => Promise<void>>(async () => {});
vi.mock("firebase/firestore", () => ({
  setDoc: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => setDoc(ref, data, opts),
}));
vi.mock("@/lib/firestore/db", () => ({ paths: { careerOpsSetup: (uid: string) => `users/${uid}/careerOps/setup` } }));
vi.mock("react-markdown", () => ({ default: ({ children }: { children: string }) => <div data-testid="preview">{children}</div> }));
vi.mock("remark-gfm", () => ({ default: () => undefined }));

import CvPanel from "@/components/careerops/CvPanel";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

const profile = { firstName: "Jane", lastName: "Smith", email: "jane@example.com", country: "New Zealand", goal: { role: "Product Owner", city: "Auckland" } } as unknown as Profile;
const REAL_CV = `# Jane Smith\n\n## Experience\n**Acme — Product Owner (2021–2025)**\n` + "- shipped the discovery pipeline and cut lead time 40%\n".repeat(12);
const dropZone = () => screen.getByLabelText("Your CV").parentElement as HTMLElement;

beforeEach(() => setDoc.mockClear());

describe("CvPanel — a member with no CV yet", () => {
  it("asks for one, and nothing else", () => {
    render(<CvPanel uid="u1" setup={null} profile={profile} />);
    expect(screen.getByLabelText("Your CV")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Read my CV/i })).toBeDisabled();
  });

  it("proposes it back for review before anything is written", async () => {
    const user = userEvent.setup();
    render(<CvPanel uid="u1" setup={null} profile={profile} />);
    await user.click(screen.getByLabelText("Your CV"));
    await user.paste(REAL_CV);
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));

    expect(screen.getByRole("heading", { name: /review and save/i })).toBeInTheDocument();
    expect(screen.getByText("Ready to score")).toBeInTheDocument();
    expect(setDoc).not.toHaveBeenCalled(); // confirm gate
  });

  it("saves with merge, seeds the Scout keywords from the North Star, and reports back", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CvPanel uid="u1" setup={null} profile={profile} goalRole="Senior Product Owner" onSaved={onSaved} />);
    await user.click(screen.getByLabelText("Your CV"));
    await user.paste(REAL_CV);
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));
    await user.click(screen.getByRole("button", { name: /Save my CV/i }));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data, opts] = setDoc.mock.calls[0];
    expect(data.cvMarkdown).toContain("Acme — Product Owner");
    expect((data.portals as { positive: string[] }).positive.length).toBeGreaterThan(0);
    expect(String(data.portalsYaml)).toContain("Product Owner");
    // merge, so the North Star and targeting on the same document survive
    expect(opts).toEqual({ merge: true });
    expect(onSaved).toHaveBeenCalled();
  });

  it("flags a thin CV without blocking the save", async () => {
    const user = userEvent.setup();
    render(<CvPanel uid="u1" setup={null} profile={profile} />);
    await user.click(screen.getByLabelText("Your CV"));
    await user.paste("Jane Smith, Product Owner, Auckland.");
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));
    expect(screen.getByText("A bit thin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save my CV/i })).toBeEnabled();
  });

  it("will not move on from an empty paste", async () => {
    const user = userEvent.setup();
    render(<CvPanel uid="u1" setup={null} profile={profile} />);
    await user.click(screen.getByLabelText("Your CV"));
    await user.paste("   ");
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));
    expect(screen.queryByRole("heading", { name: /review and save/i })).not.toBeInTheDocument();
  });

  it("only offers the file types it can read, and names the format for anything else", async () => {
    render(<CvPanel uid="u1" setup={null} profile={profile} />);
    expect(screen.getByLabelText(/Upload \.md \/ \.txt/i)).toHaveAttribute("accept", ".md,.txt,.markdown,text/plain,text/markdown");
    // Drag-and-drop has no accept filter, so the component checks the name.
    fireEvent.drop(dropZone(), { dataTransfer: { files: [new File(["%PDF"], "cv.pdf", { type: "application/pdf" })] } });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Markdown or plain text/i);
    expect(alert.textContent).not.toMatch(/\byet\b/i);
  });

  it("reads a dropped .md straight through to review", async () => {
    render(<CvPanel uid="u1" setup={null} profile={profile} />);
    fireEvent.drop(dropZone(), { dataTransfer: { files: [new File([REAL_CV], "cv.md", { type: "text/markdown" })] } });
    expect(await screen.findByRole("heading", { name: /review and save/i })).toBeInTheDocument();
  });

  it("keeps the text when the save fails, so nothing is lost", async () => {
    const user = userEvent.setup();
    setDoc.mockRejectedValueOnce(new Error("offline"));
    render(<CvPanel uid="u1" setup={null} profile={profile} />);
    await user.click(screen.getByLabelText("Your CV"));
    await user.paste(REAL_CV);
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));
    await user.click(screen.getByRole("button", { name: /Save my CV/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't save your CV/i);
    expect(screen.getByLabelText("Review your CV")).toHaveValue(REAL_CV.trim());
  });
});

describe("CvPanel — a member who already has one", () => {
  const saved = { cvMarkdown: REAL_CV, profileYaml: "", updatedAt: 1_700_000_000_000 } as CareerOpsSetupV2;

  it("shows the saved CV rather than an empty box", () => {
    render(<CvPanel uid="u1" setup={saved} profile={profile} />);
    expect(screen.getByRole("heading", { name: /Your CV is saved/i })).toBeInTheDocument();
    expect(screen.getByTestId("preview")).toHaveTextContent("Acme");
    expect(screen.queryByLabelText("Your CV")).not.toBeInTheDocument();
  });

  it("makes replacing it a deliberate act, and pre-fills the current text", async () => {
    const user = userEvent.setup();
    render(<CvPanel uid="u1" setup={saved} profile={profile} />);
    await user.click(screen.getByRole("button", { name: /Replace my CV/i }));
    expect(screen.getByLabelText("Your CV")).toHaveValue(REAL_CV.trim());
  });

  it("can back out of replacing without losing what is stored", async () => {
    const user = userEvent.setup();
    render(<CvPanel uid="u1" setup={saved} profile={profile} />);
    await user.click(screen.getByRole("button", { name: /Replace my CV/i }));
    await user.click(screen.getByRole("button", { name: /Keep the CV I have/i }));
    expect(screen.getByRole("heading", { name: /Your CV is saved/i })).toBeInTheDocument();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("does not re-seed the watchlist keywords over an existing watchlist", async () => {
    const user = userEvent.setup();
    const withPortals = { ...saved, portals: { companies: [{ name: "Acme", careersUrl: "https://acme.com/jobs" }], positive: ["Head of Product"], negative: [] } } as CareerOpsSetupV2;
    render(<CvPanel uid="u1" setup={withPortals} profile={profile} goalRole="Senior Product Owner" />);
    await user.click(screen.getByRole("button", { name: /Replace my CV/i }));
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));
    await user.click(screen.getByRole("button", { name: /Save my CV/i }));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    expect(setDoc.mock.calls[0][1].portals).toEqual(withPortals.portals);
  });
});
