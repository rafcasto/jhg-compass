import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mergeContent, hiddenActivities, visibleActivities, weeklyTargetsFrom, DEFAULT_ACTIVITIES, DEFAULT_TEXT } from "@/lib/content";
import type { ContentConfig } from "@/lib/types";

// ---- mocks -------------------------------------------------------------------
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/image", () => ({ default: (p: any) => <img alt={p.alt} /> }));
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1" }, loading: false, emailVerified: true }),
}));
vi.mock("@/components/CountrySelect", () => ({
  default: ({ value, onChange }: any) => (
    <input aria-label="Country" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/components/CompassSentence", () => ({ default: () => <span /> }));
vi.mock("@/lib/track-client", () => ({ track: vi.fn() }));

// Firestore: settings/targets doc is controllable per test; setDoc is spied.
const setDoc = vi.fn<(...a: any[]) => Promise<void>>(async () => {});
let targetDocData: { targets: Record<string, number> } | null = null;
vi.mock("@/lib/firestore/db", () => ({
  paths: {
    profile: (uid: string) => ({ path: `users/${uid}` }),
    settingsTargets: (uid: string) => ({ path: `users/${uid}/settings/targets` }),
  },
  useLiveDoc: (ref: { path: string } | null) =>
    ref?.path.endsWith("settings/targets")
      ? { data: targetDocData, loading: false }
      : { data: null, loading: false },
  setDoc: (...a: any[]) => setDoc(...a),
}));

// Admin content: mutable so a test can simulate config/content arriving AFTER first render.
let contentState: { loading: boolean; config: ContentConfig } = { loading: false, config: mergeContent(null) };
vi.mock("@/lib/firestore/content", () => ({
  useContent: () => {
    const { loading, config } = contentState;
    return {
      loading, config,
      hidden: hiddenActivities(config), visible: visibleActivities(config),
      weeklyTargets: weeklyTargetsFrom(config), effortSplit: config.effortSplit, stages: config.stages,
      t: (k: string) => config.text[k] ?? DEFAULT_TEXT[k] ?? "",
    };
  },
}));

import OnboardingPage from "@/app/onboarding/page";

// ---- helpers -----------------------------------------------------------------
const adminContent = (overrides: Record<string, number>) => mergeContent({
  activities: DEFAULT_ACTIVITIES.map((a) => (a.id in overrides ? { ...a, defaultWeekly: overrides[a.id] } : a)),
});

// <Field> renders <label> without htmlFor, so resolve the input via the label's wrapper.
const fieldByLabel = (label: string) =>
  screen.getByText(label).parentElement!.querySelector("input") as HTMLInputElement;

async function goToTargetsStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(fieldByLabel(DEFAULT_TEXT["onb.firstName"]), "Ada");
  await user.type(fieldByLabel(DEFAULT_TEXT["onb.lastName"]), "Lovelace");
  await user.type(screen.getByLabelText("Country"), "NZ");
  await user.click(screen.getByRole("button", { name: /continue/i }));
  await user.type(fieldByLabel("Job title / function"), "PO");
  await user.click(screen.getByRole("button", { name: /continue/i }));
  expect(screen.getByText(DEFAULT_TEXT["onb.targetsTitle"])).toBeInTheDocument();
}

// The per-day number shown next to an activity label (rounded weekly/5 workdays, like Performance "day").
function dailyShown(label: string): number {
  const row = screen.getByText(label).parentElement as HTMLElement;
  const btns = within(row).getAllByRole("button");
  // [minus, plus] — the value sits between them
  return Number(btns[0].nextElementSibling!.textContent);
}
const COLD = "Contact prospects — cold / no referral";
const THANKS = "Thank-you notes";

beforeEach(() => {
  setDoc.mockClear(); replace.mockClear();
  targetDocData = null;
  contentState = { loading: false, config: mergeContent(null) };
});

// ---- tests -------------------------------------------------------------------
describe("Onboarding → Set daily targets (synced with Performance)", () => {
  it("shows admin-set defaults, not the static code defaults", async () => {
    contentState = { loading: false, config: adminContent({ outreach_cold: 20, thank_you: 0 }) };
    const user = userEvent.setup();
    render(<OnboardingPage />);
    await goToTargetsStep(user);
    expect(dailyShown(COLD)).toBe(4);   // 20 / wk → 4 / day (5-workday week)
    expect(dailyShown(THANKS)).toBe(0); // admin cleared it
  });

  it("reflects admin defaults that arrive AFTER first render (the reported bug)", async () => {
    // First paint: still on static defaults (outreach_cold 8/wk → 2/day)
    const user = userEvent.setup();
    const { rerender } = render(<OnboardingPage />);
    await goToTargetsStep(user);
    expect(dailyShown(COLD)).toBe(2);
    // config/content snapshot lands with the admin's value
    contentState = { loading: false, config: adminContent({ outreach_cold: 35 }) };
    rerender(<OnboardingPage />);
    expect(dailyShown(COLD)).toBe(7);
  });

  it("prefers the user's existing override over the admin default", async () => {
    contentState = { loading: false, config: adminContent({ outreach_cold: 35 }) };
    targetDocData = { targets: { outreach_cold: 15 } };
    const user = userEvent.setup();
    render(<OnboardingPage />);
    await goToTargetsStep(user);
    expect(dailyShown(COLD)).toBe(3);
  });

  it("Finish persists ONLY the rows the user touched, on top of existing overrides", async () => {
    contentState = { loading: false, config: adminContent({ outreach_cold: 20 }) };
    targetDocData = { targets: { thank_you: 7 } };
    const user = userEvent.setup();
    render(<OnboardingPage />);
    await goToTargetsStep(user);

    const row = screen.getByText(COLD).parentElement as HTMLElement;
    await user.click(within(row).getAllByRole("button")[1]); // plus → 4/day → 5/day
    expect(dailyShown(COLD)).toBe(5);
    await user.click(screen.getByRole("button", { name: new RegExp(DEFAULT_TEXT["onb.finish"]) }));

    const targetsWrite = setDoc.mock.calls.find((c: any[]) => c[0].path.endsWith("settings/targets"));
    expect(targetsWrite).toBeTruthy();
    // 5/day → toWeekly = 5 * 5 workdays = 25. thank_you override kept; no admin defaults copied in.
    expect(targetsWrite![1]).toEqual({ targets: { thank_you: 7, outreach_cold: 25 } });
    expect(replace).toHaveBeenCalledWith("/compass");
  });

  it("Finish without touching targets does not write the targets doc at all", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);
    await goToTargetsStep(user);
    await user.click(screen.getByRole("button", { name: new RegExp(DEFAULT_TEXT["onb.finish"]) }));
    expect(setDoc.mock.calls.some((c: any[]) => c[0].path.endsWith("settings/targets"))).toBe(false);
    expect(setDoc.mock.calls.some((c: any[]) => c[0].path === "users/u1")).toBe(true);
  });

  it("waits for admin content before rendering (no flash of static defaults)", () => {
    contentState = { loading: true, config: mergeContent(null) };
    render(<OnboardingPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
