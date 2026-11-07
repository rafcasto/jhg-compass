import { describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Compass } from "lucide-react";

// The account group of every shell is Settings · Sign out — the sidebar on
// desktop, the icon cluster in the header on mobile. The Profile row went into
// Settings on 2026-11-07 (docs/UX_SETTINGS_HUB.md): "who I am" and "what the
// agents work from" are one place now. A Profile row renders only when asked for.

vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? "")} /> }));

import { DesktopSidebar } from "@/components/shell/DesktopChrome";
import { MobileHeader } from "@/components/shell/MobileChrome";

const items = [{ key: "/compass", label: "Compass", icon: Compass, href: "/compass", active: true }];

describe("account navigation", () => {
  it("JobHacking shell: Settings points at the portal's upload page, and there is no Profile row", () => {
    render(<DesktopSidebar items={items} onSignOut={() => {}} settingsHref="/jobhacking/settings" settingsActive />);
    const account = screen.getByLabelText("Account");
    const links = within(account).getAllByRole("link");
    expect(links.map((l) => l.textContent?.trim())).toEqual(["Settings"]);
    expect(links[0]).toHaveAttribute("href", "/jobhacking/settings");
    cleanup();
    render(<MobileHeader onSignOut={() => {}} settingsHref="/jobhacking/settings" />);
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/jobhacking/settings");
  });

  it("Compass shell: Settings → Sign out — no Profile row (it lives under Settings, 2026-11-07)", () => {
    render(<DesktopSidebar items={items} onSignOut={() => {}} settingsActive />);
    const account = screen.getByLabelText("Account");
    const links = within(account).getAllByRole("link");
    expect(links.map((l) => l.textContent?.trim())).toEqual(["Settings"]);
    expect(links[0]).toHaveAttribute("href", "/settings");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(within(account).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
  });

  it("a Profile row renders only when a caller asks for one", () => {
    render(<DesktopSidebar items={items} onSignOut={() => {}} profileHref="/somewhere" profileActive />);
    const links = within(screen.getByLabelText("Account")).getAllByRole("link");
    expect(links.map((l) => l.textContent?.trim())).toEqual(["Profile", "Settings"]);
    expect(links[0]).toHaveAttribute("href", "/somewhere");
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });

  it("mobile header: two 44px icon targets, each labelled, Settings marked when active", () => {
    render(<MobileHeader onSignOut={() => {}} settingsActive />);
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
    const settings = screen.getByRole("link", { name: "Settings" });
    expect(settings).toHaveAttribute("href", "/settings");
    expect(settings).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(settings.className).toMatch(/\bh-11\b/);
    expect(settings.className).toMatch(/\bw-11\b/);
  });

  it("the static preview renders the same rows without links", () => {
    render(<DesktopSidebar items={items} position="static" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
