import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import CoachingScreen from "@/components/coaching/CoachingScreen";
import CoachingPreview from "@/components/coaching/CoachingPreview";
import { COACHING_COLUMN_HEIGHT, DEFAULT_COACHING_SCREEN } from "@/lib/coaching-screen";
import { MOBILE_HEADER_HEIGHT, MOBILE_TABBAR_HEIGHT } from "@/components/shell/MobileChrome";

// jsdom has no layout engine: fake the two measurements the fit check reads.
function fakeLayout(scrollHeight: number, clientHeight: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return scrollHeight; } });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return clientHeight; } });
}
afterEach(() => {
  delete (HTMLElement.prototype as any).scrollHeight;
  delete (HTMLElement.prototype as any).clientHeight;
});

describe("CoachingScreen", () => {
  it("renders every piece of the seed copy in order", () => {
    render(<CoachingScreen content={DEFAULT_COACHING_SCREEN} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/^Maximizeyour job search with the power of aCoach!$/);
    expect(screen.getByText(/Hands-on support that keeps you on track/)).toBeInTheDocument();

    const benefits = within(screen.getByRole("list", { name: "What you get" })).getAllByRole("listitem");
    expect(benefits.map((li) => li.textContent)).toEqual([
      "🤝Held accountableA weekly call where you report on what you actually did.",
      "🏆Better oddsYour resume, LinkedIn and pitch reviewed by someone who hires.",
      "⚡Go fasterSkip the guesswork with the 7-step playbook applied to your case.",
    ]);

    const card = screen.getByRole("list", { name: "Included with coaching" });
    expect(within(card).getAllByRole("listitem")).toHaveLength(1);
    expect(card).toHaveTextContent("🗣️Live Sessions2 sessions per week (1 Masterclass, 1 Unblocking U) over 8 weeks. 60 minutes each.");

    const cta = screen.getByRole("link", { name: "Book a coaching call" });
    expect(cta).toHaveAttribute("href", "https://jobhackers.global");
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Free 20 minutes. No pitch if it's not a fit.")).toBeInTheDocument();
  });

  it("renders entitlements from the list so more can be added", () => {
    const content = {
      ...DEFAULT_COACHING_SCREEN,
      entitlements: [
        ...DEFAULT_COACHING_SCREEN.entitlements,
        { emoji: "💬", title: "Slack access", body: "Ask anything between sessions." },
        { emoji: "🎯", title: "Playbook", body: "The 7-step playbook, applied to you." },
      ],
    };
    render(<CoachingScreen content={content} />);
    const items = within(screen.getByRole("list", { name: "Included with coaching" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Live Sessions"),
      "💬Slack accessAsk anything between sessions.",
      "🎯PlaybookThe 7-step playbook, applied to you.",
    ]);
  });

  it("fires the CTA click handler", async () => {
    const onCtaClick = vi.fn();
    render(<CoachingScreen content={DEFAULT_COACHING_SCREEN} onCtaClick={onCtaClick} />);
    screen.getByRole("link", { name: "Book a coaching call" }).click();
    expect(onCtaClick).toHaveBeenCalledTimes(1);
  });

  it("reports fits=true when the content is no taller than the column", () => {
    fakeLayout(640, COACHING_COLUMN_HEIGHT);
    const onFitChange = vi.fn();
    render(<CoachingScreen content={DEFAULT_COACHING_SCREEN} onFitChange={onFitChange} />);
    expect(onFitChange).toHaveBeenLastCalledWith(true);
  });

  it("reports fits=false when the content overflows the column", () => {
    fakeLayout(COACHING_COLUMN_HEIGHT + 40, COACHING_COLUMN_HEIGHT);
    const onFitChange = vi.fn();
    render(<CoachingScreen content={DEFAULT_COACHING_SCREEN} onFitChange={onFitChange} />);
    expect(onFitChange).toHaveBeenLastCalledWith(false);
  });
});

describe("CoachingPreview — the 390×844 frame is the real shell", () => {
  it("is exactly 390×844 with the column sized between header and tab bar", () => {
    render(<CoachingPreview content={DEFAULT_COACHING_SCREEN} />);
    const frame = screen.getByRole("img", { name: "Live preview at 390×844" });
    expect(frame).toHaveStyle({ width: "390px", height: "844px" });
    expect(frame.querySelector(".coaching-screen")!.parentElement).toHaveStyle({ height: `${COACHING_COLUMN_HEIGHT}px` });
    expect(44 + MOBILE_HEADER_HEIGHT + COACHING_COLUMN_HEIGHT + MOBILE_TABBAR_HEIGHT).toBe(844);
  });

  it("shows the Compass header, Sign out and the four tabs with Coaching active", () => {
    render(<CoachingPreview content={DEFAULT_COACHING_SCREEN} />);
    expect(screen.getByAltText("JobHackers")).toBeInTheDocument();
    expect(screen.getByText("Compass", { selector: "header span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.textContent!.replace(/\s+/g, " ").trim()).toBe("Compass Performance Progress Coaching");
    expect(within(nav).getByText("Coaching")).toHaveAttribute("aria-current", "page");
  });
});

describe("no-scroll layout contract (app/globals.css)", () => {
  const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
  const block = (selector: string) => {
    const m = css.match(new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.\-]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
    if (!m) throw new Error(`no rule for ${selector}`);
    return m[1];
  };

  it("benefit rows absorb the vertical slack (flex:1 + space-evenly)", () => {
    const b = block(".coaching-benefits");
    expect(b).toMatch(/flex:\s*1 1 auto/);
    expect(b).toMatch(/justify-content:\s*space-evenly/);
    expect(block(".coaching-cta-wrap")).toMatch(/flex:\s*0 0 auto/);
  });

  it("the page column subtracts exactly the header + tab bar heights", () => {
    const b = block(".coaching-screen--page");
    expect(b).toContain(`calc(100dvh - ${MOBILE_HEADER_HEIGHT + MOBILE_TABBAR_HEIGHT}px`);
  });

  it("uses the brand tokens: red CTA with glow, blue-grey card, no #9aa0ad text", () => {
    expect(block(".coaching-cta")).toContain("#c2001f");
    expect(block(".coaching-cta")).toContain("0 6px 18px rgba(194, 0, 31, .25)");
    expect(block(".coaching-cta")).toMatch(/min-height:\s*48px/);
    expect(block(".coaching-card")).toContain("#e2ebfb");
    expect(block(".coaching-headline-3")).toContain("#c2001f");
    const coachingCss = css.slice(css.indexOf("Coaching tab (JobHackers design system)"));
    expect(coachingCss).not.toContain("#9aa0ad");
    expect(coachingCss).not.toMatch(/gradient|backdrop-filter/);
  });
});
