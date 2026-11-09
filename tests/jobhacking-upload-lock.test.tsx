import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The upload lock on the four Packer-file slots (docs/UX_JOBHACKING.md §4c):
// per slot — with the admin flag on, a row the member has not answered the
// survey for opens the survey for THAT file instead of the upload sheet; an
// answered row is the normal Upload / Replace. No button above the rows.

const feedback = { cfg: { enabled: false, uploadLock: false }, unlocked: [] as string[], loading: false };
vi.mock("@/lib/firestore/feedback", async () => {
  const { DEFAULT_FEEDBACK_CONFIG } = await import("@/lib/feedback-defaults");
  return {
    useFeedbackConfig: () => ({ ...DEFAULT_FEEDBACK_CONFIG, ...feedback.cfg }),
    useFeedbackSubmission: () => ({ submitted: feedback.unlocked.length > 0, unlocked: feedback.unlocked, loading: feedback.loading }),
  };
});
vi.mock("@/lib/firestore/db", () => ({ paths: { feedbackResponses: (uid: string) => `users/${uid}/feedback` }, addDoc: vi.fn(async () => {}) }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1", email: "m@mail.example" }, signOut: vi.fn() }) }));
vi.mock("@/components/profile/ProfileUploadSheet", () => ({ default: () => <div data-testid="upload-sheet" /> }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import ProfileFilesPanel from "@/components/jobhacking/ProfileFilesPanel";

beforeEach(() => { feedback.cfg = { enabled: false, uploadLock: false }; feedback.unlocked = []; feedback.loading = false; });

const mount = () => render(<ProfileFilesPanel uid="u1" setup={null} profile={{ email: "m@mail.example" }} portal="jobhacking" />);

describe("the upload lock", () => {
  it("is not there while the admin flag is off — and there is no button above the rows", async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.queryByRole("button", { name: "Upload files" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Answer the survey" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Upload .*\.yml$/ })).toHaveLength(6);
    expect(screen.queryByText(/unlock/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Upload narrative.yml" }));
    expect(screen.getByTestId("upload-sheet")).toBeInTheDocument();
  });

  it("locks each row on its own and opens the survey for that file", async () => {
    feedback.cfg = { enabled: false, uploadLock: true };
    const user = userEvent.setup();
    mount();
    expect(screen.queryByRole("button", { name: "Answer the survey" })).toBeNull();
    const slots = screen.getAllByRole("button", { name: /^Unlock .*\.yml — answer a short survey$/ });
    expect(slots).toHaveLength(6);
    expect(slots[0]).toHaveTextContent("Unlock");
    expect(screen.getByText(/Each file unlocks with a short survey — 4 questions, once per file/)).toBeInTheDocument();
    expect(screen.getByText(/Dropping files works once every file is unlocked/)).toBeInTheDocument();
    // The export is not an upload — it stays.
    expect(screen.getByRole("button", { name: /Download everything/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unlock true-north.yml — answer a short survey" }));
    expect(screen.queryByTestId("upload-sheet")).toBeNull();
    expect(screen.getByRole("heading", { name: /We really value your feedback/ })).toBeInTheDocument();
    // The survey says which file this answer unlocks.
    expect(screen.getByText("Unlocks True North")).toBeInTheDocument();
    // Opened by the member, so the way out is Not now — never Sign out.
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("one answer unlocks one file — the others stay locked", async () => {
    feedback.cfg = { enabled: false, uploadLock: true };
    feedback.unlocked = ["narrative"];
    const user = userEvent.setup();
    mount();
    expect(screen.getByRole("button", { name: "Upload narrative.yml" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Unlock .*\.yml/ })).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "Upload narrative.yml" }));
    expect(screen.getByTestId("upload-sheet")).toBeInTheDocument();
  });

  it("holds the lock while the submission check is loading", () => {
    feedback.cfg = { enabled: false, uploadLock: true };
    feedback.loading = true; feedback.unlocked = ["narrative", "trueNorth", "targetCompanies", "storyBank", "masterCv", "linkedin"];
    mount();
    expect(screen.getAllByRole("button", { name: /^Unlock .*\.yml/ })).toHaveLength(6);
  });

  it("is fully open once every file is answered", () => {
    feedback.cfg = { enabled: false, uploadLock: true };
    feedback.unlocked = ["narrative", "trueNorth", "targetCompanies", "storyBank", "masterCv", "linkedin"];
    mount();
    expect(screen.queryByRole("button", { name: /^Unlock/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Upload .*\.yml$/ })).toHaveLength(6);
    expect(screen.getByText(/Drop one file — or all of them/)).toBeInTheDocument();
  });
});
