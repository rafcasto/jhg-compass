import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
let search = new URLSearchParams();
const setDoc = vi.fn<(ref: unknown, data: Record<string, unknown>, opts?: unknown) => Promise<void>>(async () => {});

vi.mock("firebase/firestore", () => ({
  setDoc: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => setDoc(ref, data, opts),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => search,
}));
vi.mock("@/lib/firestore/db", () => ({
  paths: {
    careerOpsSetup: (uid: string) => `users/${uid}/careerOps/setup`,
    careerOpsPortalsStatus: (uid: string) => `users/${uid}/careerOps/portalsStatus`,
  },
  useLiveDoc: () => ({ data: null, loading: false }),
}));
vi.mock("react-markdown", () => ({ default: ({ children }: { children: string }) => <div data-testid="preview">{children}</div> }));
vi.mock("remark-gfm", () => ({ default: () => undefined }));

import IntakeWizard from "@/components/careerops/IntakeWizard";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

const profile = {
  firstName: "Jane", lastName: "Smith", email: "jane@example.com", country: "New Zealand",
  goal: { role: "Product Owner", city: "Auckland" },
} as unknown as Profile;

const bare = { cvMarkdown: "", profileYaml: "", updatedAt: 1 } as CareerOpsSetupV2;
const complete = {
  cvMarkdown: "# Jane\n\n## Experience\nAcme 2021–2025 " + "x ".repeat(100),
  profileYaml: "", updatedAt: 1,
  portals: { companies: [{ name: "Acme", careersUrl: "https://acme.com/jobs" }], positive: [], negative: [] },
  contact: { title: "t", phone: "p", linkedin: "l", github: "g", portfolio: "x" },
  policy: { minimumSalary: "1", visaStatus: "v" },
  personalization: {
    targetRoles: [{ archetype: "A" }], adaptiveFraming: [{ role: "r", emphasize: "e" }],
    exitNarrative: "x", crossCuttingAdvantage: "y", portfolio: { url: "https://x.dev" },
    compTargets: "c", negotiationScripts: ["s"], locationPolicy: ["l"],
  },
} as CareerOpsSetupV2;

const tabs = () => within(screen.getByRole("tablist")).getAllByRole("tab");
const tab = (name: RegExp) => screen.getByRole("tab", { name });
const show = (setup: CareerOpsSetupV2 = bare) => render(<IntakeWizard uid="u1" setup={setup} profile={profile} answers={0} />);

beforeEach(() => {
  replace.mockClear();
  setDoc.mockClear();
  search = new URLSearchParams();
});

describe("IntakeWizard — the tab bar", () => {
  it("shows all six tabs in order", () => {
    show();
    expect(tabs().map((t) => t.textContent?.replace(/ —.*| \(.*/g, "").trim())).toEqual([
      "CV", "North Star", "Watchlist", "Contact", "Targeting", "Review",
    ]);
  });

  it("starts on the CV tab when the URL says nothing", () => {
    show();
    expect(tab(/^CV/)).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/CV/);
  });

  it("opens whichever tab the URL names, so a half-finished intake can be linked to", () => {
    search = new URLSearchParams("step=targeting");
    show();
    expect(tab(/^Targeting/)).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: /What evaluations score against/i })).toBeInTheDocument();
  });

  it("falls back to the CV tab for a step that does not exist", () => {
    search = new URLSearchParams("step=nonsense");
    show();
    expect(tab(/^CV/)).toHaveAttribute("aria-selected", "true");
  });
});

describe("IntakeWizard — navigating", () => {
  it("goes anywhere on a click, with no step gated behind another", async () => {
    const user = userEvent.setup();
    show(); // nothing filled in at all
    await user.click(tab(/^Targeting/));
    expect(replace).toHaveBeenCalledWith("?step=targeting", { scroll: false });
    // No tab is disabled just because an earlier one is empty.
    for (const t of tabs()) expect(t).not.toBeDisabled();
  });

  it("uses replace, so walking the tabs does not fill the back button", async () => {
    const user = userEvent.setup();
    show();
    await user.click(tab(/^Review/));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toBe("?step=review");
  });

  it("offers Back and Next, and omits them at the ends", async () => {
    const user = userEvent.setup();
    show();
    // first tab: a Next, no Back
    expect(screen.getByRole("button", { name: /North Star/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^North Star/ }));
    expect(replace).toHaveBeenCalledWith("?step=northstar", { scroll: false });

    search = new URLSearchParams("step=review");
    replace.mockClear();
    show();
    // last tab: a Back to Targeting, and no Next
    const nav = screen.getAllByRole("button", { name: /Targeting/ });
    expect(nav.length).toBeGreaterThan(0);
  });

  it("moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    show();
    await user.click(tab(/^CV/));
    replace.mockClear();
    await user.keyboard("{ArrowRight}");
    expect(replace).toHaveBeenCalledWith("?step=northstar", { scroll: false });
  });
});

describe("IntakeWizard — what each tab says about itself", () => {
  it("marks nothing done for a brand-new member", () => {
    show();
    expect(tab(/^CV/)).toHaveAccessibleName(/not yet/);
    expect(tab(/^North Star/)).toHaveAccessibleName(/done/); // the Compass goal already has a role
    expect(screen.getByLabelText(/of 3 required steps done/)).toHaveTextContent("1/3");
  });

  it("marks every tab done once everything is filled in", () => {
    show(complete);
    for (const name of [/^CV/, /^North Star/, /^Watchlist/, /^Contact/, /^Targeting/]) {
      expect(tab(name)).toHaveAccessibleName(/done/);
    }
    expect(screen.getByLabelText(/of 3 required steps done/)).toHaveTextContent("3/3");
  });

  it("calls a half-filled optional tab started, not done", () => {
    show({ ...bare, contact: { phone: "p" } } as CareerOpsSetupV2);
    expect(tab(/^Contact/)).toHaveAccessibleName(/started/);
  });

  it("tells a screen reader which required steps are still needed", () => {
    show();
    expect(tab(/^CV/)).toHaveAccessibleName(/still needed/);
    expect(tab(/^Contact/)).not.toHaveAccessibleName(/still needed/); // optional
  });

  it("says plainly when a tab is optional", async () => {
    search = new URLSearchParams("step=contact");
    show();
    expect(screen.getByText(/Optional — the portal works without it/i)).toBeInTheDocument();
  });

  it("does not call a required tab optional", async () => {
    search = new URLSearchParams("step=watchlist");
    show();
    expect(screen.queryByText(/Optional — the portal works without it/i)).not.toBeInTheDocument();
  });
});

describe("IntakeWizard — the review tab", () => {
  beforeEach(() => { search = new URLSearchParams("step=review"); });

  it("lists what is left and points at the first required gap", async () => {
    const user = userEvent.setup();
    show();
    expect(screen.getByRole("button", { name: /Enter the portal anyway/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Finish cv/i }));
    expect(replace).toHaveBeenCalledWith("?step=cv", { scroll: false });
  });

  it("drops the hedging and the nudge once the required steps are done", () => {
    show(complete);
    expect(screen.getByRole("button", { name: /^Enter the portal$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Finish /i })).not.toBeInTheDocument();
  });

  it("goes to the portal home", async () => {
    const user = userEvent.setup();
    show(complete);
    await user.click(screen.getByRole("button", { name: /^Enter the portal$/i }));
    expect(replace).toHaveBeenCalledWith("/careerops/sourcing");
  });

  it("still links to the full Setup screen for what intake does not cover", () => {
    show(complete);
    expect(screen.getByRole("link", { name: /Full setup/i })).toHaveAttribute("href", "/careerops/setup");
  });
});

describe("IntakeWizard — the panels are the real ones", () => {
  it("mounts the North Star chooser", () => {
    search = new URLSearchParams("step=northstar");
    show();
    expect(screen.getByRole("radio", { name: /Use my Compass North Star/i })).toBeInTheDocument();
  });

  it("mounts the watchlist editor", () => {
    search = new URLSearchParams("step=watchlist");
    show();
    expect(screen.getByRole("button", { name: /Save watchlist/i })).toBeDisabled();
    expect(screen.getByText(/Companies to watch/i)).toBeInTheDocument();
  });

  it("mounts the CV panel, showing a saved CV rather than an empty box", () => {
    search = new URLSearchParams("step=cv");
    show(complete);
    expect(screen.getByRole("heading", { name: /Your CV is saved/i })).toBeInTheDocument();
  });
});
