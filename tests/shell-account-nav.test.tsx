import { describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Compass } from "lucide-react";

// Profile and Settings sit side by side in the account group of both shells —
// the sidebar on desktop, the icon cluster in the header on mobile — so a
// member finds "who I am" and "what the agents work from" in the same place.

vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? "")} /> }));

import { DesktopSidebar } from "@/components/shell/DesktopChrome";
import { MobileHeader } from "@/components/shell/MobileChrome";

const items = [{ key: "/compass", label: "Compass", icon: Compass, href: "/compass", active: true }];

describe("account navigation", () => {
  it("JobHacking shell: no Profile row in the account group (Profile is a primary tab there), Settings points at the portal's upload page", () => {
    render(<DesktopSidebar items={items} onSignOut={() => {}} profileHref={null} settingsHref="/jobhacking/settings" settingsActive />);
    const account = screen.getByLabelText("Account");
    const links = within(account).getAllByRole("link");
    expect(links.map((l) => l.textContent?.trim())).toEqual(["Settings"]);
    expect(links[0]).toHaveAttribute("href", "/jobhacking/settings");
    cleanup();
    render(<MobileHeader onSignOut={() => {}} profileHref={null} settingsHref="/jobhacking/settings" />);
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/jobhacking/settings");
  });

  it("desktop sidebar: Profile → Settings → Sign out, with the active one marked", () => {
    render(<DesktopSidebar items={items} onSignOut={() => {}} settingsActive />);
    const account = screen.getByLabelText("Account");
    const links = within(account).getAllByRole("link");
    expect(links.map((l) => l.textContent?.trim())).toEqual(["Profile", "Settings"]);
    expect(links[0]).toHaveAttribute("href", "/profile");
    expect(links[1]).toHaveAttribute("href", "/settings");
    expect(links[1]).toHaveAttribute("aria-current", "page");
    expect(links[0]).not.toHaveAttribute("aria-current");
    expect(within(account).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("mobile header: three 44px icon targets, each labelled", () => {
    render(<MobileHeader onSignOut={() => {}} profileActive />);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    for (const el of [screen.getByRole("link", { name: "Profile" }), screen.getByRole("link", { name: "Settings" })]) {
      expect(el.className).toMatch(/\bh-11\b/);
      expect(el.className).toMatch(/\bw-11\b/);
    }
  });

  it("the static preview renders the same rows without links", () => {
    render(<DesktopSidebar items={items} position="static" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
