import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---- the edges IntakeScreen talks to ----
const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>) => Promise<void>>(async () => {});
const replace = vi.fn();
let careerOps: { ctx: unknown; loading: boolean; allowed: boolean };
let profile: unknown = { firstName: "Jane", lastName: "Smith", email: "jane@example.com", goal: { role: "Product Owner", city: "Auckland" } };
let answerDocs: unknown[] = [];

vi.mock("firebase/firestore", () => ({ setDoc: (ref: unknown, data: Record<string, unknown>) => setDoc(ref, data) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" }, isAdmin: false }) }));
vi.mock("@/lib/firestore/db", () => ({
  paths: { profile: (uid: string) => `users/${uid}/profile`, careerOpsAnswers: (uid: string) => `users/${uid}/answers`, careerOpsSetup: (uid: string) => `users/${uid}/setup` },
  useLiveDoc: () => ({ data: profile, loading: false }),
  useLiveCollection: () => ({ data: answerDocs, loading: false }),
}));
vi.mock("@/components/careerops/shared", () => ({ useCareerOps: () => careerOps }));
// ESM-only renderer; the preview pane is not what these tests are about.
vi.mock("react-markdown", () => ({ default: ({ children }: { children: string }) => <div data-testid="preview">{children}</div> }));
vi.mock("remark-gfm", () => ({ default: () => undefined }));

import IntakeScreen from "@/components/careerops/IntakeScreen";
import { PORTAL_HOME } from "@/lib/careerops/portal-nav";

const ctxWith = (over: Record<string, unknown> = {}) => ({
  uid: "u1", isAdmin: false, setup: null, setupLoading: false, hasCv: false, hasPortals: false,
  reports: [], notes: [], docs: [], status: null, statusError: false, online: false, ...over,
});

// The drag-and-drop surface is the box the paste textarea sits in.
const dropZone = () => screen.getByLabelText("Your CV").parentElement as HTMLElement;

const REAL_CV = `# Jane Smith\n\n## Experience\n**Acme — Product Owner (2021–2025)**\n` + "- shipped the discovery pipeline and cut lead time 40%\n".repeat(12);

beforeEach(() => {
  setDoc.mockClear();
  replace.mockClear();
  answerDocs = [];
  profile = { firstName: "Jane", lastName: "Smith", email: "jane@example.com", goal: { role: "Product Owner", city: "Auckland" } };
  careerOps = { ctx: ctxWith(), loading: false, allowed: true };
});

describe("IntakeScreen — the first-timer path", () => {
  it("asks for the CV and nothing else", () => {
    render(<IntakeScreen />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Start with your CV");
    expect(screen.getByLabelText("Your CV")).toBeInTheDocument();
    // The whole Setup screen is not what a first-timer meets.
    expect(screen.queryByText(/Portal accounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/What the agents need from you/i)).not.toBeInTheDocument();
  });

  it("proposes the CV back for review before anything is written", async () => {
    const user = userEvent.setup();
    render(<IntakeScreen />);
    await user.click(screen.getByLabelText("Your CV"));
    await user.paste(REAL_CV);
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));

    expect(screen.getByRole("heading", { name: /review and save/i })).toBeInTheDocument();
    expect(screen.getByText("Ready to score")).toBeInTheDocument();
    expect(screen.getByTestId("preview")).toHaveTextContent("Acme");
    expect(setDoc).not.toHaveBeenCalled(); // confirm gate
  });

  it("saves the reviewed CV and seeds the Scout keywords from the North Star", async () => {
    const user = userEvent.setup();
    render(<IntakeScreen />);
    await user.click(screen.getByLabelText("Your CV"));
    await user.paste(REAL_CV);
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));
    await user.click(screen.getByRole("button", { name: /Save my CV/i }));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const written = setDoc.mock.calls[0][1];
    expect(written.cvMarkdown).toContain("Acme — Product Owner");
    expect(written.profileYaml).toContain("Product Owner");
    const portals = written.portals as { companies: unknown[]; positive: string[] };
    expect(portals.companies).toEqual([]);
    expect(portals.positive.length).toBeGreaterThan(0);
    expect(written.portalsYaml).toContain("Product Owner");
    expect(typeof written.updatedAt).toBe("number");
  });

  it("flags a thin CV without blocking the save", async () => {
    const user = userEvent.setup();
    render(<IntakeScreen />);
    await user.click(screen.getByLabelText("Your CV"));
    await user.paste("Jane Smith, Product Owner, Auckland.");
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));

    expect(screen.getByText("A bit thin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save my CV/i })).toBeEnabled();
  });

  it("will not move on from an empty paste", async () => {
    const user = userEvent.setup();
    render(<IntakeScreen />);
    expect(screen.getByRole("button", { name: /Read my CV/i })).toBeDisabled();
    await user.click(screen.getByLabelText("Your CV"));
    await user.paste("   ");
    await user.click(screen.getByRole("button", { name: /Read my CV/i }));
    expect(screen.queryByRole("heading", { name: /review and save/i })).not.toBeInTheDocument();
  });

  it("only offers the file types it can actually read", () => {
    render(<IntakeScreen />);
    // The picker filters for us; drag-and-drop does not, which is why the
    // component checks the name itself (the next test).
    expect(screen.getByLabelText(/Upload \.md \/ \.txt/i)).toHaveAttribute("accept", ".md,.txt,.markdown,text/plain,text/markdown");
  });

  it("says so plainly when a dropped file isn't readable here", async () => {
    render(<IntakeScreen />);
    const file = new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" });
    fireEvent.drop(dropZone(), { dataTransfer: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't be read here yet/i);
    expect(screen.queryByRole("heading", { name: /review and save/i })).not.toBeInTheDocument();
  });

  it("reads a dropped .md file straight through to review", async () => {
    render(<IntakeScreen />);
    const file = new File([REAL_CV], "cv.md", { type: "text/markdown" });
    fireEvent.drop(dropZone(), { dataTransfer: { files: [file] } });
    expect(await screen.findByRole("heading", { name: /review and save/i })).toBeInTheDocument();
  });

  it("reads a picked .md file straight through to review", async () => {
    const user = userEvent.setup();
    render(<IntakeScreen />);
    const file = new File([REAL_CV], "cv.md", { type: "text/markdown" });
    await user.upload(screen.getByLabelText(/Upload \.md \/ \.txt/i), file);
    expect(await screen.findByRole("heading", { name: /review and save/i })).toBeInTheDocument();
  });
});

describe("IntakeScreen — the checklist", () => {
  it("skips the ask for a member who already has a CV", () => {
    careerOps = { ctx: ctxWith({ hasCv: true, setup: { cvMarkdown: "x", portals: { companies: [], positive: [], negative: [] } } }), loading: false, allowed: true };
    render(<IntakeScreen />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your CareerOps intake");
    expect(screen.queryByLabelText("Your CV")).not.toBeInTheDocument();
  });

  it("counts only the required steps and links each gap where it can be closed", () => {
    careerOps = { ctx: ctxWith({ hasCv: true, setup: { cvMarkdown: "x", portals: { companies: [], positive: [], negative: [] } } }), loading: false, allowed: true };
    render(<IntakeScreen />);
    expect(screen.getByText("2/3")).toBeInTheDocument(); // CV + North Star done, watchlist open
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent?.includes("done"))).toEqual([true, true, false, false]);
    expect(screen.getByRole("link", { name: /Full setup/i })).toHaveAttribute("href", "/careerops/setup");
  });

  it("lets them into the portal with gaps open, and says what happens if they do", async () => {
    careerOps = { ctx: ctxWith({ hasCv: true, setup: { cvMarkdown: "x", portals: { companies: [], positive: [], negative: [] } } }), loading: false, allowed: true };
    render(<IntakeScreen />);
    expect(screen.getByText(/will say so and link you back here/i)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Enter the portal anyway/i }));
    expect(replace).toHaveBeenCalledWith(PORTAL_HOME);
  });

  it("drops the hedging once every required step is done", () => {
    careerOps = { ctx: ctxWith({ hasCv: true, setup: { cvMarkdown: "x", portals: { companies: [{ name: "Acme", careersUrl: "https://acme.com/jobs" }], positive: [], negative: [] } } }), loading: false, allowed: true };
    render(<IntakeScreen />);
    expect(screen.getByText("3/3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Enter the portal$/i })).toBeInTheDocument();
    expect(screen.queryByText(/will say so and link you back here/i)).not.toBeInTheDocument();
  });
});

describe("IntakeScreen — gates", () => {
  it("renders nothing of its own when the portal isn't switched on", () => {
    careerOps = { ctx: ctxWith(), loading: false, allowed: false };
    const { container } = render(<IntakeScreen />);
    expect(container).toBeEmptyDOMElement();
  });

  it("waits rather than guessing while the setup doc is still loading", () => {
    careerOps = { ctx: ctxWith({ setupLoading: true }), loading: false, allowed: true };
    render(<IntakeScreen />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your CV")).not.toBeInTheDocument();
  });
});
