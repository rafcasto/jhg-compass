import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The upload lock on the four Packer-file slots (docs/UX_JOBHACKING.md §4c):
// with the admin flag on and no survey submitted, every way in opens the
// survey instead of the upload sheet; with it off, or once answered, the
// slots are the normal Upload / Replace buttons.

const feedback = { cfg: { enabled: false, uploadLock: false }, submitted: false, loading: false };
vi.mock("@/lib/firestore/feedback", async () => {
  const { DEFAULT_FEEDBACK_CONFIG } = await import("@/lib/feedback-defaults");
  return {
    useFeedbackConfig: () => ({ ...DEFAULT_FEEDBACK_CONFIG, ...feedback.cfg }),
    useFeedbackSubmission: () => ({ submitted: feedback.submitted, loading: feedback.loading }),
  };
});
vi.mock("@/lib/firestore/db", () => ({ paths: { feedbackResponses: (uid: string) => `users/${uid}/feedback` }, addDoc: vi.fn(async () => {}) }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1", email: "m@mail.example" }, signOut: vi.fn() }) }));
vi.mock("@/components/profile/ProfileUploadSheet", () => ({ default: () => <div data-testid="upload-sheet" /> }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import ProfileFilesPanel from "@/components/jobhacking/ProfileFilesPanel";

beforeEach(() => { feedback.cfg = { enabled: false, uploadLock: false }; feedback.submitted = false; feedback.loading = false; });

const mount = () => render(<ProfileFilesPanel uid="u1" setup={null} profile={{ email: "m@mail.example" }} portal="jobhacking" />);

describe("the upload lock", () => {
  it("is not there while the admin flag is off", async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.getByRole("button", { name: "Upload files" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Upload .*\.yml$/ })).toHaveLength(4);
    expect(screen.queryByText(/locked/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Upload narrative.yml" }));
    expect(screen.getByTestId("upload-sheet")).toBeInTheDocument();
  });

  it("locks every way in until the survey is answered, and opens the survey instead", async () => {
    feedback.cfg = { enabled: false, uploadLock: true };
    const user = userEvent.setup();
    mount();
    // The page's one red button is the survey; the slots are mute and locked.
    expect(screen.queryByRole("button", { name: "Upload files" })).toBeNull();
    expect(screen.getByRole("button", { name: "Answer the survey" })).toHaveClass("btn-primary");
    const slots = screen.getAllByRole("button", { name: /locked until you answer the survey/ });
    expect(slots).toHaveLength(4);
    expect(slots[0]).toHaveTextContent("Locked");
    expect(screen.getByText(/Answer 4 short questions and every slot unlocks/)).toBeInTheDocument();
    expect(screen.getByText(/Dropping files unlocks after the survey/)).toBeInTheDocument();
    // The export is not an upload — it stays.
    expect(screen.getByRole("button", { name: /Download everything/ })).toBeInTheDocument();

    await user.click(slots[0]);
    expect(screen.queryByTestId("upload-sheet")).toBeNull();
    expect(screen.getByRole("heading", { name: /We really value your feedback/ })).toBeInTheDocument();
    // Opened by the member, so the way out is Not now — never Sign out.
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("holds the lock while the submission check is loading", () => {
    feedback.cfg = { enabled: false, uploadLock: true };
    feedback.loading = true; feedback.submitted = true;
    mount();
    expect(screen.getByRole("button", { name: "Answer the survey" })).toBeInTheDocument();
  });

  it("is lifted once the member has answered", async () => {
    feedback.cfg = { enabled: false, uploadLock: true };
    feedback.submitted = true;
    const user = userEvent.setup();
    mount();
    expect(screen.queryByRole("button", { name: "Answer the survey" })).toBeNull();
    expect(screen.getByRole("button", { name: "Upload files" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Upload artefacts.yml" }));
    expect(screen.getByTestId("upload-sheet")).toBeInTheDocument();
  });
});
