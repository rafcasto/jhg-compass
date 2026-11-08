import { describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Archive, BookOpen, Building2, FileText, Linkedin, Navigation, Shield, UserRound } from "lucide-react";

// The JobHacking sidebar is two groups — Compass · Artefacts — over the same row
// recipe (decision 2026-11-08, docs/UX_JOBHACKING.md §9). A group is a
// `.section-label` heading over its rows, as on every section rail; rows with
// no group (Admin) run on with no heading. The bottom bar never shows groups.

vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? "")} /> }));

import { DesktopSidebar, groupTabs } from "@/components/shell/DesktopChrome";
import { BottomTabBar } from "@/components/shell/MobileChrome";

const grouped = [
  { key: "narrative", label: "Narrative", icon: UserRound, href: "/jobhacking/narrative", group: "Compass" },
  { key: "true-north", label: "True North", icon: Navigation, href: "/jobhacking/true-north", group: "Compass" },
  { key: "companies", label: "Target companies", icon: Building2, href: "/jobhacking/companies", group: "Compass" },
  { key: "story-bank", label: "Story Bank", icon: BookOpen, href: "/jobhacking/artefacts?section=story-bank", group: "Artefacts", active: true },
  { key: "master-cv", label: "Master CV", icon: FileText, href: "/jobhacking/artefacts?section=master-cv", group: "Artefacts" },
  { key: "linkedin-profile", label: "LinkedIn profile", icon: Linkedin, href: "/jobhacking/artefacts?section=linkedin-profile", group: "Artefacts" },
  { key: "/admin", label: "Admin", icon: Shield, href: "/admin" },
];

describe("grouped sidebar", () => {
  it("groups consecutive rows under one heading; ungrouped rows run on their own", () => {
    expect(groupTabs(grouped).map((g) => [g.group, g.items.length])).toEqual([["Compass", 3], ["Artefacts", 3], [null, 1]]);
    expect(groupTabs([{ key: "a", label: "A", icon: Archive, href: "/a" }]).map((g) => g.group)).toEqual([null]);
  });

  it("renders Compass and Artefacts as receding headings over their rows, one row lit, Settings apart in the account group", () => {
    render(<DesktopSidebar items={grouped} onSignOut={() => {}} settingsHref="/jobhacking/settings" />);
    const primary = screen.getByRole("navigation", { name: "Primary" });
    const headings = primary.querySelectorAll(".section-label");
    expect(Array.from(headings).map((h) => h.textContent)).toEqual(["Compass", "Artefacts"]);
    const links = within(primary).getAllByRole("link");
    expect(links.map((l) => l.textContent?.trim())).toEqual(["Narrative", "True North", "Target companies", "Story Bank", "Master CV", "LinkedIn profile", "Admin"]);
    expect(within(primary).getByRole("link", { name: "Story Bank" })).toHaveAttribute("aria-current", "page");
    expect(within(primary).getByRole("link", { name: "Master CV" })).not.toHaveAttribute("aria-current");
    expect(within(primary).getByRole("link", { name: "Master CV" })).toHaveAttribute("href", "/jobhacking/artefacts?section=master-cv");
    // A heading is text, never a link or a button.
    expect(within(primary).queryByRole("link", { name: "Compass" })).not.toBeInTheDocument();
    expect(within(primary).queryByRole("button")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Account")).getAllByRole("link").map((l) => l.textContent?.trim())).toEqual(["Settings"]);
  });

  it("an ungrouped sidebar renders as before — no headings", () => {
    cleanup();
    render(<DesktopSidebar items={grouped.map(({ group: _g, ...i }) => i)} onSignOut={() => {}} />);
    expect(screen.getByRole("navigation", { name: "Primary" }).querySelectorAll(".section-label")).toHaveLength(0);
  });

  it("the bottom bar ignores groups", () => {
    cleanup();
    render(<BottomTabBar items={grouped.slice(0, 4)} />);
    expect(screen.queryByText("Compass")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
});
