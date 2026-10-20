import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// IntakeScreen is now just the front door: pick one of the three ways in, then
// hand off to the wizard. The CV flow lives in CvPanel (see
// careerops-cv-panel.test.tsx) and the tabs in IntakeWizard (see
// careerops-intake-wizard-screen.test.tsx).

const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>, opts?: unknown) => Promise<void>>(async () => {});
const replace = vi.fn();
let careerOps: { ctx: unknown; loading: boolean; allowed: boolean };
let profile: unknown = { firstName: "Jane", lastName: "Smith", email: "jane@example.com", goal: { role: "Product Owner", city: "Auckland" } };

vi.mock("firebase/firestore", () => ({
  setDoc: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => setDoc(ref, data, opts),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" }, isAdmin: false }) }));
vi.mock("@/lib/firestore/db", () => ({
  paths: {
    profile: (uid: string) => `users/${uid}/profile`,
    careerOpsAnswers: (uid: string) => `users/${uid}/answers`,
    careerOpsSetup: (uid: string) => `users/${uid}/setup`,
    careerOpsPortalsStatus: (uid: string) => `users/${uid}/portalsStatus`,
  },
  useLiveDoc: (path: string | null) => ({ data: path?.endsWith("/profile") ? profile : null, loading: false }),
  useLiveCollection: () => ({ data: [], loading: false }),
}));
vi.mock("@/components/careerops/shared", () => ({ useCareerOps: () => careerOps }));
vi.mock("react-markdown", () => ({ default: ({ children }: { children: string }) => <div data-testid="preview">{children}</div> }));
vi.mock("remark-gfm", () => ({ default: () => undefined }));

import IntakeScreen from "@/components/careerops/IntakeScreen";

const ctxWith = (over: Record<string, unknown> = {}) => ({
  uid: "u1", isAdmin: false, setup: null, setupLoading: false, hasCv: false, hasPortals: false,
  reports: [], notes: [], docs: [], status: null, statusError: false, online: false, ...over,
});

beforeEach(() => {
  setDoc.mockClear();
  replace.mockClear();
  profile = { firstName: "Jane", lastName: "Smith", email: "jane@example.com", goal: { role: "Product Owner", city: "Auckland" } };
  careerOps = { ctx: ctxWith(), loading: false, allowed: true };
});

describe("IntakeScreen — the three ways in", () => {
  it("asks how they want to start, before asking for anything", () => {
    render(<IntakeScreen />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Let's get you set up");
    expect(screen.getByRole("button", { name: /Use what Compass already knows/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Go through intake/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload la maleta/i })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("names the North Star Compass already has, so the light path is an informed choice", () => {
    render(<IntakeScreen />);
    expect(screen.getByText(/Your North Star is already set/i)).toHaveTextContent("Product Owner");
  });

  it("hands off to the wizard for the two form paths", async () => {
    const user = userEvent.setup();
    render(<IntakeScreen />);
    await user.click(screen.getByRole("button", { name: /Go through intake/i }));
    expect(screen.getByRole("tablist", { name: /Intake steps/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your CareerOps intake");
  });

  it("tells the light path which tabs actually matter, so six tabs don't imply six obligations", async () => {
    const user = userEvent.setup();
    render(<IntakeScreen />);
    await user.click(screen.getByRole("button", { name: /Use what Compass already knows/i }));
    expect(screen.getByText(/Only CV, North Star and Watchlist are needed/i)).toBeInTheDocument();
  });

  it("does not show that note to someone who chose the full form", async () => {
    const user = userEvent.setup();
    render(<IntakeScreen />);
    await user.click(screen.getByRole("button", { name: /Go through intake/i }));
    expect(screen.queryByText(/Only CV, North Star and Watchlist are needed/i)).not.toBeInTheDocument();
  });

  it("skips the chooser entirely for a member who already has a CV", () => {
    careerOps = { ctx: ctxWith({ hasCv: true, setup: { cvMarkdown: "# Jane" } }), loading: false, allowed: true };
    render(<IntakeScreen />);
    expect(screen.getByRole("tablist", { name: /Intake steps/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upload la maleta/i })).not.toBeInTheDocument();
  });
});

describe("IntakeScreen — path 3: la maleta", () => {
  const pickMaleta = async () => {
    const user = userEvent.setup();
    render(<IntakeScreen />);
    await user.click(screen.getByRole("button", { name: /Upload la maleta/i }));
    return user;
  };
  const drop = (name: string, text: string) => {
    const zone = screen.getByText(/Drop your maleta here/i).closest("div") as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [new File([text], name, { type: "text/markdown" })] } });
  };

  it("offers the upload instead of the wizard", async () => {
    await pickMaleta();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Upload la maleta");
    expect(screen.getByText(/Drop your maleta here/i)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows what it found and writes nothing until confirmed", async () => {
    await pickMaleta();
    drop("la-maleta.md", "## North Star\n\n- role: Senior Product Owner\n\n## Your Exit Narrative\n\nBuilt and sold a SaaS.");
    expect(await screen.findByText(/Found in/i)).toBeInTheDocument();
    expect(screen.getByText(/North Star \(Senior Product Owner\)/)).toBeInTheDocument();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("unpacks it and lands in the wizard", async () => {
    const user = await pickMaleta();
    drop("la-maleta.md", "## North Star\n\n- role: Senior Product Owner\n\n## Contact\n\n- phone: +64 21 000 0000");
    await user.click(await screen.findByRole("button", { name: /Unpack it/i }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, data, opts] = setDoc.mock.calls[0];
    expect(opts).toEqual({ merge: true });
    expect(data.goalSource).toBe("intake");
    expect(String(data.profileYaml)).toContain('phone: "+64 21 000 0000"');
    expect(await screen.findByRole("tablist", { name: /Intake steps/i })).toBeInTheDocument();
  });

  it("refuses a file type that is not a maleta", async () => {
    await pickMaleta();
    drop("cv.pdf", "%PDF-1.4");
    expect(await screen.findByRole("alert")).toHaveTextContent(/\.md or \.yml file/i);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("explains an unrecognisable file rather than saving an empty maleta", async () => {
    await pickMaleta();
    drop("notes.md", "# Hello\n\nJust some prose.");
    expect(await screen.findByRole("alert")).toHaveTextContent(/## North Star/);
    expect(screen.queryByRole("button", { name: /Unpack it/i })).not.toBeInTheDocument();
  });

  it("can go back to the other ways in", async () => {
    const user = await pickMaleta();
    await user.click(screen.getByRole("button", { name: /Other ways to start/i }));
    expect(screen.getByRole("button", { name: /Go through intake/i })).toBeInTheDocument();
  });
});

describe("IntakeScreen — gates", () => {
  it("renders nothing of its own when the portal isn't switched on", () => {
    careerOps = { ctx: ctxWith(), loading: false, allowed: false };
    const { container } = render(<IntakeScreen />);
    expect(container.textContent).toBe("");
  });

  it("waits rather than guessing while the setup doc is still loading", () => {
    careerOps = { ctx: ctxWith({ setupLoading: true }), loading: false, allowed: true };
    render(<IntakeScreen />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
